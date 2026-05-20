from decimal import Decimal
from rest_framework import serializers
from ..models import TransactionData, TripData, ScheduleData


class TicketDataSerializer(serializers.ModelSerializer):
    TICKET_TYPE_BITS = {
        1:  'Full',
        2:  'Half',
        4:  'Luggage',
        8:  'PH',
        16: 'Student',
    }

    ticket_type_display = serializers.SerializerMethodField()
    formatted_ticket_date = serializers.SerializerMethodField()
    route_code = serializers.SerializerMethodField()
    depot_code = serializers.SerializerMethodField()

    class Meta:
        model = TransactionData
        fields = [
            'id',
            'palmtec_id',
            'trip_number',
            'ticket_number',
            'ticket_date',
            'formatted_ticket_date',
            'ticket_time',
            'from_stage',
            'to_stage',
            'ticket_type',
            'ticket_type_display',
            'route_code',
            'depot_code',
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
            'reference_number',
            'up_down_trip',
            'created_at',
        ]

    def get_ticket_type_display(self, obj):
        try:
            val = int(obj.ticket_type)
        except (TypeError, ValueError):
            return obj.ticket_type or 'Unknown'
        labels = [label for bit, label in self.TICKET_TYPE_BITS.items() if val & bit]
        return ' + '.join(labels) if labels else 'Unknown'

    def get_formatted_ticket_date(self, obj):
        if obj.ticket_date:
            return obj.ticket_date.strftime('%d-%m-%Y')
        return None

    def get_route_code(self, obj):
        if obj.route_id:
            return obj.route_id.route_code
        return None

    def get_depot_code(self, obj):
        if not obj.route_id:
            return None
        rd = obj.route_id.route_depots.first()
        return rd.depot.depot_code if rd else None


class TripDataSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    route_code = serializers.SerializerMethodField()
    depot_code = serializers.SerializerMethodField()
    total_cash_amount = serializers.SerializerMethodField()

    class Meta:
        model = TripData
        fields = [
            'id',
            'palmtec_id',
            'trip_no',
            'schedule_no',
            'up_down_trip',
            'route_code',
            'depot_code',
            'status',
            'start_datetime',
            'end_datetime',
            'start_date',
            'start_ticket_no',
            'end_ticket_no',
            'total_tickets',
            'total_cash_tickets',
            'total_passengers',
            'upi_ticket_count',
            'upi_ticket_amount',
            'total_collection',
            'total_cash_amount',
            'total_km',
            'bus_no',
            'driver',
            'conductor',
            'expense_amount',
            'full_count',
            'half_count',
            'st_count',
            'luggage_count',
            'physical_count',
            'pass_count',
            'ladies_count',
            'senior_count',
            'full_collection',
            'half_collection',
            'st_collection',
            'luggage_collection',
            'physical_collection',
            'ladies_collection',
            'senior_collection',
            'adjust_collection',
            'updated_at',
            'created_at',
        ]

    def get_status(self, obj):
        return 'closed' if obj.is_closed else 'open'

    def get_route_code(self, obj):
        if obj.route_id:
            return obj.route_id.route_code
        return None

    def get_depot_code(self, obj):
        if not obj.route_id:
            return None
        rd = obj.route_id.route_depots.first()
        return rd.depot.depot_code if rd else None

    def get_total_cash_amount(self, obj):
        total = obj.total_collection or Decimal('0.00')
        upi = obj.upi_ticket_amount or Decimal('0.00')
        return max(Decimal('0.00'), total - upi)


class ScheduleDataSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    route_code = serializers.SerializerMethodField()
    depot_code = serializers.SerializerMethodField()
    battery_start = serializers.SerializerMethodField()
    battery_end = serializers.SerializerMethodField()
    trips_count = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleData
        fields = [
            'id',
            'palmtec_id',
            'schedule_no',
            'route_code',
            'depot_code',
            'status',
            'start_datetime',
            'end_datetime',
            'start_date',
            'battery_start',
            'battery_end',
            'trips_count',
            'total_tickets',
            'total_collection',
            'upi_total_collection',
            'bus_no',
            'driver',
            'conductor',
            'full_count',
            'half_count',
            'st_count',
            'physical_count',
            'ladies_count',
            'senior_count',
            'luggage_count',
            'adjust_count',
            'full_collection',
            'half_collection',
            'st_collection',
            'physical_collection',
            'ladies_collection',
            'senior_collection',
            'luggage_collection',
            'adjust_collection',
            'upi_full_collection',
            'upi_half_collection',
            'upi_physical_collection',
            'upi_ladies_collection',
            'upi_senior_collection',
            'upi_st_collection',
            'upi_luggage_collection',
            'updated_at',
            'created_at',
        ]

    def get_status(self, obj):
        return 'closed' if obj.is_closed else 'open'

    def get_route_code(self, obj):
        if obj.route_id:
            return obj.route_id.route_code
        return None

    def get_depot_code(self, obj):
        if not obj.route_id:
            return None
        rd = obj.route_id.route_depots.first()
        return rd.depot.depot_code if rd else None

    def get_battery_start(self, obj):
        return obj.battery_open

    def get_battery_end(self, obj):
        return obj.battery_close

    def get_trips_count(self, obj):
        # Use annotated value if present (set by view), else count via FK
        if hasattr(obj, '_trips_count'):
            return obj._trips_count
        return obj.trips.count()
