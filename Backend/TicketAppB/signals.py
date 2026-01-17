import traceback
from django.utils import timezone
from django.dispatch import receiver
from decimal import Decimal, ROUND_HALF_UP
from django.db.models.signals import post_save
from .models import MosambeeTransaction, TransactionData


@receiver(post_save, sender=MosambeeTransaction)
def auto_reconcile_mosambee_payment(sender, instance, created, **kwargs):
    """
    Automatically processes Mosambee transaction after it's saved.
    
    Flow:
    1. Only runs for newly created transactions (not updates)
    2. Checks if payment was successful (responseCode = '0', '00', or '000')
    3. If successful, tries to match with bus ticket
    4. Updates reconciliation_status based on result
    
    Args:
        sender: The model class (MosambeeTransaction)
        instance: The actual transaction object that was saved
        created: Boolean - True if this is a new record, False if update
        **kwargs: Additional arguments
    """
    
    # STEP 1: Only process NEW transactions
    if not created:
        # This is an UPDATE, not a new transaction
        # Don't run reconciliation again
        return
    
    print(f"🔄 Processing new transaction: TXN-{instance.transactionID}")
    
    # STEP 2: Check if payment was successful
    if not instance.is_payment_successful:
        # Payment declined/failed
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
        
        # CHECK 2: Find matching bus ticket
        ticket = TransactionData.objects.filter(ticket_number=instance.invoiceNumber).first()
        
        if not ticket:
            print(f"❌ Ticket not found: {instance.invoiceNumber}")
            instance.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            instance.reconciliation_error = f"No ticket found with number: {instance.invoiceNumber}"
            instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            instance.save()
            return
        
        print(f"✅ Ticket found: {instance.invoiceNumber}")
        
        # CHECK 3: Do amounts match?
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
        
        # CHECK 4: Is ticket already paid?
        existing_payment = MosambeeTransaction.objects.filter(related_ticket=ticket).exclude(id=instance.id).first()
        
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
        # ERROR: Something went wrong
        print(f"❌ Reconciliation error: {str(e)}")
        traceback.print_exc()
        
        instance.reconciliation_error = f"Reconciliation error: {str(e)}"
        instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        instance.save()

# OPTIONAL: Add more signal handlers

# Example: Send notification when payment is auto-matched
# @receiver(post_save, sender=MosambeeTransaction)
# def send_payment_notification(sender, instance, created, **kwargs):
#     if instance.reconciliation_status == MosambeeTransaction.ReconciliationStatus.AUTO_MATCHED:
#         # Send email/SMS notification
#         pass