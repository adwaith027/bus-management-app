import logging
from datetime import datetime
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from ...models import RawDataLog, OdometerData, ExpenseData, Employee, VehicleType
from ...tasks import (
    process_transaction_data,
    process_trip_open_data, process_trip_close_data, process_trip_close_summary_data,
    process_schedule_open_data, process_schedule_close_data, process_schedule_close_summary_data,
)
from ..utils import _get_company_for_palmtec, _validate_checksum

logger = logging.getLogger('ticket.palmtec')


@csrf_exempt
def getScheduleOpenDataFromDevice(request):
    if request.method != 'GET':
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    # Need at least parts[11] (battery); parts[3]=company, parts[5]=route_code
    if len(parts) < 12:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'ShdOpn':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getScheduleOpen', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.SCHEDULE_OPEN,
            )
            transaction.on_commit(lambda: process_schedule_open_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("ScheduleOpen failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getTripOpenDataFromDevice(request):
    if request.method != 'GET':
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    # Need at least parts[14] (checksum)
    if len(parts) < 15:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'TrpOp':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getTripOpen', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if len(parts) > 3 and parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.TRIP_OPEN,
            )
            transaction.on_commit(lambda: process_trip_open_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("TripOpen failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getTicketDataFromDevice(request):
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    # Need at least parts[45] (checksum); parts[44] = company
    if len(parts) < 46:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'Ticket':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getTicket', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[44]) if parts[44] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.TRANSACTION,
            )
            transaction.on_commit(lambda: process_transaction_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("Ticket failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getScheduleCloseDataFromDevice(request):
    if request.method != 'GET':
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    # Need at least parts[46] (checksum)
    if len(parts) < 47:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'ShdCls':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getScheduleClose', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.SCHEDULE_CLOSE,
            )
            transaction.on_commit(lambda: process_schedule_close_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("ScheduleClose failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getTripCloseDataFromDevice(request):
    if request.method != 'GET':
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    # Need at least parts[37] (checksum); parts[4] = company
    if len(parts) < 38:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'TrpCl':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getTripClose', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[4]) if parts[4] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.TRIP_CLOSE,
            )
            transaction.on_commit(lambda: process_trip_close_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("TripClose failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getTripCloseSummaryFromDevice(request):
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    if parts[0] != 'TrpClSum':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if len(parts) > 3 and parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.TRIP_CLOSE_SUMMARY,
            )
            transaction.on_commit(lambda: process_trip_close_summary_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("TripCloseSummary failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getScheduleCloseSummaryFromDevice(request):
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    if parts[0] != 'ShdClsSum':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if len(parts) > 3 and parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        with transaction.atomic():
            log = RawDataLog.objects.create(
                raw_payload  = raw,
                company_code = company_instance,
                source       = RawDataLog.typeChoices.SCHEDULE_CLOSE_SUMMARY,
            )
            transaction.on_commit(lambda: process_schedule_close_summary_data.delay(log.id))

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except Exception as e:
        logger.exception("ScheduleCloseSummary failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getOdometerDataFromDevice(request):
    # Protocol: [0]=OdoMtr [1]=unique_code [2]=palmtec_id [3]=company_code
    # [4]=schedule_no [5]=trip_no [6]=start_date [7]=start_time
    # [8]=end_date [9]=end_time [10]=driver [11]=bus_no
    # [12]=start_reading [13]=end_reading [14]=checksum [15]=empty
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    if len(parts) < 15:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'OdoMtr':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getOdometerDetails', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        def _p(i, default=None):
            return parts[i] if len(parts) > i and parts[i] else default

        errors = []

        driver_instance = None
        if _p(10):
            driver_instance = Employee.objects.filter(employee_name=_p(10), company=company_instance).first()
            if not driver_instance:
                errors.append(f"driver not matched: {_p(10)}")

        bus_instance = None
        if _p(11):
            bus_instance = VehicleType.objects.filter(bus_reg_num=_p(11), company=company_instance).first()
            if not bus_instance:
                errors.append(f"bus not matched: {_p(11)}")

        start_date     = datetime.strptime(_p(6), "%Y-%m-%d").date() if _p(6) else None
        start_time     = datetime.strptime(_p(7), "%H:%M:%S").time() if _p(7) else None
        start_datetime = datetime.combine(start_date, start_time) if start_date and start_time else None
        end_date       = datetime.strptime(_p(8), "%Y-%m-%d").date() if _p(8) else None
        end_time       = datetime.strptime(_p(9), "%H:%M:%S").time() if _p(9) else None
        end_datetime   = datetime.combine(end_date, end_time) if end_date and end_time else None

        OdometerData.objects.create(
            unique_code    = _p(1),
            palmtec_id     = _p(2),
            company_code   = company_instance,
            schedule_no    = int(_p(4)),
            trip_no        = int(_p(5)),
            start_date     = start_date,
            start_time     = start_time,
            start_datetime = start_datetime,
            end_date       = end_date,
            end_time       = end_time,
            end_datetime   = end_datetime,
            driver         = _p(10),
            driver_id      = driver_instance,
            bus_no         = _p(11),
            bus_id         = bus_instance,
            start_reading  = Decimal(_p(12, '0')),
            end_reading    = Decimal(_p(13, '0')),
            source         = OdometerData.SourceType.API,
            checksum       = _p(14),
            raw_payload    = raw,
            error_reason   = "; ".join(errors) if errors else None,
        )

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except IntegrityError:
        return HttpResponse(f'OK#DUPLICATE#fn={parts[1]}#', content_type="text/plain", status=200)
    except Exception as e:
        logger.exception("OdometerData failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")


@csrf_exempt
def getExpenseDataFromDevice(request):
    # Protocol: [0]=ExpDtl [1]=unique_code [2]=palmtec_id [3]=company_code
    # [4]=schedule_no [5]=trip_no [6]=YYYY-MM-DD [7]=HH:MM:00
    # [8]=driver [9]=bus_no [10]=expense_amount [11]=diesel_amount
    # [12]=expense_type [13]=expense_name [14]=checksum [15]=empty
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED", status=405, content_type="text/plain")

    raw = request.GET.get("fn")
    if not raw:
        return HttpResponse("NO_DATA", status=400, content_type="text/plain")

    parts = raw.split("|")

    if len(parts) < 15:
        return HttpResponse("MISSING_DATA", status=400, content_type="text/plain")

    if parts[0] != 'ExpDtl':
        return HttpResponse("INVALID", status=400, content_type="text/plain")

    if not _validate_checksum('getExpenseDetails', raw):
        return HttpResponse("INVALID_CHECKSUM", status=400, content_type="text/plain")

    try:
        company_instance = _get_company_for_palmtec(parts[3]) if parts[3] else None
        if not company_instance:
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")

        def _p(i, default=None):
            return parts[i] if len(parts) > i and parts[i] else default

        errors = []

        driver_instance = None
        if _p(8):
            driver_instance = Employee.objects.filter(employee_name=_p(8), company=company_instance).first()
            if not driver_instance:
                errors.append(f"driver not matched: {_p(8)}")

        bus_instance = None
        if _p(9):
            bus_instance = VehicleType.objects.filter(bus_reg_num=_p(9), company=company_instance).first()
            if not bus_instance:
                errors.append(f"bus not matched: {_p(9)}")

        expense_date     = datetime.strptime(_p(6), "%Y-%m-%d").date() if _p(6) else None
        expense_time     = datetime.strptime(_p(7), "%H:%M:%S").time() if _p(7) else None
        expense_datetime = datetime.combine(expense_date, expense_time) if expense_date and expense_time else None

        ExpenseData.objects.create(
            unique_code      = _p(1),
            palmtec_id       = _p(2),
            company_code     = company_instance,
            schedule_no      = int(_p(4)),
            trip_no          = int(_p(5)),
            expense_date     = expense_date,
            expense_time     = expense_time,
            expense_datetime = expense_datetime,
            driver           = _p(8),
            driver_id        = driver_instance,
            bus_no           = _p(9),
            bus_id           = bus_instance,
            expense_amount   = Decimal(_p(10, '0')),
            diesel_amount    = Decimal(_p(11, '0')),
            expense_type     = int(_p(12)) if _p(12) else None,
            expense_name     = _p(13),
            source           = ExpenseData.SourceType.API,
            checksum         = _p(14),
            raw_payload      = raw,
            error_reason     = "; ".join(errors) if errors else None,
        )

        return HttpResponse(f'OK#SUCCESS#fn={parts[1]}#', content_type="text/plain", status=200)

    except IntegrityError:
        return HttpResponse(f'OK#DUPLICATE#fn={parts[1]}#', content_type="text/plain", status=200)
    except Exception as e:
        logger.exception("ExpenseData failed: %s", e)
        return HttpResponse("ERROR", status=500, content_type="text/plain")
