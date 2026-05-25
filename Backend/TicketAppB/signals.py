import traceback
from django.utils import timezone
from django.db import transaction
from django.dispatch import receiver
from decimal import Decimal, ROUND_HALF_UP
from django.db.models.signals import post_save, pre_save
from django.contrib.auth import get_user_model
from .models import MosambeeTransaction, TransactionData, Route, Fare, Company, Dealer, ETMDevice


# COMPANY / DEALER ACTIVE STATUS CASCADE

@receiver(post_save, sender=Company)
def cascade_company_active_status(sender, instance, created, **kwargs):
    if created:
        return
    User = get_user_model()
    User.objects.filter(company=instance).update(is_active=instance.is_active)


@receiver(post_save, sender=Dealer)
def cascade_dealer_active_status(sender, instance, created, **kwargs):
    if created:
        return
    User = get_user_model()
    User.objects.filter(dealer=instance).update(is_active=instance.is_active)


# MOSAMBEE TRANSACTION SIGNALS
@receiver(post_save, sender=MosambeeTransaction)
def auto_reconcile_mosambee_payment(sender, instance, created, **kwargs):
    """
    Automatically processes Mosambee transaction after it's saved.
    
    Flow:
    1. Only runs for newly created transactions (not updates)
    2. Checks if payment was successful (responseCode = '0', '00', or '000')
    3. If successful, tries to match with bus ticket
    4. Updates reconciliation_status based on result
    """
    
    # STEP 1: Only process NEW transactions
    if not created:
        return
    
    print(f"🔄 Processing new transaction: TXN-{instance.transactionID}")
    
    # STEP 2: Check if payment was successful
    if not instance.is_payment_successful:
        print(f"❌ Payment declined: TXN-{instance.transactionID} (Code: {instance.responseCode})")
        instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        instance.save()
        return
    
    print(f"✅ Payment approved: TXN-{instance.transactionID}")
    
    # STEP 3: Start reconciliation process
    instance.processing_status = MosambeeTransaction.ProcessingStatus.RECONCILING
    instance.save()
    
    try:
        # CHECK 1: Does invoice number exist?
        if not instance.invoiceNumber:
            print(f"⚠️ No invoice number: TXN-{instance.transactionID}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            instance.reconciliation_error = "No invoice number provided"
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return
        
        print(f"🔍 Looking for ticket: {instance.invoiceNumber}")

        # CHECK 2: Resolve company via registered device
        device = ETMDevice.objects.select_related('company').filter(
            serial_number=instance.transactionTerminalId
        ).first()
        if not device or not device.company:
            print(f"⚠️ Device not registered: {instance.transactionTerminalId}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            instance.reconciliation_error = f"Device not registered or company not found: {instance.transactionTerminalId}"
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return

        # CHECK 3: Find matching bus ticket scoped to company
        ticket = TransactionData.objects.filter(
            ticket_number=instance.invoiceNumber,
            company_code=device.company,
        ).first()

        if not ticket:
            print(f"❌ Ticket not found: {instance.invoiceNumber}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            instance.reconciliation_error = f"No ticket found with number: {instance.invoiceNumber}"
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return
        
        print(f"✅ Ticket found: {instance.invoiceNumber}")
        
        # CHECK 4: Do amounts match?
        ticket_amount = ticket.ticket_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        payment_amount = (Decimal(str(instance.transactionAmount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

        if ticket_amount != payment_amount:
            print(f"⚠️ Amount mismatch: Ticket=₹{ticket_amount}, Payment=₹{payment_amount}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.AMOUNT_MISMATCH
            instance.reconciliation_error = (
                f"Amount mismatch - "
                f"Ticket: ₹{ticket_amount}, "
                f"Payment: ₹{payment_amount}"
            )
            instance.related_ticket = ticket
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return

        print(f"✅ Amounts match: ₹{instance.transactionAmount}")
        
        # CHECK 5: Is ticket already paid? (atomic + row-lock to prevent concurrent webhook race)
        with transaction.atomic():
            existing_payment = MosambeeTransaction.objects.select_for_update().filter(
                related_ticket=ticket
            ).exclude(id=instance.id).first()

        if existing_payment:
            print(f"⚠️ Duplicate payment detected: TXN-{existing_payment.transactionID}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.DUPLICATE
            instance.reconciliation_error = (
                f"Ticket already paid by transaction: {existing_payment.transactionID}"
            )
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return
        
        # SUCCESS: Auto-matched!
        print(f"🎉 Auto-matched: TXN-{instance.transactionID} ↔ Ticket-{instance.invoiceNumber}")
        
        instance.related_ticket = ticket
        instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.AUTO_MATCHED
        instance.reconciled_at = timezone.now()
        instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        instance.save()
        
        print(f"✅ Reconciliation complete: TXN-{instance.transactionID}")
        
    except Exception as e:
        print(f"❌ Reconciliation error: {str(e)}")
        traceback.print_exc()
        instance.reconciliation_error = f"Reconciliation error: {str(e)}"
        instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        instance.save()


# ROUTE SIGNALS
@receiver(pre_save, sender=Route)
def capture_old_route_name(sender, instance, **kwargs):
    """
    Capture old route_name before save happens.
    Attaches old name to instance so post_save can compare.

    Flow:
    1. Only runs for existing routes (not new ones)
    2. Fetches current DB value before it gets overwritten
    3. Stores it temporarily on the instance object
    """

    # Only for existing routes (pk exists)
    if instance.pk:
        try:
            old = Route.objects.get(pk=instance.pk)
            # Temporarily attach old name to instance
            instance._old_route_name = old.route_name
        except Route.DoesNotExist:
            instance._old_route_name = None
    else:
        # New route being created
        instance._old_route_name = None


@receiver(post_save, sender=Route)
def sync_fare_route_name(sender, instance, created, **kwargs):
    """
    When a Route name is updated, sync route_name in all
    related Fare records automatically.

    Flow:
    1. Skip if this is a new route (no fares exist yet)
    2. Compare old name (captured in pre_save) with new name
    3. If changed, bulk update all related Fare records
    """

    # STEP 1: Skip newly created routes
    if created:
        return

    # STEP 2: Get old name captured by pre_save signal
    old_name = getattr(instance, '_old_route_name', None)

    # STEP 3: Only update if name actually changed
    if old_name and old_name != instance.route_name:
        updated_count = Fare.objects.filter(route=instance).update(
            route_name=instance.route_name
        )
        print(f"✅ Synced route_name '{instance.route_name}' across {updated_count} Fare records")
    else:
        print(f"ℹ️ Route name unchanged - no Fare records updated")