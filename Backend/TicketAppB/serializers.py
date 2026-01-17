from rest_framework import serializers
from .models import Company,CustomUser,TransactionData,TripCloseData,Branch,MosambeeTransaction

class CompanySerializer(serializers.ModelSerializer):
    # Read-only fields that are computed or set by system
    is_validated = serializers.ReadOnlyField()
    needs_validation = serializers.ReadOnlyField()
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Company
        fields = [
            'id',
            'company_id',
            'company_name',
            'company_email',
            'gst_number',
            'contact_person',
            'contact_number',
            'address',
            'address_2',
            'city',
            'state',
            'zip_code',
            'number_of_licence',
            'authentication_status',
            'product_registration_id',
            'unique_identifier',
            'product_from_date',
            'product_to_date',
            'project_code',
            'device_count',
            'branch_count',
            'created_at',
            'updated_at',
            'is_validated',
            'needs_validation',
            'created_by',
        ]
        read_only_fields = [
            'id',
            'company_id',
            'authentication_status',
            'product_registration_id',
            'unique_identifier',
            'product_from_date',
            'product_to_date',
            'project_code',
            'device_count',
            'branch_count',
            'created_at',
            'updated_at',
            'created_by',
        ]
    
    def validate_company_email(self, value):
        """Ensure email is unique (except for current instance in update)"""
        if self.instance:
            # Update case: allow same email for current instance
            if Company.objects.exclude(pk=self.instance.pk).filter(company_email=value).exists():
                raise serializers.ValidationError("A company with this email already exists.")
        else:
            # Create case: ensure email doesn't exist
            if Company.objects.filter(company_email=value).exists():
                raise serializers.ValidationError("A company with this email already exists.")
        return value
    
    def validate_number_of_licence(self, value):
        """Ensure license count is positive"""
        if value < 1:
            raise serializers.ValidationError("Number of licenses must be at least 1.")
        return value
    
    def validate_contact_number(self, value):
        """Basic phone number validation"""
        # Remove common formatting characters
        cleaned = value.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
        if not cleaned.isdigit():
            raise serializers.ValidationError("Contact number must contain only digits and basic formatting characters.")
        if len(cleaned) < 10:
            raise serializers.ValidationError("Contact number must be at least 10 digits.")
        return value


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model=CustomUser
        fields='__all__'


class TicketDataSerializer(serializers.ModelSerializer):
    # Ticket type mapping for display
    TICKET_TYPE_MAPPING = {
        '0': 'Full',
        '1': 'Half',
        '2': 'Student',
        '3': 'Physical',
        '4': 'Luggage'
    }
    
    # Add display fields
    payment_mode_display = serializers.SerializerMethodField()
    ticket_type_display = serializers.SerializerMethodField()
    formatted_ticket_date = serializers.SerializerMethodField()

    class Meta:
        model = TransactionData
        fields = [
            'id',
            'request_type',
            'device_id',
            'trip_number',
            'ticket_number',
            'ticket_date',
            'formatted_ticket_date',
            'ticket_time',
            'from_stage',
            'to_stage',
            'ticket_type',
            'ticket_type_display',
            'full_count',
            'half_count',
            'st_count',
            'phy_count',
            'lugg_count',
            'total_tickets',
            'ticket_amount',
            'lugg_amount',
            'adjust_amount',
            'pass_id',
            'warrant_amount',
            'refund_status',
            'refund_amount',
            'ladies_count',
            'senior_count',
            'transaction_id',
            'ticket_status',
            'payment_mode_display',
            'reference_number',
            'branch_code',
            'created_at',
            # EXCLUDED: raw_payload, company_code
        ]
    
    def get_payment_mode_display(self, obj):
        """Convert ticket_status integer to display string"""
        if obj.ticket_status == 0:
            return "Cash"
        elif obj.ticket_status == 1:
            return "UPI"
        return "Unknown"
    
    def get_ticket_type_display(self, obj):
        """Convert ticket_type code to display string"""
        if obj.ticket_type and obj.ticket_type in self.TICKET_TYPE_MAPPING:
            return self.TICKET_TYPE_MAPPING[obj.ticket_type]
        elif obj.ticket_type:
            return obj.ticket_type
        return "Unknown"
    
    def get_formatted_ticket_date(self, obj):
        """Format date as DD-MM-YYYY for frontend display"""
        if obj.ticket_date:
            return obj.ticket_date.strftime('%d-%m-%Y')
        return None


class TripCloseDataSerializer(serializers.ModelSerializer):
    # Computed fields
    total_passengers = serializers.SerializerMethodField()
    total_tickets_issued = serializers.SerializerMethodField()
    
    # Formatted date fields
    formatted_start_date = serializers.SerializerMethodField()
    formatted_end_date = serializers.SerializerMethodField()

    class Meta:
        model = TripCloseData
        fields = [
            "id",
            "palmtec_id",
            # EXCLUDED: company_code
            "branch_code",  
            "schedule",
            "trip_no",
            "route_code",
            "up_down_trip",
            
            # Separate date and time fields
            "start_date",
            "start_time",
            "end_date",
            "end_time",
            
            # Formatted dates for display
            "formatted_start_date",
            "formatted_end_date",
            
            # DateTime fields (keep for complete timestamp)
            "start_datetime",
            "end_datetime",
            
            "start_ticket_no",
            "end_ticket_no",

            # Passenger counts (these include both cash + upi combined)
            "full_count",
            "half_count",
            "st1_count",
            "luggage_count",
            "physical_count",
            "pass_count",
            "ladies_count",
            "senior_count",

            # Total and cash/upi breakdown
            "total_tickets",
            "total_cash_tickets",
            "upi_ticket_count",  # Same as total UPI tickets

            # Collections
            "full_collection",
            "half_collection",
            "st_collection",
            "luggage_collection",
            "physical_collection",
            "ladies_collection",
            "senior_collection",
            "adjust_collection",
            "expense_amount",
            "total_collection",

            # Cash/UPI amount breakdown
            "total_cash_amount",
            "upi_ticket_amount",  # Same as total UPI amount

            # Derived fields
            "total_passengers",
            "total_tickets_issued",

            # Timestamps
            "received_at",
            "created_at",
        ]

    def get_total_passengers(self, obj):
        """Get total passengers using model method"""
        return obj.get_total_passengers()

    def get_total_tickets_issued(self, obj):
        """Get total tickets issued from ticket number range"""
        return obj.get_total_tickets_issued()

    def get_formatted_start_date(self, obj):
        """Format start_date as DD-MM-YYYY"""
        if obj.start_date:
            return obj.start_date.strftime('%d-%m-%Y')
        return None

    def get_formatted_end_date(self, obj):
        """Format end_date as DD-MM-YYYY"""
        if obj.end_date:
            return obj.end_date.strftime('%d-%m-%Y')
        return None
    

class BranchSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model=Branch
        fields=[
            'id',
            'company',
            'branch_code',
            'branch_name',
            'address',
            'city',
            'state',
            'zip_code',
            'is_active',
            'created_by'
        ]
        read_only_fields=[
            'id',
            'company',
            'is_active',
            'created_by',
        ]



class MosambeeTransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for Mosambee payment transactions.
    Used for settlement verification interface.
    """
    # Related ticket information
    related_ticket_number = serializers.SerializerMethodField()
    related_ticket_amount = serializers.SerializerMethodField()
    related_ticket_date = serializers.SerializerMethodField()
    
    # Display fields
    payment_status_display = serializers.SerializerMethodField()
    formatted_transaction_date = serializers.SerializerMethodField()
    needs_attention = serializers.SerializerMethodField()
    
    # Verification info
    verified_by_username = serializers.SerializerMethodField()
    
    class Meta:
        model = MosambeeTransaction
        fields = [
            # IDs
            'id',
            'transactionID',
            'transactionRRN',
            'merchantId',
            
            # Date/Time
            'transaction_date',
            'formatted_transaction_date',
            'transaction_time',
            'transaction_datetime',
            
            # Financial
            'transactionAmount',
            'cashBack',
            'tipAmount',
            
            # Status fields
            'processing_status',
            'verification_status',
            'reconciliation_status',
            'responseCode',
            'transactionStatus',
            'payment_status_display',
            
            # References
            'invoiceNumber',
            'billNumber',
            
            # Related ticket info
            'related_ticket_number',
            'related_ticket_amount',
            'related_ticket_date',
            
            # Card/Terminal
            'transactionCardNumber',
            'cardType',
            'cardHolderName',
            'transactionTerminalId',
            'acquirerName',
            
            # Location
            'businessName',
            'addressLine1',
            
            # Checksum
            'is_checksum_valid',
            'validation_error',
            
            # Reconciliation
            'reconciliation_error',
            'reconciled_at',
            
            # Verification
            'verified_by_username',
            'verified_at',
            'verification_notes',
            
            # Computed
            'needs_attention',
            
            # Settlement
            'settlement_batch_id',
            'settled_at',
            
            # Reposting
            'repost_count',
            
            # Timestamps
            'first_received_at',
            'last_received_at',
            'created_at',
        ]
    
    def get_related_ticket_number(self, obj):
        """Get ticket number if related ticket exists"""
        if obj.related_ticket:
            return obj.related_ticket.ticket_number
        return None
    
    def get_related_ticket_amount(self, obj):
        """Get ticket amount if related ticket exists"""
        if obj.related_ticket:
            return str(obj.related_ticket.ticket_amount)
        return None
    
    def get_related_ticket_date(self, obj):
        """Get ticket date if related ticket exists"""
        if obj.related_ticket:
            return obj.related_ticket.ticket_date.strftime('%d-%m-%Y')
        return None
    
    def get_payment_status_display(self, obj):
        """Convert response code to display string"""
        if obj.responseCode in ['0', '00', '000']:
            return "Approved"
        return "Declined"
    
    def get_formatted_transaction_date(self, obj):
        """Format date as DD-MM-YYYY"""
        if obj.transaction_date:
            return obj.transaction_date.strftime('%d-%m-%Y')
        return None
    
    def get_needs_attention(self, obj):
        """Check if transaction needs manager attention"""
        return obj.needs_manager_attention
    
    def get_verified_by_username(self, obj):
        """Get username of verifier"""
        if obj.verified_by:
            return obj.verified_by.username
        return None


class SettlementVerificationSerializer(serializers.Serializer):
    """
    Serializer for settlement verification actions.
    Used when manager verifies/rejects transactions.
    """
    transaction_id = serializers.IntegerField(required=True)
    verification_status = serializers.ChoiceField(
        choices=['VERIFIED', 'REJECTED', 'FLAGGED'],
        required=True
    )
    verification_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000
    )
    
    def validate_transaction_id(self, value):
        """Ensure transaction exists"""
        try:
            MosambeeTransaction.objects.get(id=value)
        except MosambeeTransaction.DoesNotExist:
            raise serializers.ValidationError("Transaction not found")
        return value