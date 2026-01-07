import hashlib
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils import timezone
from ..models import MosambeeTransaction, TransactionData


def validate_checksum(transaction_id, merchant_id, rrn, checksum_received):
    """Validates Mosambee checksum using SHA-512"""
    try:
        salt = settings.MOSAMBEE_SALT
        data_to_hash = str(transaction_id) + str(merchant_id) + str(rrn) + salt
        calculated_checksum = hashlib.sha512(data_to_hash.encode('utf-8')).hexdigest()
        is_valid = calculated_checksum.lower() == checksum_received.lower()
        
        if is_valid:
            return True, calculated_checksum, None
        else:
            error = f"Checksum mismatch"
            return False, calculated_checksum, error
    except Exception as e:
        return False, None, f"Checksum validation error: {str(e)}"


def try_auto_reconciliation(transaction):
    """Automatically match payment with bus ticket"""
    try:
        if not transaction.invoiceNumber:
            transaction.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            transaction.reconciliation_error = "No invoice number provided"
            transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            transaction.save()
            return
        
        ticket = TransactionData.objects.filter(
            ticket_number=transaction.invoiceNumber
        ).first()
        
        if not ticket:
            transaction.reconciliation_status = MosambeeTransaction.ReconciliationStatus.NOT_FOUND
            transaction.reconciliation_error = f"No ticket found: {transaction.invoiceNumber}"
            transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            transaction.save()
            return
        
        if ticket.ticket_amount != transaction.transactionAmount:
            transaction.reconciliation_status = MosambeeTransaction.ReconciliationStatus.AMOUNT_MISMATCH
            transaction.reconciliation_error = f"Amount mismatch: Ticket=₹{ticket.ticket_amount}, Payment=₹{transaction.transactionAmount}"
            transaction.related_ticket = ticket
            transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            transaction.save()
            return
        
        existing_payment = MosambeeTransaction.objects.filter(
            related_ticket=ticket
        ).exclude(id=transaction.id).first()
        
        if existing_payment:
            transaction.reconciliation_status = MosambeeTransaction.ReconciliationStatus.DUPLICATE
            transaction.reconciliation_error = f"Ticket already paid: TXN-{existing_payment.transactionID}"
            transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
            transaction.save()
            return
        
        # Success - auto-matched!
        transaction.related_ticket = ticket
        transaction.reconciliation_status = MosambeeTransaction.ReconciliationStatus.AUTO_MATCHED
        transaction.reconciled_at = timezone.now()
        transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        transaction.save()
        
    except Exception as e:
        transaction.reconciliation_error = f"Auto-reconciliation error: {str(e)}"
        transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        transaction.save()


@receiver(post_save, sender=MosambeeTransaction)
def process_mosambee_transaction(sender, instance, created, **kwargs):
    """
    Automatically processes transaction after it's saved.
    Runs in background after webhook returns response.
    """
    if not created:
        return
    
    # Step 1: Validate checksum
    is_valid, calc_checksum, error = validate_checksum(
        instance.transactionID,
        instance.merchantId,
        instance.transactionRRN,
        instance.checksum_received
    )
    
    instance.checksum_calculated = calc_checksum
    instance.is_checksum_valid = is_valid
    instance.validation_error = error
    
    if is_valid:
        instance.processing_status = MosambeeTransaction.ProcessingStatus.VALIDATED
    else:
        instance.processing_status = MosambeeTransaction.ProcessingStatus.VALIDATION_FAILED
    
    instance.save()
    
    # Step 2: Try auto-reconciliation (only if checksum valid and payment successful)
    if is_valid and instance.is_payment_successful:
        instance.processing_status = MosambeeTransaction.ProcessingStatus.RECONCILING
        instance.save()
        try_auto_reconciliation(instance)
    else:
        # Payment declined or checksum failed - mark for manager review
        instance.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION
        instance.save()


# Don't forget to import this in apps.py:
# 
# from django.apps import AppConfig
# 
# class YourAppConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'your_app_name'
#     
#     def ready(self):
#         import your_app_name.signals
