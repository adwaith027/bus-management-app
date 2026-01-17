import logging
from decimal import Decimal,InvalidOperation
from datetime import datetime,timezone
from rest_framework import status
from ..models import TransactionData,TripCloseData,Company,MosambeeTransaction
from django.http import HttpResponse,JsonResponse
from .auth_views import get_user_from_cookie
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from ..serializers import TicketDataSerializer,TripCloseDataSerializer
from rest_framework.decorators import api_view
from django.db import IntegrityError, OperationalError
from django.views.decorators.csrf import csrf_exempt
import json
from django.db.models import Count
from django.utils.dateparse import parse_datetime
import pytz
import hashlib
from django.conf import settings


User=get_user_model()
logger = logging.getLogger(__name__)


@api_view(['GET'])
def get_admin_dashboard_data(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # find all company data
        all_companies=Company.objects.all()
        total_companies=Company.objects.count()
        validated_companies=0
        unvalidated_companies=0
        expired_companies=0
        dashboard_data={"company_summary":{},"user_summary": {}}
        for company in all_companies:
            if company.authentication_status=="Pending":
                unvalidated_companies+=1
            elif company.authentication_status=="Approve":
                validated_companies+=1
            elif company.authentication_status=="Expired":
                expired_companies+=1

        dashboard_data['company_summary'].update({"total_companies":total_companies,"validated_companies":validated_companies,"unvalidated_companies":unvalidated_companies,"expired_companies":expired_companies})

        # find all user data
        all_non_admin_users=User.objects.filter(is_superuser=False).count()
        users_by_company_qs = (User.objects.filter(is_superuser=False).values('company__company_name').annotate(count=Count('id')))
        users_by_company = [{"company_name": row["company__company_name"],"count": row["count"]}for row in users_by_company_qs]

        dashboard_data['user_summary'].update({"total_users":all_non_admin_users,"users_by_company":users_by_company})
        
        return Response({"message":"Success","data":dashboard_data},status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": "Data fetching failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# used by machine
@csrf_exempt
def getTransactionDataFromDevice(request):
    if request.method != "GET":
        return HttpResponse("METHOD_NOT_ALLOWED",status=status.HTTP_405_METHOD_NOT_ALLOWED,content_type="text/plain")

    raw = request.GET.get("fn")

    if not raw:
        return HttpResponse("NO_DATA",status=status.HTTP_400_BAD_REQUEST,content_type="text/plain")

    logger.info("Transaction from device: %s", raw)

    parts = raw.split("|")

    # get first 32 chars for response
    response_chars=raw[0:32]

    try:
        company_code = parts[26] if len(parts) > 26 else None
        
        company_instance = Company.objects.filter(company_id=company_code).first()
        if not company_instance:
            logger.error("Invalid company code from device: %s", company_code)
            return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")
        
        # Parse count fields with proper None handling
        full_count = int(parts[8]) if len(parts) > 8 and parts[8] else 0
        half_count = int(parts[9]) if len(parts) > 9 and parts[9] else 0
        st_count = int(parts[10]) if len(parts) > 10 and parts[10] else 0
        phy_count = int(parts[11]) if len(parts) > 11 and parts[11] else 0
        lugg_count = int(parts[12]) if len(parts) > 12 and parts[12] else 0

        # Calculate total tickets
        try:
            total_tickets = full_count + half_count + st_count + phy_count + lugg_count
        except (TypeError, ValueError) as e:
            logger.error("Error calculating total_tickets: %s", e)
            total_tickets = 0

        # Parse ticket_status as integer with validation
        try:
            ticket_status_raw = parts[24] if len(parts) > 24 and parts[24] else None
            if ticket_status_raw is not None:
                ticket_status = int(ticket_status_raw)
                # Validate: only 0 (Cash) or 1 (UPI) allowed
                if ticket_status not in [0, 1]:
                    logger.warning("Invalid ticket_status value %s, defaulting to 0 (Cash)", ticket_status)
                    ticket_status = 0
            else:
                ticket_status = 0  # Default to Cash
        except (ValueError, TypeError) as e:
            logger.error("Error parsing ticket_status: %s, defaulting to 0 (Cash)", e)
            ticket_status = 0
        
        transaction = TransactionData.objects.create(
            request_type = parts[0] if len(parts) > 0 else None,
            device_id    = parts[1] if len(parts) > 1 else None,
            trip_number  = parts[2] if len(parts) > 2 else None,
            ticket_number= parts[3] if len(parts) > 3 else None,

            ticket_date = datetime.strptime(parts[4], "%Y-%m-%d").date()
                          if len(parts) > 4 and parts[4] else None,
            ticket_time = datetime.strptime(parts[5], "%H:%M:%S").time()
                          if len(parts) > 5 and parts[5] else None,

            from_stage = int(parts[6]) if len(parts) > 6 and parts[6] else 0,
            to_stage   = int(parts[7]) if len(parts) > 7 and parts[7] else 0,

            # Use pre-calculated count values
            full_count = full_count,
            half_count = half_count,
            st_count   = st_count,
            phy_count  = phy_count,
            lugg_count = lugg_count,

            # Add total_tickets
            total_tickets = total_tickets,

            ticket_amount = Decimal(parts[13]) if len(parts) > 13 and parts[13] else Decimal("0.00"),
            lugg_amount   = Decimal(parts[14]) if len(parts) > 14 and parts[14] else Decimal("0.00"),

            ticket_type   = parts[15] if len(parts) > 15 else None,
            adjust_amount = Decimal(parts[16]) if len(parts) > 16 and parts[16] else Decimal("0.00"),
            
            pass_id        = parts[17] if len(parts) > 17 else None,
            warrant_amount= Decimal(parts[18]) if len(parts) > 18 and parts[18] else Decimal("0.00"),

            refund_status = parts[19] if len(parts) > 19 else None,
            refund_amount = Decimal(parts[20]) if len(parts) > 20 and parts[20] else Decimal("0.00"),

            ladies_count = int(parts[21]) if len(parts) > 21 and parts[21] else 0,
            senior_count = int(parts[22]) if len(parts) > 22 and parts[22] else 0,

            transaction_id   = parts[23] if len(parts) > 23 else None,
            
            # Use parsed integer ticket_status
            ticket_status    = ticket_status,
            
            reference_number = parts[25] if len(parts) > 25 else None,
            
            # Company foreign key
            company_code     = company_instance,

            # Branch code (currently null, device doesn't send yet)
            branch_code = None,

            raw_payload = raw
        )

        device_response=f'OK#SUCCESS#fn={response_chars}#'
        return HttpResponse(device_response, content_type="text/plain", status=status.HTTP_200_OK)

    except IntegrityError:
        device_response=f'OK#SUCCESS#fn={response_chars}#'
        return HttpResponse(device_response, content_type="text/plain", status=status.HTTP_200_OK)

    except Exception:
        logger.exception("Transaction parsing failed")
        return HttpResponse("ERROR",status=status.HTTP_500_INTERNAL_SERVER_ERROR,content_type="text/plain")



@api_view(['GET'])
def get_all_transaction_data(request):
    """
    Fetch transaction data with support for cursor-based polling.
    
    Query Parameters:
    - from_date: Start date (YYYY-MM-DD) - required
    - to_date: End date (YYYY-MM-DD) - required
    - since: ISO timestamp for incremental updates (optional)
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # Get date range from query parameters
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        since_timestamp = request.GET.get('since')  # For polling updates
        
        # Validate required parameters
        if not from_date or not to_date:
            return Response(
                {'error': 'from_date and to_date are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Base queryset filtered by user's company and date range
        if user.company:
            queryset = TransactionData.objects.filter(
                company_code=user.company,
                ticket_date__gte=from_date,
                ticket_date__lte=to_date
            )
        else:
            queryset = TransactionData.objects.none()
        
        # If 'since' parameter provided, filter for polling updates
        if since_timestamp:
            try:
                # Parse the timestamp - handle different formats
                # Format from DB: 2026-01-07 05:16:06.134
                since_dt = parse_datetime(since_timestamp)
                
                if since_dt is None:
                    # Try alternative parsing
                    since_dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))
                
                if since_dt:
                    # Make sure we're comparing timezone-aware datetimes
                    if since_dt.tzinfo is None:
                        since_dt = pytz.UTC.localize(since_dt)
                    
                    # Filter for records created AFTER the cursor timestamp
                    queryset = queryset.filter(created_at__gt=since_dt)
                    
                    logger.info(f"Polling query: since={since_timestamp}, filtered count={queryset.count()}")
                else:
                    logger.warning(f"Could not parse since timestamp: {since_timestamp}")
                    return Response({"message": "success", "data": []}, status=status.HTTP_200_OK)
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid since timestamp: {since_timestamp}, error: {e}")
                return Response({"message": "success", "data": []}, status=status.HTTP_200_OK)
        
        # Order by created_at descending (newest first) for consistency
        # Frontend expects newest first
        queryset = queryset.order_by('-created_at')
        
        # Limit results to prevent huge responses
        queryset = queryset[:500]
        
        # Serialize data
        serializer = TicketDataSerializer(queryset, many=True)
        
        return Response({
            "message": "success", 
            "data": serializer.data,
            "count": len(serializer.data)
        }, status=status.HTTP_200_OK)
    
    except OperationalError:
        return Response({"message": "Error fetching data", "error": str(e)},status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except Exception as e:
        logger.exception("Error fetching transaction data")
        return Response({"message": "Data fetching failed", "error": str(e)},status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
def getTripCloseDataFromDevice(request):   
    # Check request method
    if request.method != 'GET':
        return HttpResponse("METHOD_NOT_ALLOWED",status=status.HTTP_405_METHOD_NOT_ALLOWED,content_type="text/plain")

    try:
        # Extract raw data from request
        raw_payload = request.GET.get('fn', '')

        if not raw_payload:
            return HttpResponse("NO_DATA",status=status.HTTP_400_BAD_REQUEST,content_type="text/plain")

        # Split data by delimiter
        parts = raw_payload.split('|')

        # Check if we have minimum required parts
        if len(parts) < 33:
            return HttpResponse("MISSING_DATA",status=status.HTTP_400_BAD_REQUEST,content_type="text/plain")

        # Validate request type
        if parts[0] != 'TrpCl':
            return HttpResponse(f"INVALID",status=status.HTTP_400_BAD_REQUEST,content_type="text/plain")
        
        # Create TripCloseData instance
        try:
            company_code = parts[2] if len(parts) > 2 else None
        
            company_instance = Company.objects.filter(company_id=company_code).first()
            if not company_instance:
                logger.error("Invalid company code from device: %s", company_code)
                return HttpResponse("INVALID_COMPANY", status=400, content_type="text/plain")
            
            # Parse dates and times separately
            try:
                start_date = datetime.strptime(parts[5], "%Y-%m-%d").date() if parts[5] else None
                start_time = datetime.strptime(parts[6], "%H:%M:%S").time() if parts[6] else None
                end_date = datetime.strptime(parts[7], "%Y-%m-%d").date() if parts[7] else None
                end_time = datetime.strptime(parts[8], "%H:%M:%S").time() if parts[8] else None
                
                start_datetime = datetime.strptime(f"{parts[5]} {parts[6]}", "%Y-%m-%d %H:%M:%S")
                end_datetime = datetime.strptime(f"{parts[7]} {parts[8]}", "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError) as e:
                logger.error("Error parsing dates/times: %s", e)
                return HttpResponse("INVALID_DATE_TIME", status=400, content_type="text/plain")

            # Parse all count fields
            full_count = int(parts[11]) if parts[11] else 0
            half_count = int(parts[12]) if parts[12] else 0
            st1_count = int(parts[13]) if parts[13] else 0
            luggage_count = int(parts[14]) if parts[14] else 0
            physical_count = int(parts[15]) if parts[15] else 0
            pass_count = int(parts[16]) if parts[16] else 0
            ladies_count = int(parts[17]) if parts[17] else 0
            senior_count = int(parts[18]) if parts[18] else 0
            upi_ticket_count = int(parts[29]) if parts[29] else 0

            # Parse amounts
            total_collection = Decimal(str(parts[28])) if parts[28] else Decimal('0.00')
            upi_ticket_amount = Decimal(str(parts[30])) if parts[30] else Decimal('0.00')

            # Calculate totals
            try:
                # Total tickets includes all passenger counts (including pass)
                total_tickets = (full_count + half_count + st1_count + luggage_count + 
                               physical_count + pass_count + ladies_count + senior_count)
                
                # Cash tickets = total - upi
                total_cash_tickets = total_tickets - upi_ticket_count
                
                # Validate: cash tickets should not be negative
                if total_cash_tickets < 0:
                    logger.error("Data irregularity: total_cash_tickets is negative (%d)", total_cash_tickets)
                    return HttpResponse("DATA_IRREGULARITY_CASH_TICKETS", status=400, content_type="text/plain")
                
                # Cash amount = total_collection - upi_amount
                total_cash_amount = total_collection - upi_ticket_amount
                
                # Validate: cash amount should not be negative
                if total_cash_amount < Decimal('0.00'):
                    logger.error("Data irregularity: total_cash_amount is negative (%s)", total_cash_amount)
                    return HttpResponse("DATA_IRREGULARITY_CASH_AMOUNT", status=400, content_type="text/plain")

            except (TypeError, ValueError) as e:
                logger.error("Error calculating totals: %s", e)
                return HttpResponse("CALCULATION_ERROR", status=400, content_type="text/plain")

            trip_data = TripCloseData.objects.create(
                # Device information
                palmtec_id=parts[1],
                company_code=company_instance,
                branch_code=None,  # Branch (not sent by device yet)

                # Trip identification
                schedule=int(parts[3]) if parts[3] else 0,
                trip_no=int(parts[4]) if parts[4] else 0,
                route_code=parts[31],
                up_down_trip=parts[32] if len(parts) > 32 else '',

                # Date and time fields (separate)
                start_date=start_date,
                start_time=start_time,
                end_date=end_date,
                end_time=end_time,

                # Trip timing - datetime fields
                start_datetime=start_datetime,
                end_datetime=end_datetime,

                # Ticket range
                start_ticket_no=int(parts[9]) if parts[9] else 0,
                end_ticket_no=int(parts[10]) if parts[10] else 0,

                # Passenger counts (using pre-parsed values)
                full_count=full_count,
                half_count=half_count,
                st1_count=st1_count,
                luggage_count=luggage_count,
                physical_count=physical_count,
                pass_count=pass_count,
                ladies_count=ladies_count,
                senior_count=senior_count,

                # Total tickets and cash breakdown
                total_tickets=total_tickets,
                total_cash_tickets=total_cash_tickets,

                # Collection amounts - convert to Decimal
                full_collection=Decimal(str(parts[19])) if parts[19] else Decimal('0.00'),
                half_collection=Decimal(str(parts[20])) if parts[20] else Decimal('0.00'),
                st_collection=Decimal(str(parts[21])) if parts[21] else Decimal('0.00'),
                luggage_collection=Decimal(str(parts[22])) if parts[22] else Decimal('0.00'),
                physical_collection=Decimal(str(parts[23])) if parts[23] else Decimal('0.00'),
                ladies_collection=Decimal(str(parts[24])) if parts[24] else Decimal('0.00'),
                senior_collection=Decimal(str(parts[25])) if parts[25] else Decimal('0.00'),

                # Other financial data
                adjust_collection=Decimal(str(parts[26])) if parts[26] else Decimal('0.00'),
                expense_amount=Decimal(str(parts[27])) if parts[27] else Decimal('0.00'),
                total_collection=total_collection,

                # Cash amount breakdown
                total_cash_amount=total_cash_amount,

                # UPI payment data
                upi_ticket_count=upi_ticket_count,
                upi_ticket_amount=upi_ticket_amount,
            )
        
            # Return success response to device
            # Extract first 32 characters for response
            response_chars = raw_payload[0:32]
            device_response = f'OK#SUCCESS#fn={response_chars}#'
            return HttpResponse(device_response,status=status.HTTP_201_CREATED,content_type="text/plain")

        # Handle duplicate entry (unique_together constraint)
        except IntegrityError:
            response_chars = raw_payload[0:32]
            device_response = f'OK#SUCCESS#fn={response_chars}#'
            return HttpResponse(device_response,status=status.HTTP_200_OK,content_type="text/plain")
    
    # Handle conversion errors (int/Decimal/datetime)
    except ValueError as e:
        logger.exception("Transaction parsing failed, ValueError")
        return HttpResponse(f"ERROR",status=status.HTTP_400_BAD_REQUEST,content_type="text/plain")
    
    # Handle any other unexpected errors
    except Exception as e:
        logger.exception("Transaction parsing failed")
        return HttpResponse(f"ERROR",status=status.HTTP_500_INTERNAL_SERVER_ERROR,content_type="text/plain")
    


@api_view(['GET'])
def get_all_trip_close_data(request):
    """
    Fetch trip close data with support for cursor-based polling.
    
    Query Parameters:
    - from_date: Start date (YYYY-MM-DD) - required
    - to_date: End date (YYYY-MM-DD) - required
    - since: ISO timestamp for incremental updates (optional)
    """
    user = get_user_from_cookie(request)
    if not user:
        return JsonResponse({"error": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # Get date range from query parameters
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        since_timestamp = request.GET.get('since')  # For polling updates
        
        # Validate required parameters
        if not from_date or not to_date:
            return JsonResponse(
                {'error': 'from_date and to_date are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Base queryset filtered by user's company and date range
        if user.company:
            queryset = TripCloseData.objects.filter(
                company_code=user.company,
                start_date__gte=from_date,
                start_date__lte=to_date
            )
        else:
            queryset = TripCloseData.objects.none()
        
        # If 'since' parameter provided, filter for polling updates
        if since_timestamp:
            try:
                # Parse the timestamp
                since_dt = parse_datetime(since_timestamp)

                if since_dt is None:
                    # Try alternative parsing
                    since_dt = datetime.fromisoformat(since_timestamp.replace('Z', '+00:00'))

                if since_dt:
                    # Make sure we're comparing timezone-aware datetimes
                    if since_dt.tzinfo is None:
                        since_dt = pytz.UTC.localize(since_dt)

                    # Filter for records created AFTER the cursor timestamp
                    queryset = queryset.filter(created_at__gt=since_dt)
                    
                    logger.info(f"Trip polling query: since={since_timestamp}, filtered count={queryset.count()}")
                else:
                    logger.warning(f"Could not parse since timestamp: {since_timestamp}")
                    return JsonResponse({"message": "success", "data": []}, status=status.HTTP_200_OK)
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid since timestamp: {since_timestamp}, error: {e}")
                return JsonResponse({"message": "success", "data": []}, status=status.HTTP_200_OK)
        
        # Order by created_at descending (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Limit results to prevent huge responses
        queryset = queryset[:500]
        
        # Serialize data
        serializer = TripCloseDataSerializer(queryset, many=True)
        
        return JsonResponse({
            "message": "success", 
            "data": serializer.data,
            "count": len(serializer.data)
        }, status=status.HTTP_200_OK)

    except OperationalError:
        return JsonResponse({"message": "Error fetching data"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except Exception as e:
        logger.exception("Error fetching trip close data")
        return JsonResponse({"message": f"{e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)