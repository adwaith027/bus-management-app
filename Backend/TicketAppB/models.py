from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.conf import settings


class Company(models.Model):
    # Authentication Status Choices
    class AuthStatus(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        # for showing in UI that license validation is undergoing
        VALIDATING = 'Validating', 'Validating'
        APPROVED = 'Approve', 'Approved'
        EXPIRED = 'Expired', 'Expired'
        BLOCKED = 'Block', 'Blocked'

    # Basic Company Information
    company_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    company_name = models.CharField(max_length=100)
    company_email = models.EmailField(unique=True)
    gst_number = models.CharField(max_length=20, null=True, blank=True)
    
    # Contact Information
    contact_person = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=20)
    
    # Address Information
    address = models.TextField()
    address_2 = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    
    # License Information
    number_of_licence = models.IntegerField(default=0)
    authentication_status = models.CharField(
        max_length=20,
        choices=AuthStatus.choices,
        default=AuthStatus.PENDING,
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='companies_created'
    )
    
    # License Server Fields
    product_registration_id = models.IntegerField(null=True, blank=True)
    unique_identifier = models.CharField(max_length=255, null=True, blank=True)
    product_from_date = models.DateField(null=True, blank=True)
    product_to_date = models.DateField(null=True, blank=True)
    
    # Additional License Fields
    project_code = models.CharField(max_length=100, null=True, blank=True)
    device_count = models.IntegerField(null=True, blank=True)
    branch_count = models.IntegerField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'company'
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
    
    def __str__(self):
        return self.company_name
    
    @property
    def is_validated(self):
        """Check if company license is validated"""
        return self.authentication_status == self.AuthStatus.APPROVED
    
    @property
    def needs_validation(self):
        """Check if company needs license validation"""
        return self.authentication_status == self.AuthStatus.PENDING
    
    @property
    def is_validating(self):
        """Check if validation is in progress"""
        return self.authentication_status == self.AuthStatus.VALIDATING


class CustomUser(AbstractUser):
    role = models.CharField(max_length=32, blank=True, null=True,default='user')
    is_verified = models.BooleanField(default=False)
    # db stores id in company_id
    company=models.ForeignKey(to=Company,on_delete=models.CASCADE,null=True,blank=True,related_name='users')
    
    class Meta:
        db_table = 'custom_user'
    
    def __str__(self):
        return self.username


class Branch(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='branches'
    )

    branch_code = models.CharField(
        max_length=50,
        unique=True
    )

    branch_name = models.CharField(
        max_length=100
    )

    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)

    # who created this branch
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branches_created'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branch'
        unique_together = ['company', 'branch_code']
        indexes = [
            models.Index(fields=['company', 'branch_code']),
        ]

    def __str__(self):
        return f"{self.branch_name} ({self.company.company_name})"


class TransactionData(models.Model):
    # Payment Mode Choices
    class PaymentMode(models.IntegerChoices):
        CASH = 0, 'Cash'
        UPI = 1, 'UPI'
    
    request_type      = models.CharField(max_length=20, null=True, blank=True)
    device_id         = models.CharField(max_length=20, null=True, blank=True)
    trip_number       = models.CharField(max_length=20, null=True, blank=True)
    ticket_number     = models.CharField(max_length=20, null=True, blank=True)
    ticket_date       = models.DateField(null=True, blank=True)
    ticket_time       = models.TimeField(null=True, blank=True)

    from_stage        = models.IntegerField(null=True, blank=True)
    to_stage          = models.IntegerField(null=True, blank=True)

    ticket_type       = models.CharField(max_length=10, null=True, blank=True)

    full_count        = models.IntegerField(default=0)
    half_count        = models.IntegerField(default=0)
    st_count          = models.IntegerField(default=0)
    phy_count         = models.IntegerField(default=0)
    lugg_count        = models.IntegerField(default=0)

    total_tickets     = models.IntegerField(default=0)

    ticket_amount     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    lugg_amount       = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    adjust_amount     = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    pass_id           = models.CharField(max_length=20, null=True, blank=True)
    warrant_amount    = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    refund_status     = models.CharField(max_length=5, null=True, blank=True)
    refund_amount     = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    ladies_count      = models.IntegerField(default=0)
    senior_count      = models.IntegerField(default=0)

    transaction_id    = models.CharField(max_length=50, null=True, blank=True)

    ticket_status     = models.IntegerField(
        choices=PaymentMode.choices,
        default=PaymentMode.CASH,
        null=True,
        blank=True
    )

    reference_number  = models.CharField(max_length=50, null=True, blank=True)

    company_code = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='transactions',
        db_index=True,
        null=True,
        blank=True
    )

    branch_code = models.ForeignKey(
        'Branch',
        on_delete=models.SET_NULL,
        related_name='transactions',
        null=True,
        blank=True
    )

    raw_payload       = models.TextField()

    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "transaction_data"
        indexes = [
            models.Index(fields=["device_id", "ticket_date"]),
            models.Index(fields=["company_code"]),
            models.Index(fields=["branch_code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'device_id',
                    'trip_number',
                    'ticket_number',
                    'ticket_date',
                    'ticket_time',
                ],
                name='uniq_device_trip_ticket_datetime'
            )
        ]

    def __str__(self):
        return f"{self.ticket_number} - {self.device_id}"
    
    @property
    def calculate_total_tickets(self):
        """Calculate total tickets from all count fields"""
        counts = [
            self.full_count or 0,
            self.half_count or 0,
            self.st_count or 0,
            self.phy_count or 0,
            self.lugg_count or 0
        ]
        return sum(counts)


class TripCloseData(models.Model):  
    palmtec_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Device identifier (PalmtecID)"
    )
    
    company_code = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='trips',
        db_index=True,
        null=True,
        blank=True,
        help_text="Company code"
    )

    # NEW: Branch foreign key
    branch_code = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        related_name='trip_closes',
        null=True,
        blank=True,
        help_text="Branch code"
    )
    
    schedule = models.IntegerField(
        help_text="Schedule number"
    )
    
    trip_no = models.IntegerField(
        help_text="Trip number"
    )
    
    route_code = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Route code"
    )
    
    up_down_trip = models.CharField(
        max_length=1,
        help_text="Trip direction indicator (U/D)"
    )
    
    # NEW: Separate date and time fields for efficient querying
    start_date = models.DateField(
        db_index=True,
        null=True,
        blank=True,
        help_text="Trip start date (extracted from start_datetime)"
    )
    
    start_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Trip start time (extracted from start_datetime)"
    )
    
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Trip end date (extracted from end_datetime)"
    )
    
    end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Trip end time (extracted from end_datetime)"
    )
    
    start_datetime = models.DateTimeField(
        db_index=True,
        help_text="Trip start date and time"
    )
    
    end_datetime = models.DateTimeField(
        help_text="Trip end date and time"
    )
    
    start_ticket_no = models.BigIntegerField(
        help_text="Starting ticket number (lSTicketNo)"
    )
    
    end_ticket_no = models.BigIntegerField(
        help_text="Ending ticket number (lETicketNo)"
    )
    
    full_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Full fare passengers (sFull + uFull)"
    )
    
    half_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Half fare passengers (sHalf + uChild)"
    )
    
    st1_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="ST1 type passengers (sST1 + uSTCount)"
    )
    
    luggage_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Luggage count (sLugg + uLugg)"
    )
    
    physical_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Physical handicap passengers (sPhy + uPhy)"
    )
    
    pass_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Pass holders (sPass)"
    )
    
    ladies_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Ladies passengers (sLadies + uLadies)"
    )
    
    senior_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Senior citizen passengers (sSenior + uSenior)"
    )

    # NEW: Total tickets field (sum of all passenger counts)
    total_tickets = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Total tickets issued (sum of all counts including pass)"
    )

    # NEW: Cash tickets breakdown
    total_cash_tickets = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Total cash tickets (total_tickets - upi_ticket_count)"
    )
    
    full_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Full fare collection (fFullColl + uFullColl)"
    )
    
    half_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Half fare collection (fHalfColl + uChildColl)"
    )
    
    st_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="ST collection (fSTColl + uSTColl)"
    )
    
    luggage_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Luggage collection (fLuggageColl + uLuggColl)"
    )
    
    physical_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Physical handicap collection (fPhyColl + uPhyColl)"
    )
    
    ladies_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Ladies collection (fLadiColl + uLadiesColl)"
    )
    
    senior_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Senior collection (fSeniorColl + uSeniorColl)"
    )
    
    adjust_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Adjustment collection (fAdjustColl) - can be negative"
    )
    
    expense_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Expense amount (fExpenseAmount)"
    )
    
    total_collection = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total collection (fTotalColl)"
    )

    # NEW: Cash amount breakdown
    total_cash_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total cash collection (total_collection - upi_ticket_amount)"
    )
    
    upi_ticket_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="UPI ticket count (sUpiTicketCount)"
    )
    
    upi_ticket_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="UPI ticket amount (fUPITicketAmount)"
    )
    
    received_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When server received this data"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Record creation timestamp"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Record last update timestamp"
    )
    
    class Meta:
        db_table = 'trip_close_data'
        verbose_name = 'Trip Close Data'
        verbose_name_plural = 'Trip Close Datas'
        
        indexes = [
            models.Index(fields=['palmtec_id', 'start_datetime']),
            models.Index(fields=['route_code', 'start_datetime']),
            models.Index(fields=['start_datetime']),
            models.Index(fields=["company_code"]),
            models.Index(fields=['start_date']),  # NEW: Date index
            models.Index(fields=['company_code', 'start_date']),  # NEW: Combined index
            models.Index(fields=['branch_code']),  # NEW: Branch index
        ]
        
        unique_together = [
            ['palmtec_id', 'schedule', 'trip_no', 'start_datetime']
        ]
        
        ordering = ['-start_datetime']
    
    def __str__(self):
        return f"Trip {self.trip_no} - {self.route_code} - {self.palmtec_id} ({self.start_datetime})"
    
    def get_total_passengers(self):
        """Calculate total passengers including pass holders"""
        return (
            self.full_count + 
            self.half_count + 
            self.st1_count + 
            self.physical_count + 
            self.pass_count + 
            self.ladies_count + 
            self.senior_count
        )
    
    def get_total_tickets_issued(self):
        """Calculate total tickets issued from ticket number range"""
        if self.end_ticket_no and self.start_ticket_no:
            return self.end_ticket_no - self.start_ticket_no + 1
        return 0

    # NEW: Backup calculation properties
    @property
    def calculate_total_tickets(self):
        """Calculate total tickets from all passenger counts"""
        return (
            self.full_count + 
            self.half_count + 
            self.st1_count + 
            self.luggage_count + 
            self.physical_count + 
            self.pass_count + 
            self.ladies_count + 
            self.senior_count
        )

    @property
    def calculate_cash_tickets(self):
        """Calculate cash tickets (total - upi)"""
        return max(0, self.total_tickets - self.upi_ticket_count)

    @property
    def calculate_cash_amount(self):
        """Calculate cash amount (total - upi)"""
        return max(Decimal('0.00'), self.total_collection - self.upi_ticket_amount)
    

# For reconciliation with TransactionData (bus tickets).
# Requires MANUAL VERIFICATION by managers before settlement.
class MosambeeTransaction(models.Model):
    class ProcessingStatus(models.TextChoices):
        RECEIVED = 'RECEIVED', 'Received'
        VALIDATING = 'VALIDATING', 'Validating'
        VALIDATED = 'VALIDATED', 'Validated'
        VALIDATION_FAILED = 'VALIDATION_FAILED', 'Validation Failed'
        RECONCILING = 'RECONCILING', 'Reconciling'
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending Verification'
        FAILED = 'FAILED', 'Failed'
    
    class VerificationStatus(models.TextChoices):
        UNVERIFIED = 'UNVERIFIED', 'Unverified'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'
        FLAGGED = 'FLAGGED', 'Flagged for Review'
        DISPUTED = 'DISPUTED', 'Disputed'
    
    class ReconciliationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        AUTO_MATCHED = 'AUTO_MATCHED', 'Auto-Matched'
        AMOUNT_MISMATCH = 'AMOUNT_MISMATCH', 'Amount Mismatch'
        NOT_FOUND = 'NOT_FOUND', 'Ticket Not Found'
        DUPLICATE = 'DUPLICATE', 'Duplicate Payment'
        MANUAL_MATCH = 'MANUAL_MATCH', 'Manually Matched'
    
    processing_status = models.CharField(
        max_length=30,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.RECEIVED,
        db_index=True
    )
    
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNVERIFIED,
        db_index=True
    )
    
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_mosambee_transactions'
    )
    
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(null=True, blank=True)
    
    checksum_received = models.CharField(max_length=512)
    checksum_calculated = models.CharField(max_length=512, null=True, blank=True)
    is_checksum_valid = models.BooleanField(default=False, db_index=True)
    validation_error = models.TextField(null=True, blank=True)
    
    related_ticket = models.ForeignKey(
        'TransactionData',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_transactions'
    )
    
    reconciliation_status = models.CharField(
        max_length=20,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.PENDING,
        db_index=True
    )
    
    reconciliation_error = models.TextField(null=True, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    
    manually_reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manually_reconciled_transactions'
    )
    
    settlement_batch_id = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    settlement_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    repost_count = models.IntegerField(default=0)
    first_received_at = models.DateTimeField(auto_now_add=True)
    last_received_at = models.DateTimeField(auto_now=True)
    
    name = models.CharField(max_length=45)
    merchantId = models.CharField(max_length=45, db_index=True)
    businessName = models.CharField(max_length=100, null=True, blank=True)
    addressLine1 = models.CharField(max_length=255, null=True, blank=True)
    addressLine2 = models.CharField(max_length=255, null=True, blank=True)
    
    transaction_date = models.DateField(db_index=True)
    transaction_time = models.TimeField()
    transaction_datetime = models.DateTimeField(db_index=True)
    
    transactionLat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    transactionLong = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    transactionSTAN = models.CharField(max_length=6, null=True, blank=True)
    transactionRRN = models.CharField(max_length=50, db_index=True)
    transactionID = models.BigIntegerField(unique=True, db_index=True)
    tgTransactionId = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    
    transactionAmount = models.DecimalField(max_digits=15, decimal_places=2)
    cashBack = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tipAmount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    responseCode = models.CharField(max_length=6, db_index=True)
    transactionStatus = models.CharField(max_length=100)
    transactionAuthCode = models.CharField(max_length=60, null=True, blank=True)
    
    transactionCardNumber = models.CharField(max_length=16)
    cardHolderName = models.CharField(max_length=150, null=True, blank=True)
    cardType = models.CharField(max_length=45)
    creditDebitCardType = models.CharField(max_length=15, null=True, blank=True)
    
    transactionTerminalId = models.CharField(max_length=20, db_index=True)
    transactionBatchNumber = models.IntegerField(null=True, blank=True)
    appVersion = models.CharField(max_length=10, null=True, blank=True)
    
    invoiceNumber = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    billNumber = models.CharField(max_length=100, null=True, blank=True)
    refTxnId = models.CharField(max_length=45, null=True, blank=True)
    
    transactionTypeId = models.IntegerField()
    transactionTypeName = models.CharField(max_length=25, null=True, blank=True)
    currencyId = models.CharField(max_length=5)
    acquirerName = models.CharField(max_length=50)
    narration = models.CharField(max_length=100, null=True, blank=True)
    
    aid = models.CharField(max_length=50, null=True, blank=True)
    ici = models.CharField(max_length=5, null=True, blank=True)
    apn = models.CharField(max_length=55, null=True, blank=True)
    appLabel = models.CharField(max_length=60, null=True, blank=True)
    tvr = models.CharField(max_length=10, null=True, blank=True)
    tsi = models.CharField(max_length=4, null=True, blank=True)
    ac = models.CharField(max_length=20, null=True, blank=True)
    cid = models.CharField(max_length=2, null=True, blank=True)
    cvm = models.CharField(max_length=6, null=True, blank=True)
    
    tipProcessing = models.BooleanField(default=False)
    transactionMode = models.CharField(max_length=10, null=True, blank=True)
    MsrAndPinVerification = models.BooleanField(default=False)
    
    raw_request_data = models.JSONField()
    response_sent_to_mosambee = models.JSONField(null=True, blank=True)
    manager_notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'mosambee_transaction'
        verbose_name = 'Mosambee Payment Transaction'
        verbose_name_plural = 'Mosambee Payment Transactions'
        indexes = [
            models.Index(fields=['transaction_date']),
            models.Index(fields=['-transaction_datetime']),
            models.Index(fields=['verification_status', 'transaction_date']),
            models.Index(fields=['verification_status', 'merchantId']),
            models.Index(fields=['processing_status', 'transaction_date']),
            models.Index(fields=['reconciliation_status']),
            models.Index(fields=['invoiceNumber']),
            models.Index(fields=['transactionRRN']),
            models.Index(fields=['settlement_batch_id']),
            models.Index(fields=['merchantId', 'transaction_date']),
            models.Index(fields=['responseCode', 'transaction_date']),
            models.Index(fields=['is_checksum_valid', 'processing_status']),
            models.Index(fields=['transactionTerminalId', 'transaction_date']),
        ]
        ordering = ['-transaction_datetime']
    
    def __str__(self):
        return f"[{self.verification_status}] TXN-{self.transactionID} | Ticket-{self.invoiceNumber} | ₹{self.transactionAmount}"
    
    @property
    def is_payment_successful(self):
        return self.responseCode in ['0', '00', '000']
    
    @property
    def is_ready_for_settlement(self):
        return (
            self.verification_status == self.VerificationStatus.VERIFIED and
            self.is_payment_successful and
            self.settlement_batch_id is None
        )
    
    @property
    def needs_manager_attention(self):
        return (
            self.verification_status == self.VerificationStatus.UNVERIFIED or
            self.verification_status == self.VerificationStatus.FLAGGED or
            not self.is_checksum_valid or
            self.reconciliation_status in [
                self.ReconciliationStatus.AMOUNT_MISMATCH,
                self.ReconciliationStatus.NOT_FOUND,
                self.ReconciliationStatus.DUPLICATE
            ]
        )
    
    @property
    def display_status_for_ui(self):
        if not self.is_checksum_valid:
            return "⚠️ Security Check Failed"
        if not self.is_payment_successful:
            return "❌ Payment Declined"
        if self.verification_status == self.VerificationStatus.VERIFIED:
            return "✅ Verified"
        if self.verification_status == self.VerificationStatus.REJECTED:
            return "❌ Rejected"
        if self.verification_status == self.VerificationStatus.FLAGGED:
            return "🚩 Flagged"
        if self.reconciliation_status == self.ReconciliationStatus.AMOUNT_MISMATCH:
            return "⚠️ Amount Mismatch"
        if self.reconciliation_status == self.ReconciliationStatus.NOT_FOUND:
            return "⚠️ No Matching Ticket"
        return "⏳ Awaiting Verification"
    
    def get_total_amount(self):
        return self.transactionAmount + self.cashBack + self.tipAmount
    
    def can_be_verified_by(self, user):
        return (
            user.is_authenticated and
            user.role in ['manager', 'admin', 'super_admin'] and
            self.verification_status == self.VerificationStatus.UNVERIFIED
        )
