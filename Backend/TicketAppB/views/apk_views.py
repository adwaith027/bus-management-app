from django.http import JsonResponse
from django.db.models import Sum, Count
from rest_framework.decorators import api_view
from ..models import TransactionData, TripCloseData, Stage, CrewAssignment
from .auth_views import get_user_from_cookie

PAYMENT_LABELS = {0: 'Cash', 1: 'UPI'}


def _build_stage_map(company):
    stages = Stage.objects.filter(company=company, is_deleted=False).values('stage_code', 'stage_name')
    stage_map = {}
    for s in stages:
        try:
            stage_map[int(s['stage_code'])] = s['stage_name']
        except (ValueError, TypeError):
            pass
    return stage_map


# GET /ticket-app/reports/duty
# Returns all trips made by a bus on a specific date, with conductor name.
# Params: device_id (bus reg number), date (YYYY-MM-DD)
@api_view(['GET'])
def duty_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    date = request.GET.get('date')  # YYYY-MM-DD

    if not device_id or not date:
        return JsonResponse({'error': 'device_id and date are required'}, status=400)

    trips = TripCloseData.objects.filter(
        palmtec_id=device_id,
        start_date=date,
        company_code=user.company,
    ).order_by('trip_no').values(
        'trip_no', 'start_time', 'start_ticket_no', 'end_ticket_no', 'total_collection'
    )

    conductor_name = None
    try:
        assignment = CrewAssignment.objects.select_related('conductor', 'vehicle').filter(
            vehicle__bus_reg_num=device_id,
            company=user.company,
        ).first()
        if assignment and assignment.conductor:
            conductor_name = assignment.conductor.employee_name
    except Exception:
        pass

    trip_list = [
        {
            'trip_no': t['trip_no'],
            'time': str(t['start_time']) if t['start_time'] else None,
            'start_ticket': t['start_ticket_no'],
            'end_ticket': t['end_ticket_no'],
            'collection': str(t['total_collection']),
        }
        for t in trips
    ]

    return JsonResponse({
        'bus_no': device_id,
        'date': date,
        'conductor': conductor_name,
        'trips': trip_list,
    })


# GET /ticket-app/reports/bus-summary
# Returns total revenue per day for a bus over a date range.
# Params: bus_no (bus reg number), from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def bus_summary_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TripCloseData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        start_date__range=[from_date, to_date],
    ).values('start_date').annotate(
        revenue=Sum('total_collection')
    ).order_by('start_date')

    rows = [
        {
            'sl_no': i + 1,
            'date': str(row['start_date']),
            'bus_no': bus_no,
            'revenue': str(row['revenue'] or '0.00'),
        }
        for i, row in enumerate(qs)
    ]

    total = sum(float(r['revenue']) for r in rows)

    return JsonResponse({
        'bus_no': bus_no,
        'from_date': from_date,
        'to_date': to_date,
        'rows': rows,
        'total': f'{total:.2f}',
    })


# GET /ticket-app/reports/payment-type
# Returns collection breakdown by payment type (Cash/UPI) for a bus over a date range.
# Params: bus_no (bus reg number), from_date (YYYY-MM-DD), to_date (YYYY-MM-DD),
#         payment_mode (all | cash | upi) — defaults to all
@api_view(['GET'])
def payment_type_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    payment_mode = request.GET.get('payment_mode', 'all').lower()  # all | cash | upi

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        ticket_date__range=[from_date, to_date],
    )

    if payment_mode == 'cash':
        qs = qs.filter(ticket_status=0)
    elif payment_mode == 'upi':
        qs = qs.filter(ticket_status=1)

    rows_qs = qs.values('ticket_date', 'palmtec_id', 'ticket_status').annotate(
        collection=Sum('ticket_amount')
    ).order_by('ticket_date', 'ticket_status')

    rows = [
        {
            'sl_no': i + 1,
            'date': str(r['ticket_date']),
            'bus_no': r['palmtec_id'],
            'payment_type': PAYMENT_LABELS.get(r['ticket_status'], 'Unknown'),
            'collection': str(r['collection'] or '0.00'),
        }
        for i, r in enumerate(rows_qs)
    ]

    totals_qs = qs.values('ticket_status').annotate(total=Sum('ticket_amount'))
    totals = {PAYMENT_LABELS.get(t['ticket_status'], 'Unknown'): str(t['total'] or '0.00') for t in totals_qs}

    return JsonResponse({
        'bus_no': bus_no,
        'from_date': from_date,
        'to_date': to_date,
        'payment_mode': payment_mode,
        'rows': rows,
        'totals': totals,
    })


# GET /ticket-app/reports/farewise
# Returns two sections:
#   1. Fare-wise ticket count and revenue (grouped by fare amount)
#   2. Passenger type count per trip (Full, Half, ST, PHY, Luggage)
# Params: bus_no (bus reg number), from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def farewise_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        ticket_date__range=[from_date, to_date],
    )

    fare_rows = qs.values('ticket_amount').annotate(
        ticket_count=Count('id'),
        revenue=Sum('ticket_amount'),
    ).order_by('ticket_amount')

    fares = [
        {
            'sl_no': i + 1,
            'fare': str(r['ticket_amount']),
            'ticket_count': r['ticket_count'],
            'revenue': str(r['revenue'] or '0.00'),
        }
        for i, r in enumerate(fare_rows)
    ]

    trip_rows = qs.values('trip_number').annotate(
        full=Sum('full_count'),
        half=Sum('half_count'),
        st=Sum('st_count'),
        phy=Sum('phy_count'),
        lugg=Sum('lugg_count'),
    ).order_by('trip_number')

    passenger_counts = [
        {
            'trip': r['trip_number'],
            'full': r['full'] or 0,
            'half': r['half'] or 0,
            'st': r['st'] or 0,
            'phy': r['phy'] or 0,
            'lugg': r['lugg'] or 0,
        }
        for r in trip_rows
    ]

    return JsonResponse({
        'bus_no': bus_no,
        'from_date': from_date,
        'to_date': to_date,
        'fares': fares,
        'passenger_counts': passenger_counts,
    })


# GET /ticket-app/reports/passenger-info
# Returns list of all trips for a device on a specific date,
# with cash/UPI breakdown and route info per trip.
# Params: device_id (bus reg number / palmtec ID), date (YYYY-MM-DD)
@api_view(['GET'])
def passenger_info(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    date = request.GET.get('date')  # YYYY-MM-DD

    if not device_id or not date:
        return JsonResponse({'error': 'device_id and date are required'}, status=400)

    trips = TripCloseData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        start_date=date,
    ).order_by('-trip_no').values(
        'trip_no',
        'route_code',
        'up_down_trip',
        'start_time',
        'end_time',
        'total_collection',
        'total_cash_amount',
        'upi_ticket_amount',
        'total_tickets',
        'upi_ticket_count',
        'total_cash_tickets',
    )

    trip_list = [
        {
            'trip_no': t['trip_no'],
            'route_name': t['route_code'],
            'direction': 'Up' if t['up_down_trip'] == 'U' else 'Down',
            'start_time': str(t['start_time']) if t['start_time'] else None,
            'end_time': str(t['end_time']) if t['end_time'] else None,
            'total_collection': str(t['total_collection']),
            'cash_amount': str(t['total_cash_amount']),
            'upi_amount': str(t['upi_ticket_amount']),
            'total_tickets': t['total_tickets'],
            'upi_tickets': t['upi_ticket_count'],
            'cash_tickets': t['total_cash_tickets'],
        }
        for t in trips
    ]

    return JsonResponse({
        'device_id': device_id,
        'date': date,
        'trips': trip_list,
    })


# GET /ticket-app/reports/trip-details
# Returns stage-wise boarded/deboarded passenger table for a specific trip,
# along with a summary header (total collection, ticket counts per type).
# Params: device_id (bus reg number), trip_no (integer), date (YYYY-MM-DD)
@api_view(['GET'])
def trip_details(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    trip_no = request.GET.get('trip_no')
    date = request.GET.get('date')  # YYYY-MM-DD

    if not device_id or not trip_no or not date:
        return JsonResponse({'error': 'device_id, trip_no and date are required'}, status=400)

    try:
        trip = TripCloseData.objects.get(
            company_code=user.company,
            palmtec_id=device_id,
            trip_no=int(trip_no),
            start_date=date,
        )
        summary = {
            'trip_no': trip.trip_no,
            'route_code': trip.route_code,
            'direction': 'Up' if trip.up_down_trip == 'U' else 'Down',
            'total_collection': str(trip.total_collection),
            'full_count': trip.full_count,
            'half_count': trip.half_count,
            'st_count': trip.st1_count,
            'phy_count': trip.physical_count,
            'pass_count': trip.pass_count,
            'total_tickets': trip.total_tickets,
        }
    except TripCloseData.DoesNotExist:
        summary = None

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        trip_number=trip_no,
        ticket_date=date,
    )

    boarded = qs.values('from_stage').annotate(
        full=Sum('full_count'),
        half=Sum('half_count'),
        st=Sum('st_count'),
        phy=Sum('phy_count'),
    )

    deboarded = qs.values('to_stage').annotate(
        full=Sum('full_count'),
        half=Sum('half_count'),
        st=Sum('st_count'),
        phy=Sum('phy_count'),
    )

    stage_map = _build_stage_map(user.company)

    boarded_map = {
        r['from_stage']: {'f': r['full'] or 0, 'h': r['half'] or 0, 'st': r['st'] or 0, 'ph': r['phy'] or 0}
        for r in boarded if r['from_stage'] is not None
    }
    deboarded_map = {
        r['to_stage']: {'f': r['full'] or 0, 'h': r['half'] or 0, 'st': r['st'] or 0, 'ph': r['phy'] or 0}
        for r in deboarded if r['to_stage'] is not None
    }

    all_stages = sorted(set(boarded_map.keys()) | set(deboarded_map.keys()))

    stage_table = [
        {
            'stage_code': stage_code,
            'stage_name': stage_map.get(stage_code, str(stage_code)),
            'boarded': boarded_map.get(stage_code, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
            'deboarded': deboarded_map.get(stage_code, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
        }
        for stage_code in all_stages
    ]

    return JsonResponse({
        'device_id': device_id,
        'trip_no': trip_no,
        'date': date,
        'summary': summary,
        'stage_table': stage_table,
    })


# GET /ticket-app/reports/ticket-details
# Returns all individual tickets issued in a specific trip,
# with stage names resolved and a summary of passenger type totals.
# Params: device_id (bus reg number), trip_no (integer), date (YYYY-MM-DD)
@api_view(['GET'])
def ticket_details(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    trip_no = request.GET.get('trip_no')
    date = request.GET.get('date')  # YYYY-MM-DD

    if not device_id or not trip_no or not date:
        return JsonResponse({'error': 'device_id, trip_no and date are required'}, status=400)

    tickets = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        trip_number=trip_no,
        ticket_date=date,
    ).order_by('ticket_time').values(
        'ticket_number',
        'ticket_time',
        'from_stage',
        'to_stage',
        'ticket_type',
        'ticket_amount',
        'ticket_status',
        'full_count',
        'half_count',
        'st_count',
        'phy_count',
    )

    stage_map = _build_stage_map(user.company)

    ticket_list = [
        {
            'ticket_number': t['ticket_number'],
            'time': str(t['ticket_time']) if t['ticket_time'] else None,
            'from_stage': t['from_stage'],
            'from_stage_name': stage_map.get(t['from_stage'], str(t['from_stage']) if t['from_stage'] else None),
            'to_stage': t['to_stage'],
            'to_stage_name': stage_map.get(t['to_stage'], str(t['to_stage']) if t['to_stage'] else None),
            'ticket_type': t['ticket_type'],
            'amount': str(t['ticket_amount']),
            'payment_type': PAYMENT_LABELS.get(t['ticket_status'], 'Unknown'),
            'full_count': t['full_count'],
            'half_count': t['half_count'],
            'st_count': t['st_count'],
            'phy_count': t['phy_count'],
        }
        for t in tickets
    ]

    total_full = sum(t['full_count'] for t in ticket_list)
    total_half = sum(t['half_count'] for t in ticket_list)
    total_st = sum(t['st_count'] for t in ticket_list)
    total_phy = sum(t['phy_count'] for t in ticket_list)

    return JsonResponse({
        'device_id': device_id,
        'trip_no': trip_no,
        'date': date,
        'summary': {
            'full_count': total_full,
            'half_count': total_half,
            'st_count': total_st,
            'phy_count': total_phy,
        },
        'tickets': ticket_list,
    })
