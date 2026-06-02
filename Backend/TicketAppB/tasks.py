from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone
from decimal import Decimal
from datetime import datetime, timedelta
from .models import (
    RawDataLog, TransactionData, Direction, RouteStage,
    ScheduleData, TripData, Employee, VehicleType,
)
from .views.utils import _get_route_for_palmtec


@shared_task
def blacklist_refresh_token(refresh_token_str):
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.exceptions import TokenError
    try:
        RefreshToken(refresh_token_str).blacklist()
    except TokenError:
        pass


def _fail(log, msg):
    log.status = RawDataLog.statusChoices.FAILED
    log.error_message = msg
    log.save()


def _parse_date(s, fmt="%Y-%m-%d"):
    """Parse date string; corrects 2-digit year stored as %04d (e.g. 0026 → 2026)."""
    if not s:
        return None
    d = datetime.strptime(s, fmt).date()
    return d.replace(year=d.year + 2000) if d.year < 100 else d


def _parse_time(s, fmt="%H:%M:%S"):
    if not s:
        return None
    try:
        return datetime.strptime(s, fmt).time()
    except ValueError:
        return datetime.strptime(s, "%H:%M").time()


def _resolve_schedule(palmtec_id, company_id, schedule_no, schedule_start_date):
    if not schedule_no or not schedule_start_date:
        return None
    return ScheduleData.objects.filter(
        palmtec_id=palmtec_id,
        company_code_id=company_id,
        schedule_no=schedule_no,
        start_date=schedule_start_date,
    ).first()


def _resolve_trip(palmtec_id, company_id, trip_no, trip_start_date):
    if not trip_no or not trip_start_date:
        return None
    return TripData.objects.filter(
        palmtec_id=palmtec_id,
        company_code_id=company_id,
        trip_no=trip_no,
        start_date=trip_start_date,
    ).first()


def _resolve_employee(employee_code, company_id):
    if not employee_code:
        return None
    return Employee.objects.filter(
        employee_code=employee_code,
        company_id=company_id,
        is_deleted=False,
    ).first()


def _resolve_vehicle(bus_reg_num, company_id):
    if not bus_reg_num:
        return None
    return VehicleType.objects.filter(
        bus_reg_num=bus_reg_num,
        company_id=company_id,
        is_deleted=False,
    ).first()


# ─────────────────────────────────────────────────────────────────────────────
# Ticket / Transaction
# Protocol (new firmware with shd_opn_d/shd_opn_t):
#   [0]=fn  [1]=unique_code  [2]=palmtec_id  [3]=route_code
#   [4]=trip_no  [5]=ticket_no
#   [6]=schedule_start_date  [7]=schedule_start_time
#   [8]=ticket_date  [9]=ticket_time
#   [10]=from_stage  [11]=to_stage
#   [12]=full  [13]=half  [14]=st  [15]=phy  [16]=lugg
#   [17]=amount  [18]=lugg_amount  [19]=ticket_type  [20]=adjust_amount
#   [21]=pass_id  [22]=warrant  [23]=refund_status  [24]=refund_amount
#   [25]=ladies  [26]=senior
#   [27]=bus_no  [28]=schedule_no  [29]=driver  [30]=conductor
#   [31]=up_down_trip (char as %d, e.g. 85='U', 68='D')
#   [32]=trip_start_date  [33]=trip_start_time  [34]=battery
#   [35]=passenger_count
#   [36]=full_total  [37]=half_total  [38]=phy_total  [39]=ladies_total
#   [40]=senior_total  [41]=lugg_total  [42]=st_total
#   [43]=transaction_id  [44]=ticket_status  [45]=bqr_merchant_id
#   [46]=license_code(company)  [47]=upi_manual_check (1=manual, 0=auto)  [48]=checksum
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_transaction_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {
                'palmtec_id':    _p(2),
                'route_code':    _p(3),
                'trip_no':       _p(4),
                'ticket_number': _p(5),
                'ticket_date':   _p(8),
                'ticket_time':   _p(9),
                'from_stage':    _p(10),
                'to_stage':      _p(11),
                'schedule_no':   _p(28),
            }
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(3), company)
            if not route:
                _fail(log, f"Route not found: {_p(3)}")
                return

            full_count   = int(_p(12, 0))
            half_count   = int(_p(13, 0))
            st_count     = int(_p(14, 0))
            phy_count    = int(_p(15, 0))
            lugg_count   = int(_p(16, 0))
            ladies_count = int(_p(25, 0))
            senior_count = int(_p(26, 0))
            total_tickets = full_count + half_count + st_count + phy_count + lugg_count + ladies_count + senior_count

            raw_status = _p(44, '0')
            ticket_status = (
                TransactionData.PaymentMode.UPI if raw_status == '1'
                else TransactionData.PaymentMode.CASH
            )

            raw_dir_val = _p(31, '')
            try:
                raw_dir = chr(int(raw_dir_val)) if raw_dir_val else ''
            except (ValueError, TypeError):
                raw_dir = raw_dir_val
            up_down_trip = (
                Direction.UP   if raw_dir == 'U' else
                Direction.DOWN if raw_dir == 'D' else None
            )

            stages = RouteStage.objects.filter(route=route).order_by('sequence_no')
            from_raw = int(_p(10))
            to_raw   = int(_p(11))
            from_stage_obj = to_stage_obj = None
            if stages:
                if from_raw > 0:
                    try:
                        from_stage_obj = stages[from_raw - 1]
                    except IndexError:
                        pass
                if to_raw > 0:
                    try:
                        to_stage_obj = stages[to_raw - 1]
                    except IndexError:
                        pass

            if _p(6) == "0000-00-00":
                _fail(log, "Invalid schedule date: device sent 0000-00-00")
                return
            if _p(32) == "0000-00-00":
                _fail(log, "Invalid trip start date: device sent 0000-00-00")
                return

            trip_no         = int(_p(4))
            trip_start_date = _parse_date(_p(32))
            schedule_no     = int(_p(28))
            schedule_start_date = _parse_date(_p(6))

            trip_obj     = _resolve_trip(str(_p(2)), company.id, trip_no, trip_start_date)
            schedule_obj = (trip_obj.schedule_id if trip_obj else None) or \
                           _resolve_schedule(str(_p(2)), company.id, schedule_no, schedule_start_date)

            try:
                with transaction.atomic():
                    TransactionData.objects.create(
                        unique_code          = _p(1),
                        palmtec_id           = _p(2),
                        route_id             = route,
                        trip_id              = trip_obj,
                        schedule_id          = schedule_obj,
                        ticket_number        = _p(5),
                        ticket_date          = _parse_date(_p(8)),
                        ticket_time          = _parse_time(_p(9)),
                        from_stage           = from_raw,
                        from_stage_id        = from_stage_obj,
                        to_stage             = to_raw,
                        to_stage_id          = to_stage_obj,
                        full_count           = full_count,
                        half_count           = half_count,
                        st_count             = st_count,
                        phy_count            = phy_count,
                        lugg_count           = lugg_count,
                        ladies_count         = ladies_count,
                        senior_count         = senior_count,
                        total_tickets        = total_tickets,
                        ticket_amount        = Decimal(_p(17, '0')),
                        lugg_amount          = Decimal(_p(18, '0')),
                        ticket_type          = int(_p(19)) if _p(19) else None,
                        adjust_amount        = Decimal(_p(20, '0')),
                        pass_id              = _p(21),
                        warrant_amount       = Decimal(_p(22, '0')),
                        refund_status        = int(_p(23)) if _p(23) else None,
                        refund_amount        = Decimal(_p(24, '0')),
                        bus_no               = _p(27),
                        driver               = _p(29),
                        conductor            = _p(30),
                        up_down_trip         = up_down_trip,
                        trip_start_date      = trip_start_date,
                        trip_start_time      = _parse_time(_p(33)),
                        battery_percentage   = int(_p(34)) if _p(34) else None,
                        passenger_count      = int(_p(35)) if _p(35) else None,
                        full_total_amount    = Decimal(_p(36, '0')),
                        half_total_amount    = Decimal(_p(37, '0')),
                        phy_total_amount     = Decimal(_p(38, '0')),
                        ladies_total_amount  = Decimal(_p(39, '0')),
                        senior_total_amount  = Decimal(_p(40, '0')),
                        luggage_total_amount = Decimal(_p(41, '0')),
                        st_total_amount      = Decimal(_p(42, '0')),
                        transaction_id       = _p(43),
                        ticket_status        = ticket_status,
                        bqr_merchant_id      = _p(45),
                        manual_verified_upi  = (int(_p(47)) == 1) if _p(47) is not None else None,
                        company_code         = company,
                        raw_payload          = log.raw_payload,
                    )

            except IntegrityError as ie:
                log.status = RawDataLog.statusChoices.DUPLICATE
                log.error_message = str(ie)
                log.save()
                return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Trip Open
# Protocol (new firmware — schedule_no added after license_code):
#   [0]=fn  [1]=unique_code  [2]=palmtec_id  [3]=license_code
#   [4]=schedule_no  [5]=route_code  [6]=up_down_trip  [7]=trip_no
#   [8]=bus_no  [9]=driver  [10]=conductor
#   [11]=schedule_start_date  [12]=schedule_start_time
#   [13]=trip_start_date  [14]=trip_start_time
#   [15]=battery
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_trip_open_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {'route_code': _p(5), 'trip_no': _p(7)}
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(5), company)
            if not route:
                _fail(log, f"Route not found: {_p(5)}")
                return

            raw_dir = _p(6, '')
            up_down_trip = (
                Direction.UP   if raw_dir == 'U' else
                Direction.DOWN if raw_dir == 'D' else None
            )

            schedule_no         = int(_p(4)) if _p(4) else None
            schedule_start_date = _parse_date(_p(11))
            schedule_start_time = _parse_time(_p(12))
            trip_no             = int(_p(7))
            start_date          = _parse_date(_p(13))
            start_time          = _parse_time(_p(14))
            start_datetime      = timezone.make_aware(datetime.combine(start_date, start_time)) if start_date and start_time else None
            battery             = int(_p(15)) if _p(15) else None

            # ── Resolve FKs ───────────────────────────────────────────────────
            schedule_obj  = _resolve_schedule(_p(2), company.id, schedule_no, schedule_start_date)
            driver_obj    = _resolve_employee(_p(9),  company.id)
            conductor_obj = _resolve_employee(_p(10), company.id)
            bus_obj       = _resolve_vehicle(_p(8),   company.id)

            # ── TripData upsert ───────────────────────────────────────────────
            existing = _resolve_trip(_p(2), company.id, trip_no, start_date)
            if existing:
                # Late open arriving after ghost close
                update_fields = ['open_unique_code', 'bus_no', 'bus_id', 'driver', 'driver_id',
                                 'conductor', 'conductor_id', 'up_down_trip', 'start_time',
                                 'start_datetime', 'battery_percentage', 'open_raw_payload', 'updated_at']
                existing.open_unique_code  = _p(1)
                existing.bus_no            = _p(8)
                existing.bus_id            = bus_obj
                existing.driver            = _p(9)
                existing.driver_id         = driver_obj
                existing.conductor         = _p(10)
                existing.conductor_id      = conductor_obj
                existing.up_down_trip      = up_down_trip
                existing.start_time        = start_time
                existing.start_datetime    = start_datetime
                existing.battery_percentage = battery
                existing.open_raw_payload  = log.raw_payload
                if existing.ghost_note:
                    existing.ghost_note = None
                    update_fields.append('ghost_note')
                if not existing.schedule_id and schedule_obj:
                    existing.schedule_id         = schedule_obj
                    existing.schedule_no         = schedule_no
                    existing.schedule_start_date = schedule_start_date
                    existing.schedule_start_time = schedule_start_time
                    update_fields += ['schedule_id', 'schedule_no', 'schedule_start_date', 'schedule_start_time']
                existing.save(update_fields=update_fields)
            else:
                try:
                    with transaction.atomic():
                        TripData.objects.create(
                            open_unique_code    = _p(1),
                            palmtec_id          = _p(2),
                            route_id            = route,
                            schedule_id         = schedule_obj,
                            schedule_no         = schedule_no,
                            schedule_start_date = schedule_start_date,
                            schedule_start_time = schedule_start_time,
                            trip_no             = trip_no,
                            up_down_trip        = up_down_trip,
                            bus_no              = _p(8),
                            bus_id              = bus_obj,
                            driver              = _p(9),
                            driver_id           = driver_obj,
                            conductor           = _p(10),
                            conductor_id        = conductor_obj,
                            start_date          = start_date,
                            start_time          = start_time,
                            start_datetime      = start_datetime,
                            battery_percentage  = battery,
                            is_closed           = False,
                            open_raw_payload    = log.raw_payload,
                            company_code        = company,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Trip Close
# Protocol (current firmware with shd_opn_d/shd_opn_t):
#   [0]=fn  [1]=unique_code  [2]=palmtec_id  [3]=license_code
#   [4]=route_code  [5]=schedule_no  [6]=trip_no
#   [7]=schedule_start_date  [8]=schedule_start_time
#   [9]=trip_start_date  [10]=trip_start_time
#   [11]=trip_end_date  [12]=trip_end_time
#   [13]=driver  [14]=conductor  [15]=total_km
#   [16]=start_ticket_no  [17]=end_ticket_no
#   [18]=full  [19]=half  [20]=st  [21]=lugg  [22]=phy  [23]=pass
#   [24]=ladies  [25]=senior
#   [26]=full_coll  [27]=half_coll  [28]=st_coll  [29]=lugg_coll
#   [30]=phy_coll  [31]=ladies_coll  [32]=senior_coll
#   [33]=adjust_coll  [34]=expense_amount  [35]=total_coll
#   [36]=upi_count  [37]=upi_amount  [38]=up_down_trip  [39]=total_passengers
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_trip_close_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {'route_code': _p(4), 'schedule_no': _p(5), 'trip_no': _p(6)}
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(4), company)
            if not route:
                _fail(log, f"Route not found: {_p(4)}")
                return

            schedule_no         = int(_p(5))
            trip_no             = int(_p(6))
            schedule_start_date = _parse_date(_p(7))
            schedule_start_time = _parse_time(_p(8))
            start_date          = _parse_date(_p(9))
            start_time          = _parse_time(_p(10))
            end_date            = _parse_date(_p(11))
            end_time            = _parse_time(_p(12))
            start_datetime      = timezone.make_aware(datetime.combine(start_date, start_time)) if start_date and start_time else None
            end_datetime        = timezone.make_aware(datetime.combine(end_date, end_time)) if end_date and end_time else None

            full_count     = int(_p(18, 0))
            half_count     = int(_p(19, 0))
            st1_count      = int(_p(20, 0))
            luggage_count  = int(_p(21, 0))
            physical_count = int(_p(22, 0))
            pass_count     = int(_p(23, 0))
            ladies_count   = int(_p(24, 0))
            senior_count   = int(_p(25, 0))
            upi_count      = int(_p(36, 0))

            total_tickets      = (full_count + half_count + st1_count + luggage_count +
                                  physical_count + pass_count + ladies_count + senior_count)
            total_cash_tickets = max(0, total_tickets - upi_count)

            total_coll = Decimal(_p(35, '0'))
            upi_amount = Decimal(_p(37, '0'))
            total_pass = int(_p(39, 0))

            raw_dir = _p(38, '')
            up_down_trip = (
                Direction.UP   if raw_dir == 'U' else
                Direction.DOWN if raw_dir == 'D' else None
            )

            # ── Resolve FKs ───────────────────────────────────────────────────
            schedule_obj  = _resolve_schedule(_p(2), company.id, schedule_no, schedule_start_date)
            driver_obj    = _resolve_employee(_p(13), company.id)
            conductor_obj = _resolve_employee(_p(14), company.id)

            close_fields = dict(
                close_unique_code   = _p(1),
                schedule_id         = schedule_obj,
                schedule_no         = schedule_no,
                schedule_start_date = schedule_start_date,
                schedule_start_time = schedule_start_time,
                end_date            = end_date,
                end_time            = end_time,
                end_datetime        = end_datetime,
                driver              = _p(13),
                conductor           = _p(14),
                total_km            = Decimal(_p(15, '0')),
                start_ticket_no     = int(_p(16, 0)),
                end_ticket_no       = int(_p(17, 0)),
                full_count          = full_count,
                half_count          = half_count,
                st_count            = st1_count,
                luggage_count       = luggage_count,
                physical_count      = physical_count,
                pass_count          = pass_count,
                ladies_count        = ladies_count,
                senior_count        = senior_count,
                total_tickets       = total_tickets,
                total_cash_tickets  = total_cash_tickets,
                total_passengers    = total_pass,
                full_collection     = Decimal(_p(26, '0')),
                half_collection     = Decimal(_p(27, '0')),
                st_collection       = Decimal(_p(28, '0')),
                luggage_collection  = Decimal(_p(29, '0')),
                physical_collection = Decimal(_p(30, '0')),
                ladies_collection   = Decimal(_p(31, '0')),
                senior_collection   = Decimal(_p(32, '0')),
                adjust_collection   = Decimal(_p(33, '0')),
                expense_amount      = Decimal(_p(34, '0')),
                total_collection    = total_coll,
                upi_ticket_count    = upi_count,
                upi_ticket_amount   = upi_amount,
                up_down_trip        = up_down_trip,
                driver_id           = driver_obj,
                conductor_id        = conductor_obj,
                is_closed           = True,
                auto_opened         = False,
                ghost_note          = None,
                close_raw_payload   = log.raw_payload,
            )

            # ── TripData upsert ───────────────────────────────────────────────
            existing = _resolve_trip(_p(2), company.id, trip_no, start_date)
            if existing:
                for k, v in close_fields.items():
                    setattr(existing, k, v)
                existing.save()
            else:
                try:
                    with transaction.atomic():
                        TripData.objects.create(
                            palmtec_id          = _p(2),
                            route_id            = route,
                            trip_no             = trip_no,
                            start_date          = start_date,
                            start_time          = start_time,
                            start_datetime      = start_datetime,
                            auto_opened         = True,
                            ghost_note          = "TrpCl received; TrpOp missing",
                            company_code        = company,
                            **close_fields,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Schedule Open
# Protocol (unchanged):
#   [0]=fn  [1]=unique_code  [2]=palmtec_id  [3]=license_code
#   [4]=schedule_no
#   [5]=start_date  [6]=start_time
#   [7]=driver  [8]=conductor  [9]=bus_no
#   [10]=battery
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_schedule_open_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            if not _p(4):
                _fail(log, "Missing required fields: schedule_no")
                return

            schedule_no    = int(_p(4))
            start_date     = _parse_date(_p(5))
            start_time     = _parse_time(_p(6))
            start_datetime = timezone.make_aware(datetime.combine(start_date, start_time)) if start_date and start_time else None
            battery        = int(_p(10)) if _p(10) else None

            # ── Resolve FKs ───────────────────────────────────────────────────
            driver_obj    = _resolve_employee(_p(7), company.id)
            conductor_obj = _resolve_employee(_p(8), company.id)
            bus_obj       = _resolve_vehicle(_p(9),  company.id)

            # ── ScheduleData upsert ───────────────────────────────────────────
            existing = ScheduleData.objects.filter(
                palmtec_id=_p(2),
                company_code=company,
                schedule_no=schedule_no,
                start_date=start_date,
            ).first()

            if existing:
                # Late open arriving after ghost close — fill open fields
                existing.open_unique_code = _p(1)
                existing.driver           = _p(7)
                existing.driver_id        = driver_obj
                existing.conductor        = _p(8)
                existing.conductor_id     = conductor_obj
                existing.bus_no           = _p(9)
                existing.bus_id           = bus_obj
                existing.start_time       = start_time
                existing.start_datetime   = start_datetime
                existing.battery_open     = battery
                existing.open_raw_payload = log.raw_payload
                existing.ghost_note       = None
                existing.save(update_fields=[
                    'open_unique_code', 'driver', 'driver_id', 'conductor', 'conductor_id',
                    'bus_no', 'bus_id', 'start_time', 'start_datetime', 'battery_open',
                    'open_raw_payload', 'ghost_note', 'updated_at',
                ])
            else:
                try:
                    with transaction.atomic():
                        ScheduleData.objects.create(
                            open_unique_code  = _p(1),
                            palmtec_id        = _p(2),
                            schedule_no       = schedule_no,
                            driver            = _p(7),
                            driver_id         = driver_obj,
                            conductor         = _p(8),
                            conductor_id      = conductor_obj,
                            bus_no            = _p(9),
                            bus_id            = bus_obj,
                            start_date        = start_date,
                            start_time        = start_time,
                            start_datetime    = start_datetime,
                            battery_open      = battery,
                            is_closed         = False,
                            open_raw_payload  = log.raw_payload,
                            company_code      = company,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Schedule Close
# Protocol (current firmware with shd_opn_d/shd_opn_t):
#   [0]=fn  [1]=unique_code  [2]=palmtec_id  [3]=license_code
#   [4]=route_code  [5]=schedule_no
#   [6]=schedule_start_date (shd_opn_d)  [7]=schedule_start_time (shd_opn_t)
#   [8]=end_date  [9]=end_time
#   [10]=driver  [11]=conductor  [12]=bus_no
#   [13]=total_tickets  [14]=full  [15]=half  [16]=phy  [17]=ladies
#   [18]=senior  [19]=lugg  [20]=st  [21]=adjust
#   [22]=total_coll  [23]=full_coll  [24]=half_coll  [25]=phy_coll
#   [26]=ladies_coll  [27]=senior_coll  [28]=st_coll  [29]=adjust_coll  [30]=lugg_coll
#   [31]=upi_total  [32]=upi_full  [33]=upi_half  [34]=upi_phy
#   [35]=upi_ladies  [36]=upi_senior  [37]=upi_st  [38]=upi_lugg
#   [39]=upi_full_cnt  [40]=upi_half_cnt  [41]=upi_phy_cnt  [42]=upi_ladies_cnt
#   [43]=upi_senior_cnt  [44]=upi_lugg_cnt  [45]=upi_st_cnt
#   [46]=battery
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_schedule_close_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {
                'route_code':  _p(4),
                'schedule_no': _p(5),
                'end_date':    _p(8),
                'end_time':    _p(9),
            }
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(4), company)
            if not route:
                _fail(log, f"Route not found: {_p(4)}")
                return

            schedule_no         = int(_p(5))
            schedule_start_date = _parse_date(_p(6))
            schedule_start_time = _parse_time(_p(7))
            end_date            = _parse_date(_p(8))
            end_time            = _parse_time(_p(9))
            end_datetime        = timezone.make_aware(datetime.combine(end_date, end_time)) if end_date and end_time else None

            # ── Resolve FKs ───────────────────────────────────────────────────
            driver_obj    = _resolve_employee(_p(10), company.id)
            conductor_obj = _resolve_employee(_p(11), company.id)
            bus_obj       = _resolve_vehicle(_p(12),  company.id)

            # ── ScheduleData upsert ───────────────────────────────────────────
            close_fields_new = dict(
                close_unique_code       = _p(1),
                route_id                = route,
                driver                  = _p(10),
                driver_id               = driver_obj,
                conductor               = _p(11),
                conductor_id            = conductor_obj,
                bus_no                  = _p(12),
                bus_id                  = bus_obj,
                end_date                = end_date,
                end_time                = end_time,
                end_datetime            = end_datetime,
                battery_close           = int(_p(46)) if _p(46) else None,
                total_tickets           = int(_p(13, 0)),
                full_count              = int(_p(14, 0)),
                half_count              = int(_p(15, 0)),
                physical_count          = int(_p(16, 0)),
                ladies_count            = int(_p(17, 0)),
                senior_count            = int(_p(18, 0)),
                luggage_count           = int(_p(19, 0)),
                st_count                = int(_p(20, 0)),
                adjust_count            = int(_p(21, 0)),
                total_collection        = Decimal(_p(22, '0')),
                full_collection         = Decimal(_p(23, '0')),
                half_collection         = Decimal(_p(24, '0')),
                physical_collection     = Decimal(_p(25, '0')),
                ladies_collection       = Decimal(_p(26, '0')),
                senior_collection       = Decimal(_p(27, '0')),
                st_collection           = Decimal(_p(28, '0')),
                adjust_collection       = Decimal(_p(29, '0')),
                luggage_collection      = Decimal(_p(30, '0')),
                upi_total_collection    = Decimal(_p(31, '0')),
                upi_full_collection     = Decimal(_p(32, '0')),
                upi_half_collection     = Decimal(_p(33, '0')),
                upi_physical_collection = Decimal(_p(34, '0')),
                upi_ladies_collection   = Decimal(_p(35, '0')),
                upi_senior_collection   = Decimal(_p(36, '0')),
                upi_st_collection       = Decimal(_p(37, '0')),
                upi_luggage_collection  = Decimal(_p(38, '0')),
                upi_full_count          = int(_p(39, 0)),
                upi_half_count          = int(_p(40, 0)),
                upi_physical_count      = int(_p(41, 0)),
                upi_ladies_count        = int(_p(42, 0)),
                upi_senior_count        = int(_p(43, 0)),
                upi_luggage_count       = int(_p(44, 0)),
                upi_st_count            = int(_p(45, 0)),
                is_closed               = True,
                auto_opened             = False,
                ghost_note              = None,
                close_raw_payload       = log.raw_payload,
            )

            existing = ScheduleData.objects.filter(
                palmtec_id=_p(2),
                company_code=company,
                schedule_no=schedule_no,
                start_date=schedule_start_date,
            ).first()

            if existing:
                for k, v in close_fields_new.items():
                    setattr(existing, k, v)
                existing.save()
            else:
                # Ghost: ShdCls arrived without ShdOpn
                try:
                    with transaction.atomic():
                        ScheduleData.objects.create(
                            palmtec_id  = _p(2),
                            schedule_no = schedule_no,
                            start_date  = schedule_start_date,
                            start_time  = schedule_start_time,
                            start_datetime = (
                                timezone.make_aware(datetime.combine(schedule_start_date, schedule_start_time))
                                if schedule_start_date and schedule_start_time else None
                            ),
                            auto_opened  = True,
                            ghost_note   = "ShdCls received; ShdOpn missing",
                            company_code = company,
                            **close_fields_new,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Trip Close Summary
# Protocol: identical to TrpCl (fn=TrpClSum). Firmware resend when TrpCl
# was not acknowledged. Idempotent: if trip already closed → DUPLICATE.
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_trip_close_summary_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {'route_code': _p(4), 'schedule_no': _p(5), 'trip_no': _p(6)}
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(4), company)
            if not route:
                _fail(log, f"Route not found: {_p(4)}")
                return

            schedule_no         = int(_p(5))
            trip_no             = int(_p(6))
            schedule_start_date = _parse_date(_p(7))
            schedule_start_time = _parse_time(_p(8))
            start_date          = _parse_date(_p(9))
            start_time          = _parse_time(_p(10))
            end_date            = _parse_date(_p(11))
            end_time            = _parse_time(_p(12))
            start_datetime      = timezone.make_aware(datetime.combine(start_date, start_time)) if start_date and start_time else None
            end_datetime        = timezone.make_aware(datetime.combine(end_date, end_time)) if end_date and end_time else None

            full_count     = int(_p(18, 0))
            half_count     = int(_p(19, 0))
            st1_count      = int(_p(20, 0))
            luggage_count  = int(_p(21, 0))
            physical_count = int(_p(22, 0))
            pass_count     = int(_p(23, 0))
            ladies_count   = int(_p(24, 0))
            senior_count   = int(_p(25, 0))
            upi_count      = int(_p(36, 0))

            total_tickets      = (full_count + half_count + st1_count + luggage_count +
                                  physical_count + pass_count + ladies_count + senior_count)
            total_cash_tickets = max(0, total_tickets - upi_count)

            total_coll  = Decimal(_p(35, '0'))
            upi_amount  = Decimal(_p(37, '0'))
            total_pass  = int(_p(39, 0))

            raw_dir = _p(38, '')
            up_down_trip = (
                Direction.UP   if raw_dir == 'U' else
                Direction.DOWN if raw_dir == 'D' else None
            )

            # ── Idempotency guard ─────────────────────────────────────────────
            existing = _resolve_trip(_p(2), company.id, trip_no, start_date)
            if existing and existing.is_closed:
                log.status = RawDataLog.statusChoices.DUPLICATE
                log.error_message = "TrpClSum: trip already closed by TrpCl"
                log.save()
                return

            schedule_obj  = _resolve_schedule(_p(2), company.id, schedule_no, schedule_start_date)
            driver_obj    = _resolve_employee(_p(13), company.id)
            conductor_obj = _resolve_employee(_p(14), company.id)

            close_fields = dict(
                close_unique_code   = _p(1),
                schedule_id         = schedule_obj,
                schedule_no         = schedule_no,
                schedule_start_date = schedule_start_date,
                schedule_start_time = schedule_start_time,
                end_date            = end_date,
                end_time            = end_time,
                end_datetime        = end_datetime,
                driver              = _p(13),
                driver_id           = driver_obj,
                conductor           = _p(14),
                conductor_id        = conductor_obj,
                total_km            = Decimal(_p(15, '0')),
                start_ticket_no     = int(_p(16, 0)),
                end_ticket_no       = int(_p(17, 0)),
                full_count          = full_count,
                half_count          = half_count,
                st_count            = st1_count,
                luggage_count       = luggage_count,
                physical_count      = physical_count,
                pass_count          = pass_count,
                ladies_count        = ladies_count,
                senior_count        = senior_count,
                total_tickets       = total_tickets,
                total_cash_tickets  = total_cash_tickets,
                total_passengers    = total_pass,
                full_collection     = Decimal(_p(26, '0')),
                half_collection     = Decimal(_p(27, '0')),
                st_collection       = Decimal(_p(28, '0')),
                luggage_collection  = Decimal(_p(29, '0')),
                physical_collection = Decimal(_p(30, '0')),
                ladies_collection   = Decimal(_p(31, '0')),
                senior_collection   = Decimal(_p(32, '0')),
                adjust_collection   = Decimal(_p(33, '0')),
                expense_amount      = Decimal(_p(34, '0')),
                total_collection    = total_coll,
                upi_ticket_count    = upi_count,
                upi_ticket_amount   = upi_amount,
                up_down_trip        = up_down_trip,
                is_closed           = True,
                auto_opened         = False,
                ghost_note          = None,
                close_raw_payload   = log.raw_payload,
            )

            if existing:
                for k, v in close_fields.items():
                    setattr(existing, k, v)
                existing.save()
            else:
                try:
                    with transaction.atomic():
                        TripData.objects.create(
                            palmtec_id   = _p(2),
                            route_id     = route,
                            trip_no      = trip_no,
                            start_date   = start_date,
                            start_time   = start_time,
                            start_datetime = start_datetime,
                            auto_opened  = True,
                            ghost_note   = "TrpClSum received; TrpOp missing",
                            company_code = company,
                            **close_fields,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


# ─────────────────────────────────────────────────────────────────────────────
# Schedule Close Summary
# Protocol: identical to ShdCls (fn=ShdClsSum). Firmware resend when ShdCls
# was not acknowledged. Idempotent: if schedule already closed → DUPLICATE.
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3)
def process_schedule_close_summary_data(self, log_id):
    try:
        with transaction.atomic():
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            company = log.company_code
            if not company:
                _fail(log, "Invalid Company Code")
                return

            parts = log.raw_payload.split("|")

            def _p(i, default=None):
                return parts[i] if len(parts) > i and parts[i].strip() else default

            required = {
                'route_code':  _p(4),
                'schedule_no': _p(5),
                'end_date':    _p(8),
                'end_time':    _p(9),
            }
            missing = [k for k, v in required.items() if not v]
            if missing:
                _fail(log, f"Missing required fields: {', '.join(missing)}")
                return

            route = _get_route_for_palmtec(_p(4), company)
            if not route:
                _fail(log, f"Route not found: {_p(4)}")
                return

            schedule_no         = int(_p(5))
            schedule_start_date = _parse_date(_p(6))
            schedule_start_time = _parse_time(_p(7))
            end_date            = _parse_date(_p(8))
            end_time            = _parse_time(_p(9))
            end_datetime        = timezone.make_aware(datetime.combine(end_date, end_time)) if end_date and end_time else None

            # ── Idempotency guard ─────────────────────────────────────────────
            existing = ScheduleData.objects.filter(
                palmtec_id=_p(2),
                company_code=company,
                schedule_no=schedule_no,
                start_date=schedule_start_date,
            ).first()
            if existing and existing.is_closed:
                log.status = RawDataLog.statusChoices.DUPLICATE
                log.error_message = "ShdClsSum: schedule already closed by ShdCls"
                log.save()
                return

            driver_obj    = _resolve_employee(_p(10), company.id)
            conductor_obj = _resolve_employee(_p(11), company.id)
            bus_obj       = _resolve_vehicle(_p(12),  company.id)

            close_fields_new = dict(
                close_unique_code       = _p(1),
                route_id                = route,
                driver                  = _p(10),
                driver_id               = driver_obj,
                conductor               = _p(11),
                conductor_id            = conductor_obj,
                bus_no                  = _p(12),
                bus_id                  = bus_obj,
                end_date                = end_date,
                end_time                = end_time,
                end_datetime            = end_datetime,
                battery_close           = int(_p(46)) if _p(46) else None,
                total_tickets           = int(_p(13, 0)),
                full_count              = int(_p(14, 0)),
                half_count              = int(_p(15, 0)),
                physical_count          = int(_p(16, 0)),
                ladies_count            = int(_p(17, 0)),
                senior_count            = int(_p(18, 0)),
                luggage_count           = int(_p(19, 0)),
                st_count                = int(_p(20, 0)),
                adjust_count            = int(_p(21, 0)),
                total_collection        = Decimal(_p(22, '0')),
                full_collection         = Decimal(_p(23, '0')),
                half_collection         = Decimal(_p(24, '0')),
                physical_collection     = Decimal(_p(25, '0')),
                ladies_collection       = Decimal(_p(26, '0')),
                senior_collection       = Decimal(_p(27, '0')),
                st_collection           = Decimal(_p(28, '0')),
                adjust_collection       = Decimal(_p(29, '0')),
                luggage_collection      = Decimal(_p(30, '0')),
                upi_total_collection    = Decimal(_p(31, '0')),
                upi_full_collection     = Decimal(_p(32, '0')),
                upi_half_collection     = Decimal(_p(33, '0')),
                upi_physical_collection = Decimal(_p(34, '0')),
                upi_ladies_collection   = Decimal(_p(35, '0')),
                upi_senior_collection   = Decimal(_p(36, '0')),
                upi_st_collection       = Decimal(_p(37, '0')),
                upi_luggage_collection  = Decimal(_p(38, '0')),
                upi_full_count          = int(_p(39, 0)),
                upi_half_count          = int(_p(40, 0)),
                upi_physical_count      = int(_p(41, 0)),
                upi_ladies_count        = int(_p(42, 0)),
                upi_senior_count        = int(_p(43, 0)),
                upi_luggage_count       = int(_p(44, 0)),
                upi_st_count            = int(_p(45, 0)),
                is_closed               = True,
                auto_opened             = False,
                ghost_note              = None,
                close_raw_payload       = log.raw_payload,
            )

            if existing:
                for k, v in close_fields_new.items():
                    setattr(existing, k, v)
                existing.save()
            else:
                try:
                    with transaction.atomic():
                        ScheduleData.objects.create(
                            palmtec_id  = _p(2),
                            schedule_no = schedule_no,
                            start_date  = schedule_start_date,
                            start_time  = schedule_start_time,
                            start_datetime = (
                                timezone.make_aware(datetime.combine(schedule_start_date, schedule_start_time))
                                if schedule_start_date and schedule_start_time else None
                            ),
                            auto_opened  = True,
                            ghost_note   = "ShdClsSum received; ShdOpn missing",
                            company_code = company,
                            **close_fields_new,
                        )
                except IntegrityError as ie:
                    log.status = RawDataLog.statusChoices.DUPLICATE
                    log.error_message = str(ie)
                    log.save()
                    return

            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)


@shared_task
def scan_pending_raw_logs():
    now = timezone.now()
    stale_cutoff   = now - timedelta(hours=12)
    requeue_cutoff = now - timedelta(seconds=60)

    RawDataLog.objects.filter(
        status=RawDataLog.statusChoices.PENDING,
        received_at__lt=stale_cutoff,
    ).update(
        status=RawDataLog.statusChoices.FAILED,
        error_message="Payload unprocessed for 12 hours",
    )

    requeue_records = RawDataLog.objects.filter(
        status=RawDataLog.statusChoices.PENDING,
        received_at__range=(stale_cutoff, requeue_cutoff),
    ).order_by('received_at')[:200]

    TASK_MAP = {
        RawDataLog.typeChoices.TRANSACTION:            process_transaction_data,
        RawDataLog.typeChoices.TRIP_OPEN:              process_trip_open_data,
        RawDataLog.typeChoices.TRIP_CLOSE:             process_trip_close_data,
        RawDataLog.typeChoices.TRIP_CLOSE_SUMMARY:     process_trip_close_summary_data,
        RawDataLog.typeChoices.SCHEDULE_OPEN:          process_schedule_open_data,
        RawDataLog.typeChoices.SCHEDULE_CLOSE:         process_schedule_close_data,
        RawDataLog.typeChoices.SCHEDULE_CLOSE_SUMMARY: process_schedule_close_summary_data,
    }

    count = 0
    for record in requeue_records:
        task = TASK_MAP.get(record.source)
        if task:
            task.delay(record.id)
            count += 1

    return count


@shared_task
def cleanup_processed_raw_logs():
    cutoff = timezone.now() - timedelta(days=30)
    deleted_count, _ = RawDataLog.objects.filter(
        status=RawDataLog.statusChoices.PROCESSED,
        processed_at__lt=cutoff,
    ).delete()
    return deleted_count
