import struct
import logging
from django.http import HttpResponse, JsonResponse
from ..models import Settings, Route, Employee, VehicleType, ExpenseMaster, Stage, Fare, Currency, RouteStage
from .auth_views import get_user_from_cookie

logger = logging.getLogger(__name__)


# ─── Binary packing helpers ────────────────────────────────────────────────────

def _s(val, size):
    """Fixed-width ASCII string, null-padded, truncated to fit."""
    return (val or '').encode('ascii', errors='replace')[:size].ljust(size, b'\x00')

def _b(val):
    """Single unsigned byte (0–255)."""
    try:
        return bytes([max(0, min(255, int(float(val or 0))))])
    except (ValueError, TypeError):
        return b'\x00'

def _bool(val):
    return b'\x01' if val else b'\x00'

def _f(val):
    """4-byte little-endian float (IEEE 754)."""
    try:
        return struct.pack('<f', float(val or 0))
    except (ValueError, TypeError):
        return struct.pack('<f', 0.0)

def _i(val):
    """2-byte little-endian signed short."""
    try:
        return struct.pack('<h', int(val or 0))
    except (ValueError, TypeError):
        return struct.pack('<h', 0)


# ─── File packers ──────────────────────────────────────────────────────────────

def _pack_busdat(s):
    """
    Build BUS.DAT binary from Settings model.
    Structure: SETUP (~640 bytes) + HARDWARE_SETUP (64 bytes) = 704 bytes total.
    Matches VB6 Type SETUP + HARDWARE_SETUP definitions in mdFunctions.bas.
    """
    # ── SETUP section ──────────────────────────────────────────────────────────
    data  = _s(s.main_display, 18)
    data += _s(s.main_display2, 23)
    data += _s(s.header1, 32)
    data += _s(s.header2, 32)
    data += _s(s.header3, 32)
    data += _s(s.footer1, 32)
    data += _s(s.footer2, 32)
    data += b'\x00'                          # PaperFeed
    data += _s('', 6)                          # palmtec_id moved to SettingsProfile
    data += b'\x00'                          # DefaultFull
    data += _b(s.half_per)
    data += _b(s.con_per)
    data += _f(s.st_max_amt)
    data += _f(s.st_min_con)
    data += _b(s.phy_per)
    data += b'\x00'                          # LuggageUnitRateEdit
    data += _f(s.luggage_unit_rate)
    data += _b(s.stage_updation_msg)
    data += b'\x00'                          # StageDisplayFont
    data += b'\x00'                          # UseDuplicate
    data += b'\x00'                          # UseDup1
    data += _bool(s.roundoff)
    data += _bool(s.round_up)
    data += _s(s.currency, 8)
    data += _i(s.round_amt)
    data += b'\x00'                          # ucbAdjust
    data += b'\x00'                          # ucbReviewPasswd
    data += b'\x00'                          # ucbReportPasswd
    data += b'\x00'                          # ucbSTFromStage
    data += _bool(s.st_fare_edit)
    data += _s(s.master_pwd, 11)             # cMasterClearPassword
    data += _b(s.report_flag)
    data += _bool(s.next_fare_flag)
    data += _b(s.stage_updation_msg)         # UpdateStageMsg
    data += _bool(s.remove_ticket_flag)
    data += _bool(s.stage_font_flag)
    data += b'\x00'                          # EnableStageDefault
    data += b'\x00'                          # PrinterSel
    data += _bool(s.odometer_entry)
    data += _bool(s.ticket_no_big_font)
    data += _bool(s.crew_check)
    data += b'\x00' * 13                       # PhNo (no ph_no field in Settings model)
    data += b'\x00'                          # TripSMS
    data += _bool(s.schedulesend_enable)     # ScheduleSMS
    data += b'\x00'                          # TicketRpt
    data += b'\x00'                          # Busno
    data += b'\x00'                          # Driver
    data += b'\x00'                          # Conductor
    data += _bool(s.inspect_rpt)
    data += b'\x00'                          # RepeatST
    data += b'\x01' if s.sendbill_enable == '1' else b'\x00'
    data += _bool(s.tripsend_enable)
    data += _bool(s.schedulesend_enable)
    data += _bool(s.sendpend)
    data += _s(s.ph_no2, 13)                 # PhNo2
    data += _s(s.access_point, 24)
    data += _s(s.dest_adds, 32)
    data += _s(s.username, 16)
    data += _s(s.password, 16)
    data += _s(s.uploadpath, 32)
    data += _s(s.downloadpath, 32)
    data += _s(s.http_url, 64)
    data += _bool(s.gprs_enable)
    data += b'\x00'                          # MsgPrompt
    data += b'\x01' if s.exp_enable == '1' else b'\x00'
    data += b'\x01' if s.smart_card == '1' else b'\x00'
    data += b'\x00'                          # Modomon
    data += b'\x01' if s.ftp_enable == '1' else b'\x00'
    data += _s('', 11)                       # RemovePswd
    data += b'\x00'                          # StageReport_E_D
    data += _bool(s.st_roundoff_enable)
    data += _i(s.st_roundoff_amt)
    data += _bool(s.simple_report)
    data += _b(s.report_font)
    data += _bool(s.multiple_pass)
    data += _bool(s.inspector_sms)
    data += b'\x00'                          # StageEntry
    data += _s(s.ph_no3, 13)
    data += _bool(s.auto_shut_down)
    data += _bool(s.userpswd_enable)
    data += b'\x00'                          # DieselEntryEnable
    data += b'\x00'                          # TripTimeEnable
    data += b'\x00'                          # TripCloseReport
    data += b'\x00'                          # ucPaperFeed
    data += b'\x00'                          # refund
    data += b'\x00'                          # shedule_close_rpt
    data += b'\x00'                          # ladis_per
    data += b'\x00'                          # seniar_per
    data += b'\x00' * 70                     # ucTemp padding

    # ── HARDWARE_SETUP section (64 bytes) ──────────────────────────────────────
    # Ptime (4 bytes): Hour, Min, Sec, Hundredths — zeroed (device sets its own clock)
    data += b'\x00' * 4
    # Pdate (4 bytes): Day, Month, Year(2 bytes) — zeroed
    data += b'\x00' * 4
    data += _s(s.master_pwd, 11)             # MSR_PSWD
    data += _s(s.user_pwd, 11)              # USR_PSWD
    data += _s('', 11)                       # SPR_PSWD (supervisor)
    data += b'\x80'                          # val_contrast  (default mid)
    data += b'\x80'                          # val_brightness
    data += b'\x00'                          # screensaver_onoff
    data += b'\x1E'                          # backlit_timer (30s default)
    data += b'\x00'                          # keyhitdelay
    data += b'\x00'                          # boarder_en
    data += b'\x00'                          # dooropen_alert
    data += b'\x00'                          # paperout_alert
    data += b'\x00'                          # ucHalfPagePrinter
    data += b'\x01'                          # buzz_onoff (on)
    data += b'\x00'                          # rs232_baud
    data += b'\x00'                          # ir_baud
    data += b'\x00'                          # rf_baud
    data += b'\x00'                          # connecting_medium
    data += b'\x00'                          # footer_stat
    data += _b(s.language_option)           # select_language
    data += b'\x00'                          # login_mode
    data += b'\x00'                          # ucKPLight_opt
    data += _i(0)                            # usShuntdownTime
    data += _b(s.language_option)           # LangNo
    data += b'\x00' * 2                     # ucTemp

    return data  # 704 bytes total


def _pack_routelst(route):
    """
    Build RouteLST binary record for one route (64 bytes).
    Matches VB6 Type RouteLST in mdFunctions.bas.
    """
    stage_count = len(route.route_stages.all())
    data  = _s(route.route_code, 5)
    data += _s(route.route_name, 25)
    data += _b(stage_count)
    data += _f(route.min_fare)
    data += _b(route.fare_type)
    data += _bool(route.half)
    data += _bool(route.conc)
    data += _bool(route.ph)
    data += _bool(route.luggage)
    data += _bool(route.adjust)
    data += _b(route.start_from)
    data += _b(route.bus_type.pk % 256)     # BusType byte ID
    data += _s(route.bus_type.name, 16)
    data += _f(0)                            # OptedKM
    data += _bool(route.pass_allow)
    return data  # 64 bytes



def _pack_crewdat(employees):
    """
    Build CREW.DAT binary (32 bytes per employee).
    Matches VB6 Type CREWDET in mdFunctions.bas.
    """
    data = b''
    for emp in employees:
        name = emp.emp_type.emp_type_name.lower()
        if 'driver' in name:          type_byte = 1
        elif 'conductor' in name:     type_byte = 2
        elif 'cleaner' in name:       type_byte = 3
        elif 'inspector' in name:     type_byte = 4
        else:                         type_byte = 0
        data += _s(emp.employee_name, 16)
        data += _s(emp.employee_code, 8)
        data += bytes([type_byte])
        data += _s(emp.password, 7)
    return data  # 32 bytes × employee_count


def _pack_expensedet(expenses):
    """
    Build EXPENSEDET.DAT binary (64 bytes per expense).
    Matches VB6 Type EXPENSEDET and device struct EXPENSEDET1:
      ucType(5) + expname(16) + Reserved(43) = 64 bytes
    """
    data = b''
    for exp in expenses:
        data += _s(exp.expense_code, 5)
        data += _s(exp.expense_name, 16)
        data += b'\x00' * 43             # Reserved padding
    return data  # 64 bytes × expense_count


def _pack_vehicledat(vehicles):
    """
    Build VEHICLE.DAT binary (32 bytes per vehicle).
    Matches VB6 Type VEHICLE and device struct VEHICLE1:
      BUSID(1) + BusNo(16) + Reserved(15) = 32 bytes
    BUSID is the bus-type primary key (modulo 256).
    """
    data = b''
    for v in vehicles:
        data += bytes([v.bus_type.pk % 256])  # BUSID
        data += _s(v.bus_reg_num, 16)          # BusNo
        data += b'\x00' * 15                   # Reserved
    return data  # 32 bytes × vehicle_count


# ─── Additional file packers ───────────────────────────────────────────────────

def _pack_routelst_all(routes):
    """
    Build ROUTELST.LST binary — all routes, 64 bytes each.
    Reuses _pack_routelst() for each route.
    """
    data = b''
    for route in routes:
        data += _pack_routelst(route)
    return data


def _pack_stagelst_global(route_stages):
    """
    Build STAGE.LST binary — all company RouteStage entries, 16 bytes each.
    Matches VB6 Type STAGEDETAILS: StageName(12) + Distance Single(4).

    VB STAGE table is per-route (route, stage, distance), equivalent to RouteStage.
    Stage name truncated to 11 chars + null to ensure null-termination within 12 bytes.
    """
    data = b''
    for rs in route_stages:
        name = (rs.stage.stage_name or '')[:11]
        data += _s(name, 11) + b'\x00'     # 12 bytes, always null-terminated
        data += _f(float(rs.distance or 0))  # Distance (4 bytes)
    return data  # 16 bytes × route_stage_count


def _pack_languagedat(route_stages):
    """
    Build LANGUAGE.DAT binary — 24 bytes per entry (same order as STAGE.LST).
    Matches VB6 LanguageStageCode As String * 24.
    """
    data = b''
    for rs in route_stages:
        data += _s(rs.stage_local_lang or '', 24)
    return data  # 24 bytes × route_stage_count


def _pack_rtedat(routes, stage_index):
    """
    Build RTE.DAT binary.
    Per route: Route header (8 bytes) + fare Singles + stage Int16 IDs.
    Matches VB6 Type Route and fare/stage writing in mdFunctions.bas CreateRTE().
    stage_index: {RouteStage.pk: 1-based position in global STAGE.LST}
    """
    data = b''
    for route in routes:
        rs_qs = list(
            route.route_stages.select_related('stage').order_by('sequence_no')
        )
        nos = len(rs_qs)

        # Route header (8 bytes)
        data += _s(route.route_code, 5)
        data += _b(route.fare_type)
        data += bytes([nos % 256])
        data += b'\x00'  # NoOfDupFare

        fares_qs = Fare.objects.filter(route=route)
        if route.fare_type == 2:
            # Graph/matrix fare: N*(N-1)/2 Singles ordered by number ASC
            fares = list(fares_qs.order_by('number').values_list('fare_amount', flat=True))
        else:
            # Table fare: Singles ordered by fare_amount ASC
            fares = list(fares_qs.order_by('fare_amount').values_list('fare_amount', flat=True))

        for f in fares:
            data += struct.pack('<f', float(f))

        # Stage IDs as Int16 — 1-based position in global STAGE.LST (RouteStage.pk order)
        for rs in rs_qs:
            idx = stage_index.get(rs.pk, 0)
            if idx == 0:
                logger.warning('RTE.DAT: RouteStage pk=%s not in stage_index for route %s', rs.pk, route.route_code)
            data += struct.pack('<h', idx)

    return data


def _pack_currencydat(currencies):
    """
    Build CURRENCY.DAT binary — 8 bytes per entry.
    Matches VB6 Type CREATE_CUR: CurString As String * 8.
    """
    data = b''
    for c in currencies:
        data += _s(c.currency, 8)
    return data  # 8 bytes × currency_count


# ─── Auth helper ───────────────────────────────────────────────────────────────

def _get_company(request):
    """Return company from JWT cookie, or None if unauthenticated."""
    try:
        user = get_user_from_cookie(request)
        if user and hasattr(user, 'company') and user.company:
            return user.company
        return None
    except Exception:
        return None


# ─── Views ─────────────────────────────────────────────────────────────────────

def get_routes_list(request):
    """
    GET /device/routes/
    Returns JSON list of {route_code, route_name} for APK route selection popup.
    """
    if request.method != 'GET':
        return JsonResponse({'message': 'Method not allowed'}, status=405)

    company = _get_company(request)
    if not company:
        return JsonResponse({'message': 'Unauthorized'}, status=401)

    routes = (
        Route.objects
        .filter(company=company, is_deleted=False)
        .values('route_code', 'route_name')
        .order_by('route_code')
    )
    return JsonResponse({'routes': list(routes)})



def get_settings_file(request):
    """
    GET /device/settings/
    Returns BUS.DAT binary (704 bytes).
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    try:
        s = Settings.objects.get(company=company)
    except Settings.DoesNotExist:
        return HttpResponse('SETTINGS_NOT_FOUND', status=404)

    binary = _pack_busdat(s)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="BUS.DAT"'
    return response


def get_crew_file(request):
    """
    GET /device/crew/
    Returns CREW.DAT binary (32 bytes per employee).
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    employees = (
        Employee.objects
        .filter(company=company, is_deleted=False)
        .select_related('emp_type')
        .order_by('employee_code')
    )
    binary = _pack_crewdat(employees)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="CREW.DAT"'
    return response


def get_vehicles_file(request):
    """
    GET /device/vehicles/
    Returns VEHICLE.DAT binary (33 bytes per vehicle).
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    vehicles = (
        VehicleType.objects
        .filter(company=company, is_deleted=False)
        .select_related('bus_type')
        .order_by('bus_reg_num')
    )
    binary = _pack_vehicledat(vehicles)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="VEHICLE.DAT"'
    return response


def get_expenses_file(request):
    """
    GET /device/expenses/
    Returns EXPENSEDET.DAT binary (31 bytes per expense).
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    expenses = (
        ExpenseMaster.objects
        .filter(company=company)
        .order_by('expense_code')
    )
    binary = _pack_expensedet(expenses)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="EXPENSEDET.DAT"'
    return response


def get_routelst_file(request):
    """
    GET /device/routelst[?route_codes=R01,R02]
    Returns ROUTELST.LST binary — 64 bytes per route.
    If route_codes provided, only those routes are included.
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    route_codes = _parse_route_codes(request)
    routes = Route.objects.filter(company=company, is_deleted=False)
    if route_codes:
        routes = routes.filter(route_code__in=route_codes)
    routes = routes.select_related('bus_type').prefetch_related('route_stages__stage').order_by('route_code')

    binary = _pack_routelst_all(routes)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="ROUTELST.LST"'
    return response


def _parse_route_codes(request):
    """
    Parse optional ?route_codes=R01,R02 query param.
    Returns a list of stripped codes, or None if param absent/empty.
    """
    raw = request.GET.get('route_codes', '').strip()
    if not raw:
        return None
    codes = [c.strip() for c in raw.split(',') if c.strip()]
    return codes or None


def _get_ordered_route_stages(company, route_codes=None):
    """
    Return RouteStage entries for company ordered by pk — the canonical
    order used by both STAGE.LST and LANGUAGE.DAT, and indexed by RTE.DAT.
    Mirrors VB: SELECT * FROM STAGE ORDER BY ID (auto-increment pk).
    If route_codes is provided, only stages for those routes are returned.
    """
    qs = RouteStage.objects.filter(company=company).select_related('stage')
    if route_codes:
        qs = qs.filter(route__route_code__in=route_codes)
    return list(qs.order_by('pk'))


def get_stagelst_file(request):
    """
    GET /device/stagelst[?route_codes=R01,R02]
    Returns STAGE.LST binary — RouteStage entries, 16 bytes each.
    If route_codes provided, only stages for those routes are included.
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    route_stages = _get_ordered_route_stages(company, _parse_route_codes(request))
    binary = _pack_stagelst_global(route_stages)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="STAGE.LST"'
    return response


def get_languagedat_file(request):
    """
    GET /device/languagedat[?route_codes=R01,R02]
    Returns LANGUAGE.DAT binary — 24 bytes per entry, same order as STAGE.LST.
    If route_codes provided, only entries for those routes are included.
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    route_stages = _get_ordered_route_stages(company, _parse_route_codes(request))
    binary = _pack_languagedat(route_stages)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="LANGUAGE.DAT"'
    return response


def get_rtedat_file(request):
    """
    GET /device/rtedat[?route_codes=R01,R02]
    Returns RTE.DAT binary — route headers + fare matrices.
    If route_codes provided, only those routes are included.
    stage_index is built from the same filtered route_stages to stay consistent
    with the STAGE.LST that would be generated for the same route_codes.
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    route_codes = _parse_route_codes(request)

    routes_qs = Route.objects.filter(company=company, is_deleted=False)
    if route_codes:
        routes_qs = routes_qs.filter(route_code__in=route_codes)
    routes = list(routes_qs.prefetch_related('route_stages__stage').order_by('route_code'))

    # Must use same filtered set as get_stagelst_file for positional index consistency
    route_stages = _get_ordered_route_stages(company, route_codes)
    stage_index = {rs.pk: i for i, rs in enumerate(route_stages, start=1)}

    binary = _pack_rtedat(routes, stage_index)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="RTE.DAT"'
    return response


def get_currency_file(request):
    """
    GET /device/currency
    Returns CURRENCY.DAT binary — 8 bytes per currency entry.
    """
    if request.method != 'GET':
        return HttpResponse('METHOD_NOT_ALLOWED', status=405)

    company = _get_company(request)
    if not company:
        return HttpResponse('UNAUTHORIZED', status=401)

    currencies = Currency.objects.filter(company=company).order_by('pk')
    binary = _pack_currencydat(currencies)
    response = HttpResponse(binary, content_type='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename="CURRENCY.DAT"'
    return response