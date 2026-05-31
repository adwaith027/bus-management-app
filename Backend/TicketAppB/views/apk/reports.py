import datetime
from django.http import JsonResponse
from django.db.models import Q, Sum, Count
from rest_framework.decorators import api_view
from ...models import TransactionData, TripData, Stage, ExpenseData, Route, RouteStage, VehicleType
from ..web.auth import get_user_from_cookie
from ..utils import _meets_tier, _TIER_ERROR

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


def _route_stage_map(company, route_code):
    """Returns {sequence_no: stage_name} for the given route, falling back to stage_code map."""
    try:
        route = Route.objects.get(company=company, route_code=route_code)
        return {
            rs.sequence_no: rs.stage.stage_name
            for rs in RouteStage.objects.filter(route=route).select_related('stage')
        }
    except Route.DoesNotExist:
        return _build_stage_map(company)


# GET /reports/duty
# Duty report: all closed trips for a bus on a date, with crew and ticket range.
# Params: bus_no, date (YYYY-MM-DD)
@api_view(['GET'])
def duty_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    date_str = request.GET.get('date')

    if not bus_no or not date_str:
        return JsonResponse({'error': 'bus_no and date are required'}, status=400)

    trips = TripData.objects.filter(
        bus_no=bus_no,
        start_date=date_str,
        company_code=user.company,
    ).order_by('trip_no').values(
        'id', 'trip_no', 'start_time', 'start_ticket_no', 'end_ticket_no',
        'total_collection', 'is_closed', 'driver', 'conductor'
    )

    driver_name = None
    conductor_name = None
    trip_list = []
    for t in trips:
        if not driver_name and t['driver']:
            driver_name = t['driver']
        if not conductor_name and t['conductor']:
            conductor_name = t['conductor']

        if t['is_closed']:
            end_ticket = t['end_ticket_no']
            collection = str(t['total_collection'])
        else:
            live = TransactionData.objects.filter(
                company_code=user.company,
                trip_id=t['id'],
                ticket_date=date_str,
            ).aggregate(live_collection=Sum('ticket_amount'))
            last_ticket = TransactionData.objects.filter(
                company_code=user.company,
                trip_id=t['id'],
                ticket_date=date_str,
            ).order_by('-ticket_time').values_list('ticket_number', flat=True).first()
            end_ticket = last_ticket
            collection = str(live['live_collection'] or '0.00')

        trip_list.append({
            'trip_no': t['trip_no'],
            'start_time': str(t['start_time']) if t['start_time'] else None,
            'start_ticket': t['start_ticket_no'],
            'end_ticket': end_ticket,
            'collection': collection,
        })

    return JsonResponse({
        'bus_no': bus_no,
        'date': date_str,
        'driver': driver_name,
        'conductor': conductor_name,
        'trips': trip_list,
    })


# GET /reports/bus-summary
# Per-date revenue and distance for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def bus_summary_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    # Closed trips: revenue + distance from TripData
    closed_qs = TripData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        start_date__range=[from_date, to_date],
        is_closed=True,
    ).values('start_date').annotate(
        revenue=Sum('total_collection'),
        distance=Sum('total_km'),
    )
    closed_map = {
        str(r['start_date']): {'revenue': r['revenue'] or 0, 'distance': r['distance'] or 0}
        for r in closed_qs
    }

    # Open trips: revenue from TransactionData, distance from last stage reached
    open_revenue = {
        str(r['ticket_date']): r['collection'] or 0
        for r in TransactionData.objects.filter(
            company_code=user.company,
            bus_no=bus_no,
            ticket_date__range=[from_date, to_date],
            trip_id__is_closed=False,
        ).values('ticket_date').annotate(collection=Sum('ticket_amount'))
    }

    open_distance = {}
    for trip in TripData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        start_date__range=[from_date, to_date],
        is_closed=False,
        route_id__isnull=False,
    ).select_related('route_id'):
        last = TransactionData.objects.filter(
            company_code=user.company,
            trip_id=trip,
        ).order_by('-ticket_time').values('to_stage').first()
        if last and last['to_stage'] is not None:
            try:
                rs = RouteStage.objects.get(route=trip.route_id, sequence_no=last['to_stage'])
                date_key = str(trip.start_date)
                open_distance[date_key] = open_distance.get(date_key, 0) + (rs.distance or 0)
            except RouteStage.DoesNotExist:
                pass

    all_dates = sorted(set(closed_map.keys()) | set(open_revenue.keys()) | set(open_distance.keys()))

    rows = [
        {
            'date': date,
            'revenue': str((closed_map.get(date, {}).get('revenue', 0)) + open_revenue.get(date, 0)),
            'distance': str((closed_map.get(date, {}).get('distance', 0)) + open_distance.get(date, 0)),
        }
        for date in all_dates
    ]

    return JsonResponse({'rows': rows})


# GET /reports/payment-type
# Per-date cash/UPI breakdown for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD),
#         payment_mode (cash | upi) — optional, returns both if omitted
@api_view(['GET'])
def payment_type_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    payment_mode = request.GET.get('payment_mode', '').lower()

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    want_cash = payment_mode in ('', 'cash')
    want_upi = payment_mode in ('', 'upi')

    # ── Closed trips: from TripData ───────────────────────────────────────────
    closed_map = {}
    for r in TripData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        start_date__range=[from_date, to_date],
        is_closed=True,
    ).values('start_date').annotate(
        total=Sum('total_collection'),
        upi=Sum('upi_ticket_amount'),
    ):
        date = str(r['start_date'])
        upi = r['upi'] or 0
        total = r['total'] or 0
        closed_map[date] = {'cash': total - upi, 'upi': upi}

    # ── Open trips: from TransactionData ──────────────────────────────────────
    open_map = {}
    for r in TransactionData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        ticket_date__range=[from_date, to_date],
        trip_id__is_closed=False,
        ticket_status__in=['Cash', 'UPI'],
    ).values('ticket_date', 'ticket_status').annotate(amount=Sum('ticket_amount')):
        date = str(r['ticket_date'])
        if date not in open_map:
            open_map[date] = {'cash': 0, 'upi': 0}
        if r['ticket_status'] == 'Cash':
            open_map[date]['cash'] += r['amount'] or 0
        else:
            open_map[date]['upi'] += r['amount'] or 0

    all_dates = sorted(set(closed_map.keys()) | set(open_map.keys()))

    rows = []
    total_cash = 0
    total_upi = 0
    for date in all_dates:
        cash = closed_map.get(date, {}).get('cash', 0) + open_map.get(date, {}).get('cash', 0)
        upi = closed_map.get(date, {}).get('upi', 0) + open_map.get(date, {}).get('upi', 0)
        total_cash += cash
        total_upi += upi
        row = {'date': date}
        if want_cash:
            row['cash_amt'] = str(cash)
        if want_upi:
            row['upi_amt'] = str(upi)
        rows.append(row)

    totals = {}
    if want_cash:
        totals['total_cash'] = str(total_cash)
    if want_upi:
        totals['total_upi'] = str(total_upi)

    return JsonResponse({'rows': rows, 'totals': totals})


# GET /reports/farewise
# Fare-wise ticket count/revenue and per-trip passenger counts for a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def farewise_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    # ── Fare table ────────────────────────────────────────────────────────────
    fares = [
        {
            'fare': str(r['ticket_amount']),
            'ticket_count': r['ticket_count'],
            'revenue': str(r['revenue'] or '0.00'),
        }
        for r in TransactionData.objects.filter(
            company_code=user.company,
            bus_no=bus_no,
            ticket_date__range=[from_date, to_date],
        ).values('ticket_amount').annotate(
            ticket_count=Count('id'),
            revenue=Sum('ticket_amount'),
        ).order_by('ticket_amount')
    ]

    # ── Passenger counts per trip ─────────────────────────────────────────────
    trips = TripData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        start_date__range=[from_date, to_date],
    ).order_by('start_date', 'trip_no')

    open_trip_ids = [t.id for t in trips if not t.is_closed]
    open_agg = {}
    if open_trip_ids:
        for row in TransactionData.objects.filter(
            trip_id__in=open_trip_ids,
        ).values('trip_id').annotate(
            full=Sum('full_count'), half=Sum('half_count'),
            st=Sum('st_count'), phy=Sum('phy_count'),
            lugg=Sum('lugg_count'), ladies=Sum('ladies_count'), senior=Sum('senior_count'),
        ):
            open_agg[row['trip_id']] = row

    passenger_counts = []
    for t in trips:
        if t.is_closed:
            passenger_counts.append({
                'trip_no': t.trip_no,
                'date': str(t.start_date),
                'full': t.full_count or 0,
                'half': t.half_count or 0,
                'st': t.st_count or 0,
                'phy': t.physical_count or 0,
                'lugg': t.luggage_count or 0,
                'pass': t.pass_count or 0,
                'ladies': t.ladies_count or 0,
                'senior': t.senior_count or 0,
            })
        else:
            agg = open_agg.get(t.id, {})
            passenger_counts.append({
                'trip_no': t.trip_no,
                'date': str(t.start_date),
                'full': agg.get('full') or 0,
                'half': agg.get('half') or 0,
                'st': agg.get('st') or 0,
                'phy': agg.get('phy') or 0,
                'lugg': agg.get('lugg') or 0,
                'pass': 0,
                'ladies': agg.get('ladies') or 0,
                'senior': agg.get('senior') or 0,
            })

    return JsonResponse({
        'fares': fares,
        'passenger_counts': passenger_counts,
    })



# GET /ticket-app/reports/expense
# Returns expense data for a bus over a date range.
# Params: bus_no, from_date (YYYY-MM-DD), to_date (YYYY-MM-DD)
@api_view(['GET'])
def expense_report(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')

    if not bus_no or not from_date or not to_date:
        return JsonResponse({'error': 'bus_no, from_date and to_date are required'}, status=400)

    closed_revenue = {
        str(r['start_date']): r['collection'] or 0
        for r in TripData.objects.filter(
            company_code=user.company,
            bus_no=bus_no,
            start_date__range=[from_date, to_date],
            is_closed=True,
        ).values('start_date').annotate(collection=Sum('total_collection'))
    }

    open_revenue = {
        str(r['ticket_date']): r['collection'] or 0
        for r in TransactionData.objects.filter(
            company_code=user.company,
            bus_no=bus_no,
            ticket_date__range=[from_date, to_date],
            trip_id__is_closed=False,
        ).values('ticket_date').annotate(collection=Sum('ticket_amount'))
    }

    revenue_map = {
        date: closed_revenue.get(date, 0) + open_revenue.get(date, 0)
        for date in set(closed_revenue.keys()) | set(open_revenue.keys())
    }

    expense_map = {
        str(e['expense_date']): e['expense'] or 0
        for e in ExpenseData.objects.filter(
            company_code=user.company,
            bus_no=bus_no,
            expense_date__range=[from_date, to_date],
        ).values('expense_date').annotate(expense=Sum('expense_amount'))
    }

    all_dates = sorted(set(revenue_map.keys()) | set(expense_map.keys()))

    return JsonResponse({
        'rows': [
            {
                'date': date,
                'collection': str(revenue_map.get(date, 0)),
                'expense': str(expense_map.get(date, 0)),
            }
            for date in all_dates
        ]
    })



# GET /apk/buses
# Returns all active bus registration numbers for the company.
@api_view(['GET'])
def apk_bus_list(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    buses = list(
        VehicleType.objects.filter(company=user.company, is_deleted=False)
        .order_by('bus_reg_num')
        .values('id', 'bus_reg_num')
    )
    return JsonResponse({'buses': buses})


# GET /apk/dashboard
# APK home dashboard: revenue header, weekly chart (Mon–Sun), per-bus list with status.
# Params: date (YYYY-MM-DD)
@api_view(['GET'])
def apk_dashboard(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    date_str = request.GET.get('date')
    if not date_str:
        return JsonResponse({'error': 'date is required'}, status=400)

    company = user.company
    anchor = datetime.date.fromisoformat(date_str)

    # ── Revenue header ────────────────────────────────────────────────────────
    day_agg = TripData.objects.filter(
        company_code=company,
        start_date=date_str,
    ).aggregate(total=Sum('total_collection'), upi=Sum('upi_ticket_amount'))
    total_revenue = day_agg['total'] or 0
    total_upi = day_agg['upi'] or 0

    # ── Bus list with status ──────────────────────────────────────────────────
    bus_rows = TripData.objects.filter(
        company_code=company,
        start_date=date_str,
        bus_no__isnull=False,
    ).values('bus_no').annotate(
        revenue=Sum('total_collection'),
        upi_amt=Sum('upi_ticket_amount'),
        open_count=Count('id', filter=Q(is_closed=False)),
    )

    buses_with_data = {row['bus_no']: row for row in bus_rows}

    bus_list = []
    running_count = 0
    for bus_no, row in buses_with_data.items():
        cash_amt = (row['revenue'] or 0) - (row['upi_amt'] or 0)
        status = 'running' if row['open_count'] > 0 else 'idle'
        if status == 'running':
            running_count += 1
        bus_list.append({
            'bus_no': bus_no,
            'status': status,
            'revenue': str(row['revenue'] or '0.00'),
            'cash_amt': str(cash_amt),
            'upi_amt': str(row['upi_amt'] or '0.00'),
        })

    for reg_num in VehicleType.objects.filter(company=company, is_deleted=False).values_list('bus_reg_num', flat=True):
        if reg_num not in buses_with_data:
            bus_list.append({
                'bus_no': reg_num,
                'status': 'offline',
                'revenue': '0.00',
                'cash_amt': '0.00',
                'upi_amt': '0.00',
            })

    # ── Weekly chart (Mon–Sun week containing selected date) ──────────────────
    week_start = anchor - datetime.timedelta(days=anchor.weekday())
    week_end = week_start + datetime.timedelta(days=6)

    weekly_qs = TripData.objects.filter(
        company_code=company,
        start_date__range=[week_start, week_end],
    ).values('start_date').annotate(
        total=Sum('total_collection'),
        upi=Sum('upi_ticket_amount'),
    ).order_by('start_date')

    weekly_chart = []
    for row in weekly_qs:
        rev = row['total'] or 0
        upi = row['upi'] or 0
        weekly_chart.append({
            'date': str(row['start_date']),
            'total': str(rev),
            'cash': str(rev - upi),
            'upi': str(upi),
        })

    return JsonResponse({
        'date': date_str,
        'total_revenue': str(total_revenue),
        'total_cash': str(total_revenue - total_upi),
        'total_upi': str(total_upi),
        'bus_on_road': running_count,
        'weekly_chart': weekly_chart,
        'bus_list': bus_list,
    })


# GET /apk/bus-trips
# Trips for a bus on a specific date (open and closed).
# Params: bus_no, date (YYYY-MM-DD)
@api_view(['GET'])
def apk_bus_trips(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    date_str = request.GET.get('date')

    if not bus_no or not date_str:
        return JsonResponse({'error': 'bus_no and date are required'}, status=400)

    trips = TripData.objects.filter(
        company_code=user.company,
        bus_no=bus_no,
        start_date=date_str,
    ).select_related('route_id').order_by('trip_no')

    trip_list = []
    for t in trips:
        cash_amt = (t.total_collection or 0) - (t.upi_ticket_amount or 0)
        trip_list.append({
            'trip_no': t.trip_no,
            'status': 'open' if not t.is_closed else 'closed',
            'route_name': t.route_id.route_name if t.route_id else None,
            'route_code': t.route_id.route_code if t.route_id else None,
            'start_time': str(t.start_time) if t.start_time else None,
            'end_time': str(t.end_time) if t.end_time else None,
            'revenue': str(t.total_collection or '0.00'),
            'cash_amt': str(cash_amt),
            'upi_amt': str(t.upi_ticket_amount or '0.00'),
        })

    return JsonResponse({
        'bus_no': bus_no,
        'date': date_str,
        'trips': trip_list,
    })


# GET /apk/ticket-details
# Tickets for a specific trip with passenger type totals.
# Params: bus_no, trip_no (integer), route_code, date (YYYY-MM-DD)
@api_view(['GET'])
def apk_ticket_details(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    trip_no = request.GET.get('trip_no')
    route_code = request.GET.get('route_code')
    date_str = request.GET.get('date')

    if not bus_no or not trip_no or not route_code or not date_str:
        return JsonResponse({'error': 'bus_no, trip_no, route_code and date are required'}, status=400)

    try:
        trip = TripData.objects.get(
            company_code=user.company,
            bus_no=bus_no,
            trip_no=int(trip_no),
            start_date=date_str,
        )
    except TripData.DoesNotExist:
        return JsonResponse({'error': 'Trip not found'}, status=404)

    stage_map = _route_stage_map(user.company, route_code)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        trip_id=trip,
        ticket_date=date_str,
    ).order_by('ticket_time')

    totals = {'full': 0, 'half': 0, 'st': 0, 'phy': 0, 'lugg': 0, 'ladies': 0, 'senior': 0}
    ticket_list = []
    for t in qs:
        totals['full'] += t.full_count or 0
        totals['half'] += t.half_count or 0
        totals['st'] += t.st_count or 0
        totals['phy'] += t.phy_count or 0
        totals['lugg'] += t.lugg_count or 0
        totals['ladies'] += t.ladies_count or 0
        totals['senior'] += t.senior_count or 0
        ticket_list.append({
            'ticket_no': t.ticket_number,
            'from_stage': stage_map.get(t.from_stage, str(t.from_stage) if t.from_stage is not None else None),
            'to_stage': stage_map.get(t.to_stage, str(t.to_stage) if t.to_stage is not None else None),
            'amount': str(t.ticket_amount),
            'payment_mode': PAYMENT_LABELS.get(t.ticket_status, 'Unknown'),
            'ticket_type': t.ticket_type,
            'full_count': t.full_count,
            'half_count': t.half_count,
            'st_count': t.st_count,
            'phy_count': t.phy_count,
            'lugg_count': t.lugg_count,
        })

    return JsonResponse({
        'bus_no': bus_no,
        'trip_no': trip_no,
        'date': date_str,
        'passenger_totals': totals,
        'tickets': ticket_list,
    })


# GET /apk/passenger-info
# Stage-wise boarded/deboarded table for a trip; live header for open trips.
# Params: bus_no, trip_no (integer), route_code, date (YYYY-MM-DD)
@api_view(['GET'])
def apk_passenger_info(request):
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    if not _meets_tier(user, 'intermediate'):
        return JsonResponse(_TIER_ERROR, status=403)

    bus_no = request.GET.get('bus_no')
    trip_no = request.GET.get('trip_no')
    route_code = request.GET.get('route_code')
    date_str = request.GET.get('date')

    if not bus_no or not trip_no or not route_code or not date_str:
        return JsonResponse({'error': 'bus_no, trip_no, route_code and date are required'}, status=400)

    try:
        trip = TripData.objects.get(
            company_code=user.company,
            bus_no=bus_no,
            trip_no=int(trip_no),
            start_date=date_str,
        )
    except TripData.DoesNotExist:
        return JsonResponse({'error': 'Trip not found'}, status=404)

    qs = TransactionData.objects.filter(
        company_code=user.company,
        trip_id=trip,
        ticket_date=date_str,
    )

    # ── Route stages (ordered) ────────────────────────────────────────────────
    try:
        route = Route.objects.get(company=user.company, route_code=route_code)
        route_stages = list(RouteStage.objects.filter(route=route).select_related('stage').order_by('sequence_no'))
        stage_map = {rs.sequence_no: rs.stage.stage_name for rs in route_stages}
        has_route = True
    except Route.DoesNotExist:
        route_stages = []
        stage_map = _build_stage_map(user.company)
        has_route = False

    # ── Header ────────────────────────────────────────────────────────────────
    status = 'open' if not trip.is_closed else 'closed'
    if status == 'open':
        last_ticket = qs.order_by('-ticket_time').values('to_stage', 'passenger_count').first()
        current_stage = stage_map.get(last_ticket['to_stage']) if last_ticket and last_ticket['to_stage'] is not None else None
        passengers_in_bus = last_ticket['passenger_count'] if last_ticket else None
    else:
        current_stage = None
        passengers_in_bus = None

    # ── Passenger totals ──────────────────────────────────────────────────────
    agg = qs.aggregate(
        full=Sum('full_count'), half=Sum('half_count'),
        st=Sum('st_count'), phy=Sum('phy_count'),
        lugg=Sum('lugg_count'), ladies=Sum('ladies_count'), senior=Sum('senior_count'),
    )
    passenger_totals = {k: v or 0 for k, v in agg.items()}

    # ── Stage table ───────────────────────────────────────────────────────────
    boarded = {
        r['from_stage']: {'f': r['full'] or 0, 'h': r['half'] or 0, 'st': r['st'] or 0, 'ph': r['phy'] or 0}
        for r in qs.values('from_stage').annotate(
            full=Sum('full_count'), half=Sum('half_count'), st=Sum('st_count'), phy=Sum('phy_count'),
        )
        if r['from_stage'] is not None
    }
    deboarded = {
        r['to_stage']: {'f': r['full'] or 0, 'h': r['half'] or 0, 'st': r['st'] or 0, 'ph': r['phy'] or 0}
        for r in qs.values('to_stage').annotate(
            full=Sum('full_count'), half=Sum('half_count'), st=Sum('st_count'), phy=Sum('phy_count'),
        )
        if r['to_stage'] is not None
    }

    if has_route:
        stage_table = [
            {
                'stage_name': rs.stage.stage_name,
                'boarded': boarded.get(rs.sequence_no, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
                'deboarded': deboarded.get(rs.sequence_no, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
            }
            for rs in route_stages
        ]
    else:
        all_stages = sorted(set(boarded.keys()) | set(deboarded.keys()))
        stage_table = [
            {
                'stage_name': stage_map.get(sc, str(sc)),
                'boarded': boarded.get(sc, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
                'deboarded': deboarded.get(sc, {'f': 0, 'h': 0, 'st': 0, 'ph': 0}),
            }
            for sc in all_stages
        ]

    return JsonResponse({
        'bus_no': bus_no,
        'trip_no': trip_no,
        'date': date_str,
        'header': {
            'status': status,
            'current_stage': current_stage,
            'passengers_in_bus': passengers_in_bus,
            'total_collection': str(trip.total_collection or '0.00'),
        },
        'passenger_totals': passenger_totals,
        'stage_table': stage_table,
    })