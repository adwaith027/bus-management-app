from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.conf import settings
from .company import Company,Branch

# Transaction models (TransactionData, TripCloseData)

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

    # 0 for cash and 1 for upi
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

    # Branch foreign key
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
    
    # Separate date and time fields for efficient querying
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

    # Total tickets field (sum of all passenger counts)
    total_tickets = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Total tickets issued (sum of all counts including pass)"
    )

    # Cash tickets breakdown
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

    # Cash amount breakdown
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
            models.Index(fields=['start_date']),  # Date index
            models.Index(fields=['company_code', 'start_date']),  # Combined index
            models.Index(fields=['branch_code']),  # Branch index
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

    # Backup calculation properties
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