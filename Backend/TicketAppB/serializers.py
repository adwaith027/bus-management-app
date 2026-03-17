from rest_framework import serializers
from .models import Company,CustomUser,Depot
from .models import TransactionData,TripCloseData,MosambeeTransaction
from .models import DealerCustomerMapping,ExecutiveCompanyMapping,UserDeviceMapping
from .models import Dealer,CrewAssignment,BusType,EmployeeType,Stage,Currency,Employee,VehicleType
from .models import RouteStage,Route,Settings,RouteBusType,Fare

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
            'device_count',
            'depot_count',
            'mobile_device_count',
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
            'device_count',
            'depot_count',
            'mobile_device_count',
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


class UserDeviceMappingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    company_name = serializers.CharField(source='user.company.company_name', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = UserDeviceMapping
        fields = [
            'id',
            'user',
            'username',
            'company_name',
            'username_snapshot',
            'device_uid',
            'device_type',
            'user_agent',
            'status',
            'is_active',
            'approved_by',
            'approved_by_username',
            'approved_at',
            'last_seen_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class DealerSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Dealer
        fields = [
            'id',
            'dealer_code',
            'dealer_name',
            'contact_person',
            'contact_number',
            'email',
            'address',
            'city',
            'state',
            'zip_code',
            'gst_number',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
        ]


class DealerCustomerMappingSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DealerCustomerMapping
        fields = [
            'id',
            'dealer',
            'company',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        dealer = attrs.get('dealer') or getattr(self.instance, 'dealer', None)
        company = attrs.get('company') or getattr(self.instance, 'company', None)
        if dealer and company:
            existing = DealerCustomerMapping.objects.filter(dealer=dealer, company=company)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("This dealer is already mapped to the selected company.")
        return attrs


class ExecutiveCompanyMappingSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ExecutiveCompanyMapping
        fields = [
            'id',
            'executive_user',
            'company',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        executive_user = attrs.get('executive_user') or getattr(self.instance, 'executive_user', None)
        company = attrs.get('company') or getattr(self.instance, 'company', None)
        if executive_user and executive_user.role != 'executive_user':
            raise serializers.ValidationError("Selected user is not an executive_user.")
        if executive_user and company:
            existing = ExecutiveCompanyMapping.objects.filter(executive_user=executive_user, company=company)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError("This executive user is already mapped to the selected company.")
        return attrs


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
            'depot_code',
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
            "depot_code",  
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
    

class DepotSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model=Depot
        fields=[
            'id',
            'company',
            'depot_code',
            'depot_name',
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
    


# =============================================================================
# MASTER DATA SERIALIZERS
# Append these to the bottom of your existing serializers.py
# Also add these imports at the top of serializers.py:
#   from .models import (BusType, EmployeeType, Employee, Currency,
#                        Stage, Route, RouteStage, VehicleType,
#                        Settings, CrewAssignment)
# =============================================================================


# -----------------------------------------------------------------------------
# SECTION 1 — Simple lookup/master tables
# BusType, EmployeeType, Stage, Currency
# These are the simplest — just code + name, scoped to a company.
# -----------------------------------------------------------------------------

class BusTypeSerializer(serializers.ModelSerializer):
    # company and audit fields are set by the view, never by the frontend
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = BusType
        fields = [
            'id',
            'bustype_code',
            'name',
            'is_active',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at']


class EmployeeTypeSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = EmployeeType
        fields = [
            'id',
            'emp_type_code',
            'emp_type_name',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at']


class StageSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = Stage
        fields = [
            'id',
            'stage_code',
            'stage_name',
            'is_deleted',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at']


class CurrencySerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = Currency
        fields = [
            'id',
            'currency',
            'country',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at']


# -----------------------------------------------------------------------------
# SECTION 2 — Employee (has a FK to EmployeeType)
# The frontend sends emp_type as an integer ID.
# DRF's PrimaryKeyRelatedField handles the lookup automatically.
# password here is the device PIN, not a Django auth password.
# -----------------------------------------------------------------------------

class EmployeeSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    # We also expose the type name as a read-only display field
    # so the frontend table can show "Driver" instead of just ID 3
    emp_type_name = serializers.CharField(source='emp_type.emp_type_name', read_only=True)

    class Meta:
        model  = Employee
        fields = [
            'id',
            'employee_code',
            'employee_name',
            'emp_type',        # writable FK — frontend sends the ID
            'emp_type_name',   # read-only display label
            'phone_no',
            'password',        # device PIN, visible to company admin
            'is_deleted',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at', 'emp_type_name']

    def validate_emp_type(self, value):
        """
        Ensure the chosen EmployeeType belongs to the same company.
        We get the company from the serializer context, which the view must pass in.
        Usage in view: EmployeeSerializer(data=request.data, context={'company': user.company})
        """
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected employee type does not belong to your company.")
        return value


# -----------------------------------------------------------------------------
# SECTION 3 — Vehicle (has a FK to BusType)
# Same pattern as Employee — frontend sends bus_type as an ID.
# bus_type_name is added as a read-only display label for the table.
# -----------------------------------------------------------------------------

class VehicleTypeSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    bus_type_name = serializers.CharField(source='bus_type.name', read_only=True)

    class Meta:
        model  = VehicleType
        fields = [
            'id',
            'bus_reg_num',
            'bus_type',         # writable FK
            'bus_type_name',    # read-only display label
            'is_deleted',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at', 'bus_type_name']

    def validate_bus_type(self, value):
        """Ensure the chosen BusType belongs to this company."""
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected bus type does not belong to your company.")
        return value


# -----------------------------------------------------------------------------
# SECTION 4 — Route
# RouteStageSerializer and RouteBusTypeSerializer are defined below (SECTION 4b)
# before RouteSerializer so Python can reference them when building RouteSerializer.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# SECTION 5 — CrewAssignment
# Links driver + conductor + cleaner + vehicle.
# All 4 are FK fields — frontend sends IDs.
# Display labels added for the listing table.
# The VIEW is responsible for validating emp_type matches the role
# (driver must be DRIVER type, etc.) — kept out of serializer for simplicity.
# -----------------------------------------------------------------------------

class CrewAssignmentSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    # Read-only display labels for the listing table
    driver_name    = serializers.CharField(source='driver.employee_name', read_only=True)
    conductor_name = serializers.CharField(source='conductor.employee_name', read_only=True)
    cleaner_name   = serializers.CharField(source='cleaner.employee_name', read_only=True)
    vehicle_reg    = serializers.CharField(source='vehicle.bus_reg_num', read_only=True)

    class Meta:
        model  = CrewAssignment
        fields = [
            'id',
            'driver',           # writable FK
            'driver_name',
            'conductor',        # writable FK (nullable)
            'conductor_name',
            'cleaner',          # writable FK (nullable)
            'cleaner_name',
            'vehicle',          # writable FK
            'vehicle_reg',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'company', 'created_by', 'updated_by',
            'created_at', 'updated_at',
            'driver_name', 'conductor_name', 'cleaner_name', 'vehicle_reg',
        ]


# -----------------------------------------------------------------------------
# SECTION 6 — Settings (OneToOne with Company)
# Only one record per company — no create from frontend, only get + update.
# All fields are writable except the system ones.
# Grouped here the same way the model groups them.
# -----------------------------------------------------------------------------

class SettingsSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = Settings
        fields = [
            'id',

            # Fare percentages
            'half_per',
            'con_per',
            'st_max_amt',
            'st_min_con',
            'phy_per',
            'round_amt',
            'luggage_unit_rate',

            # Display / ticket header-footer
            'main_display',
            'main_display2',
            'header1',
            'header2',
            'header3',
            'footer1',
            'footer2',

            # Device identifier
            'palmtec_id',

            # Boolean feature flags
            'roundoff',
            'round_up',
            'remove_ticket_flag',
            'stage_font_flag',
            'next_fare_flag',
            'odometer_entry',
            'ticket_no_big_font',
            'crew_check',
            'gprs_enable',
            'tripsend_enable',
            'schedulesend_enable',
            'sendpend',
            'inspect_rpt',
            'st_roundoff_enable',
            'st_fare_edit',
            'multiple_pass',
            'simple_report',
            'inspector_sms',
            'auto_shut_down',
            'userpswd_enable',

            # Integer settings
            'report_flag',
            'language_option',
            'stage_updation_msg',
            'default_stage',
            'report_font',
            'st_roundoff_amt',

            # Communication / FTP
            'ph_no2',
            'ph_no3',
            'access_point',
            'dest_adds',
            'username',
            'password',
            'uploadpath',
            'downloadpath',
            'http_url',

            # String feature flags
            'smart_card',
            'exp_enable',
            'ftp_enable',
            'gprs_enable_message',
            'sendbill_enable',

            # Passwords & currency
            'user_pwd',
            'master_pwd',
            'currency',

            # Audit
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at']



# -----------------------------------------------------------------------------
# SECTION 4b — Route supporting serializers
# These must be defined BEFORE RouteSerializer since it references them.
# -----------------------------------------------------------------------------

class RouteStageSerializer(serializers.ModelSerializer):
    """
    Serializer for RouteStage records (stops on a route).
    Used for inline display within Route forms and FareEditor.
    stage_code is needed by FareEditor matrix headers.
    validate_stage ensures stages belong to the same company.
    """
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    stage_name = serializers.CharField(source='stage.stage_name', read_only=True)
    stage_code = serializers.CharField(source='stage.stage_code', read_only=True)

    class Meta:
        model = RouteStage
        fields = [
            'id',
            'stage',           # writable FK (frontend sends stage ID)
            'stage_name',      # read-only display — used in RouteListing and FareEditor
            'stage_code',      # read-only display — used in FareEditor matrix headers
            'sequence_no',
            'distance',
            'stage_local_lang',
            'company',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'created_at', 'updated_at', 'stage_name', 'stage_code']

    def validate_stage(self, value):
        """Ensure the chosen Stage belongs to this company."""
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected stage does not belong to your company.")
        return value


class RouteBusTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for RouteBusType records (allowed bus types per route).
    Frontend does not use this yet — kept ready for future use.
    """
    company       = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by    = serializers.PrimaryKeyRelatedField(read_only=True)
    bus_type_code = serializers.CharField(source='bus_type.bustype_code', read_only=True)
    bus_type_name = serializers.CharField(source='bus_type.name', read_only=True)

    class Meta:
        model = RouteBusType
        fields = [
            'id',
            'bus_type',
            'bus_type_code',
            'bus_type_name',
            'company',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company', 'created_by', 'created_at', 'updated_at', 'bus_type_code', 'bus_type_name']

    def validate_bus_type(self, value):
        """Ensure the chosen BusType belongs to this company."""
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected bus type does not belong to your company.")
        return value


class RouteSerializer(serializers.ModelSerializer):
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    bus_type_name = serializers.CharField(source='bus_type.name', read_only=True)
    route_stages  = RouteStageSerializer(many=True, read_only=True)
    route_bus_types = RouteBusTypeSerializer(many=True, read_only=True)  # future-ready

    class Meta:
        model  = Route
        fields = [
            'id',
            'route_code',
            'route_name',
            'min_fare',
            'fare_type',
            'bus_type',
            'bus_type_name',
            'use_stop',
            'half',
            'luggage',
            'student',
            'adjust',
            'conc',
            'ph',
            'start_from',
            'pass_allow',
            'is_deleted',
            'company',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
            'route_stages',    # used by RouteListing and FareEditor
            'route_bus_types', # future use
        ]
        read_only_fields = [
            'id', 'company', 'created_by', 'updated_by', 'created_at', 'updated_at',
            'bus_type_name', 'route_stages', 'route_bus_types',
        ]

    def validate_bus_type(self, value):
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected bus type does not belong to your company.")
        return value
    


class FareSerializer(serializers.ModelSerializer):
    """
    Serializer for Fare records (fare matrix - row/col based).
    Used for bulk fare table editing.
    """
    company    = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    route_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = Fare
        fields = [
            'id',
            'number',
            'row',
            'col',
            'fare_amount',
            'route',
            'route_name',
            'company',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'route_name', 'company', 'created_by', 'created_at', 'updated_at']
    
    def validate_route(self, value):
        """Ensure the route belongs to this company."""
        company = self.context.get('company')
        if company and value.company != company:
            raise serializers.ValidationError("Selected route does not belong to your company.")
        return value
