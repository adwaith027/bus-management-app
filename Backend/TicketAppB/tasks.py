from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone
from decimal import Decimal
from datetime import datetime
from .models import RawDataLog, TransactionData, TripCloseData, Company


@shared_task
def blacklist_refresh_token(refresh_token_str):
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.exceptions import TokenError
    try:
        RefreshToken(refresh_token_str).blacklist()
    except TokenError:
        pass  # Already expired or invalid — nothing to blacklist

@shared_task(bind=True, max_retries=3)
def process_transaction_data(self, log_id):
    try:
        with transaction.atomic():  # outer — keeps select_for_update alive
            
            # Fetch & guard 
            log = RawDataLog.objects.select_related('company_code').select_for_update().get(id=log_id)

            if log.status != RawDataLog.statusChoices.PENDING:
                return f"Log {log_id} already processed."

            # Company check 
            company_instance = log.company_code
            if not company_instance:
                log.status = RawDataLog.statusChoices.FAILED
                log.error_message = "Invalid Company Code"
                log.save()
                return

            # Parse raw payload 
            parts = log.raw_payload.split("|")

            full_count  = int(parts[8])  if len(parts) > 8  and parts[8]  else 0
            half_count  = int(parts[9])  if len(parts) > 9  and parts[9]  else 0
            st_count    = int(parts[10]) if len(parts) > 10 and parts[10] else 0
            phy_count   = int(parts[11]) if len(parts) > 11 and parts[11] else 0
            lugg_count  = int(parts[12]) if len(parts) > 12 and parts[12] else 0
            total_tickets = full_count + half_count + st_count + phy_count + lugg_count

            try:
                ticket_status_raw = parts[24] if len(parts) > 24 and parts[24] else None
                ticket_status = int(ticket_status_raw) if ticket_status_raw is not None else 0
                if ticket_status not in [0, 1]:
                    ticket_status = 0
            except (ValueError, TypeError):
                ticket_status = 0

            # DB write (savepoint)
            try:
                with transaction.atomic():  # inner savepoint — isolates IntegrityError
                    TransactionData.objects.create(
                        request_type     = parts[0]  if len(parts) > 0  else None,
                        palmtec_id       = parts[1]  if len(parts) > 1  else None,
                        trip_number      = int(parts[2]) if len(parts) > 2 and parts[2] else None,
                        ticket_number    = parts[3]  if len(parts) > 3  else None,

                        ticket_date = datetime.strptime(parts[4], "%Y-%m-%d").date()
                                      if len(parts) > 4 and parts[4] else None,
                        ticket_time = datetime.strptime(parts[5], "%H:%M:%S").time()
                                      if len(parts) > 5 and parts[5] else None,

                        from_stage       = int(parts[6])  if len(parts) > 6  and parts[6]  else 0,
                        to_stage         = int(parts[7])  if len(parts) > 7  and parts[7]  else 0,

                        full_count       = full_count,
                        half_count       = half_count,
                        st_count         = st_count,
                        phy_count        = phy_count,
                        lugg_count       = lugg_count,
                        total_tickets    = total_tickets,

                        ticket_amount    = Decimal(parts[13]) if len(parts) > 13 and parts[13] else Decimal("0.00"),
                        lugg_amount      = Decimal(parts[14]) if len(parts) > 14 and parts[14] else Decimal("0.00"),
                        ticket_type      = parts[15] if len(parts) > 15 else None,
                        adjust_amount    = Decimal(parts[16]) if len(parts) > 16 and parts[16] else Decimal("0.00"),
                        pass_id          = parts[17] if len(parts) > 17 else None,
                        warrant_amount   = Decimal(parts[18]) if len(parts) > 18 and parts[18] else Decimal("0.00"),
                        refund_status    = parts[19] if len(parts) > 19 else None,
                        refund_amount    = Decimal(parts[20]) if len(parts) > 20 and parts[20] else Decimal("0.00"),
                        ladies_count     = int(parts[21]) if len(parts) > 21 and parts[21] else 0,
                        senior_count     = int(parts[22]) if len(parts) > 22 and parts[22] else 0,
                        transaction_id   = parts[23] if len(parts) > 23 else None,
                        ticket_status    = ticket_status,
                        reference_number = parts[25] if len(parts) > 25 else None,
                        company_code     = company_instance,
                        depot_code       = None,
                        raw_payload      = log.raw_payload,
                    )

            except IntegrityError as ie:
                # inner savepoint rolled back, outer is still alive — log.save() works
                log.status = RawDataLog.statusChoices.DUPLICATE
                log.error_message = str(ie)
                log.save()
                return

            # Mark processed
            log.status = RawDataLog.statusChoices.PROCESSED
            log.processed_at = timezone.now()
            log.save()

    except Exception as exc:
        RawDataLog.objects.filter(id=log_id).update(
            status=RawDataLog.statusChoices.FAILED,
            error_message=str(exc))
        raise self.retry(exc=exc, countdown=60)
