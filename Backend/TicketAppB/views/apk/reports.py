from django.http import JsonResponse
from django.db.models import Sum, Count, Max
from django.utils import timezone
from rest_framework.decorators import api_view
from ...models import TransactionData, TripData, ScheduleData, Stage, ExpenseData
from ..web.auth import get_user_from_request as get_user_from_cookie  # APK: Bearer header

PAYMENT_LABELS = {'Cash': 'Cash', 'UPI': 'UPI', 'Card': 'Card'}


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
    date = request.GET.get('date')

    if not device_id or not date:
        return JsonResponse({'error': 'device_id and date are required'}, status=400)

    trips = TripData.objects.filter(
        palmtec_id=device_id,
        start_date=date,
        company_code=user.company,
        is_closed=True,
    ).order_by('trip_no').values(
        'trip_no', 'start_time', 'start_ticket_no', 'end_ticket_no', 'total_collection', 'conductor'
    )

    conductor_name = None
    trip_list = []
    for t in trips:
        if not conductor_name and t['conductor']:
            conductor_name = t['conductor']
        trip_list.append({
            'trip_no': t['trip_no'],
            'time': str(t['start_time']) if t['start_time'] else None,
            'start_ticket': t['start_ticket_no'],
            'end_ticket': t['end_ticket_no'],
            'collection': str(t['total_collection']),
        })

    return JsonResponse({
        'bus_no': device_id,
        'date': date,
        'conductor': conductor_name,
        'trips': trip_list,
    })


# GET /ticket-app/reports/bus-summary
# Returns total revenue per day for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
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

    qs = TripData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        start_date__range=[from_date, to_date],
        is_closed=True,
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
# Returns collection breakdown by payment type (Cash/UPI/Card) for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD),
#         payment_mode (all | cash | upi | card) — defaults to all
@api_view(['GET'])
def payment_type_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    payment_mode = request.GET.get('payment_mode', 'all').lower()

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        ticket_date__range=[from_date, to_date],
    )

    if payment_mode == 'cash':
        qs = qs.filter(ticket_status='Cash')
    elif payment_mode == 'upi':
        qs = qs.filter(ticket_status='UPI')
    elif payment_mode == 'card':
        qs = qs.filter(ticket_status='Card')

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
# Returns fare-wise ticket count/revenue and passenger type count per trip.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), route_no (optional)
@api_view(['GET'])
def farewise_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    route_no = request.GET.get('route_no')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        ticket_date__range=[from_date, to_date],
    )

    if route_no:
        qs = qs.filter(route_id__route_code=route_no)

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

    trip_rows = qs.values('trip_id__trip_no').annotate(
        full=Sum('full_count'),
        half=Sum('half_count'),
        st=Sum('st_count'),
        phy=Sum('phy_count'),
        lugg=Sum('lugg_count'),
    ).order_by('trip_id__trip_no')

    passenger_counts = [
        {
            'trip': r['trip_id__trip_no'],
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
# Params: device_id, date (YYYY-MM-DD)
@api_view(['GET'])
def passenger_info(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    date = request.GET.get('date')

    if not device_id or not date:
        return JsonResponse({'error': 'device_id and date are required'}, status=400)

    trips = TripData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        start_date=date,
        is_closed=True,
    ).order_by('-trip_no').values(
        'trip_no',
        'route_id__route_name',
        'up_down_trip',
        'start_time',
        'end_time',
        'total_collection',
        'upi_ticket_amount',
        'total_tickets',
        'upi_ticket_count',
        'total_cash_tickets',
    )

    trip_list = [
        {
            'trip_no': t['trip_no'],
            'route_name': t['route_id__route_name'],
            'direction': 'Up' if t['up_down_trip'] == 'U' else 'Down',
            'start_time': str(t['start_time']) if t['start_time'] else None,
            'end_time': str(t['end_time']) if t['end_time'] else None,
            'total_collection': str(t['total_collection'] or '0.00'),
            'cash_amount': str((t['total_collection'] or 0) - (t['upi_ticket_amount'] or 0)),
            'upi_amount': str(t['upi_ticket_amount'] or '0.00'),
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
# along with a summary header.
# Params: device_id, trip_no (integer), date (YYYY-MM-DD)
@api_view(['GET'])
def trip_details(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    trip_no = request.GET.get('trip_no')
    date = request.GET.get('date')

    if not device_id or not trip_no or not date:
        return JsonResponse({'error': 'device_id, trip_no and date are required'}, status=400)

    try:
        trip = TripData.objects.get(
            company_code=user.company,
            palmtec_id=device_id,
            trip_no=int(trip_no),
            start_date=date,
            is_closed=True,
        )
        summary = {
            'trip_no': trip.trip_no,
            'route_code': trip.route_id.route_code if trip.route_id else None,
            'route_name': trip.route_id.route_name if trip.route_id else None,
            'direction': 'Up' if trip.up_down_trip == 'U' else 'Down',
            'total_collection': str(trip.total_collection),
            'full_count': trip.full_count,
            'half_count': trip.half_count,
            'st_count': trip.st_count,
            'phy_count': trip.physical_count,
            'pass_count': trip.pass_count,
            'total_tickets': trip.total_tickets,
        }
    except TripData.DoesNotExist:
        summary = None

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        trip_id__trip_no=int(trip_no),
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
# Returns all individual tickets issued in a specific trip.
# Params: device_id, trip_no (integer), date (YYYY-MM-DD)
@api_view(['GET'])
def ticket_details(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    device_id = request.GET.get('device_id')
    trip_no = request.GET.get('trip_no')
    date = request.GET.get('date')

    if not device_id or not trip_no or not date:
        return JsonResponse({'error': 'device_id, trip_no and date are required'}, status=400)

    tickets = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=device_id,
        trip_id__trip_no=int(trip_no),
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


# GET /ticket-app/reports/expense
# Returns expense data for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def expense_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = ExpenseData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        expense_date__range=[from_date, to_date],
    ).values('expense_date').annotate(
        total_expense=Sum('expense_amount')
    ).order_by('expense_date')

    rows = [
        {
            'sl_no': i + 1,
            'date': str(row['expense_date']),
            'bus_no': bus_no,
            'revenue': str(row['total_expense'] or '0.00'),
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


# GET /ticket-app/reports/stage-wise
# Returns stage-wise boarded/deboarded counts for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), route_no (optional)
@api_view(['GET'])
def stage_wise_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    route_no = request.GET.get('route_no')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        palmtec_id=bus_no,
        ticket_date__range=[from_date, to_date],
    )

    if route_no:
        qs = qs.filter(route_id__route_code=route_no)

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
            'stage_code': sc,
            'stage_name': stage_map.get(sc, str(sc)),
            'boarded': boarded_map.get(sc, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
            'deboarded': deboarded_map.get(sc, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
        }
        for sc in all_stages
    ]

    return JsonResponse({
        'bus_no': bus_no,
        'from_date': from_date,
        'to_date': to_date,
        'stage_table': stage_table,
    })


# GET /ticket-app/apk/dashboard
# Returns APK home dashboard data: revenue header, per-bus list, weekly chart, bus status counts.
# Params: date (YYYY-MM-DD)
@api_view(['GET'])
def apk_dashboard(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    date_str = request.GET.get('date')
    if not date_str:
        return JsonResponse({'error': 'date is required'}, status=400)

    company = user.company

    # ── Revenue header ────────────────────────────────────────────────────────
    day_trips = TripData.objects.filter(
        company_code=company,
        start_date=date_str,
        is_closed=True,
    )
    total_revenue = day_trips.aggregate(total=Sum('total_collection'))['total'] or 0

    # ── Per-bus list ──────────────────────────────────────────────────────────
    bus_rows_qs = day_trips.values('palmtec_id').annotate(
        revenue=Sum('total_collection'),
        upi_amt=Sum('upi_ticket_amount'),
        last_time=Max('end_time'),
    ).order_by('-last_time')

    bus_list = []
    for row in bus_rows_qs:
        cash_amt = (row['revenue'] or 0) - (row['upi_amt'] or 0)
        bus_list.append({
            'bus_no': row['palmtec_id'],
            'revenue': str(row['revenue'] or '0.00'),
            'cash_amt': str(cash_amt),
            'upi_amt': str(row['upi_amt'] or '0.00'),
            'recharge_amt': '0.00',  # Card Recharge — deferred
            'last_trip_time': str(row['last_time']) if row['last_time'] else None,
        })

    # ── Bus status ────────────────────────────────────────────────────────────
    # Running: open ScheduleData today (is_closed=False)
    # Idle: all ScheduleData today are closed (is_closed=True, schedule completed)
    # Offline: no ScheduleData today
    today_schedules = ScheduleData.objects.filter(
        company_code=company,
        start_date=date_str,
    ).values('palmtec_id', 'is_closed')

    running_buses = set()
    idle_buses = set()
    all_scheduled = {}

    for s in today_schedules:
        pid = s['palmtec_id']
        all_scheduled[pid] = all_scheduled.get(pid, True) and s['is_closed']

    for pid, all_closed in all_scheduled.items():
        if all_closed:
            idle_buses.add(pid)
        else:
            running_buses.add(pid)

    # ── Weekly chart ──────────────────────────────────────────────────────────
    from datetime import date, timedelta
    anchor = date.fromisoformat(date_str)
    week_start = anchor - timedelta(days=6)

    weekly_qs = TripData.objects.filter(
        company_code=company,
        start_date__range=[week_start, anchor],
        is_closed=True,
    ).values('start_date').annotate(
        revenue=Sum('total_collection')
    ).order_by('start_date')

    weekly_chart = [
        {'date': str(row['start_date']), 'revenue': str(row['revenue'] or '0.00')}
        for row in weekly_qs
    ]

    return JsonResponse({
        'date': date_str,
        'total_revenue': str(total_revenue),
        'bus_counts': {
            'all': len(all_scheduled) + (len(bus_list) - len(all_scheduled) if len(bus_list) > len(all_scheduled) else 0),
            'running': len(running_buses),
            'idle': len(idle_buses),
            'offline': max(0, len(bus_list) - len(all_scheduled)),
        },
        'bus_list': bus_list,
        'weekly_chart': weekly_chart,
    })