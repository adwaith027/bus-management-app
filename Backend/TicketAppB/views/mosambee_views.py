import logging
from decimal import Decimal,InvalidOperation
from datetime import datetime,timezone
from django.utils import timezone as tz
from rest_framework import status
from ..models import TransactionData,TripCloseData,Company,MosambeeTransaction
from django.http import HttpResponse,JsonResponse
from .auth_views import get_user_from_cookie
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from ..serializers import MosambeeTransactionSerializer,SettlementVerificationSerializer
from django.views.decorators.csrf import csrf_exempt
import json
from rest_framework.decorators import api_view
from django.db.models import Count
import hashlib
from django.conf import settings

logger = logging.getLogger(__name__)

# handles mosambee Merchant Posting
@csrf_exempt
def mosambee_settlement_data(request):
    try:
        # Check if POST method
        if request.method != 'POST':
            return JsonResponse({'status': 405,'message': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'status': 400,'message': 'Invalid JSON format'}, status=status.HTTP_400_BAD_REQUEST)

        transaction_id = data.get('transactionID')
        merchant_id = data.get('merchantId')
        transaction_rrn = data.get('transactionRRN')
        checksum_received = data.get('checksum')
        transaction_amount = data.get('transactionAmount')
        transaction_date_str = data.get('transactionDate')
        transaction_time_str = data.get('transactionTime')
        response_code = data.get('responseCode')
        transaction_status = data.get('transactionStatus')

        # Optional but important fields
        invoice_number = data.get('invoiceNumber')
        bill_number = data.get('billNumber')
        name = data.get('name', '')
        business_name = data.get('businessName')
        card_number = data.get('transactionCardNumber', '')
        card_type = data.get('cardType', '')
        card_holder_name = data.get('cardHolderName')
        terminal_id = data.get('transactionTerminalId', '')
        acquirer_name = data.get('acquirerName', '')
        
        # Address fields
        address_line1 = data.get('addressLine1')
        address_line2 = data.get('addressLine2')
        
        # Location fields
        transaction_lat = data.get('transactionLat')
        transaction_long = data.get('transactionLong')
        
        # Other transaction details
        transaction_stan = data.get('transactionSTAN')
        transaction_auth_code = data.get('transactionAuthCode')
        transaction_batch_number = data.get('transactionBatchNumber')
        currency_id = data.get('currencyId', '1')
        narration = data.get('narration')
        transaction_type_id = data.get('transactionTypeId', 0)
        transaction_type_name = data.get('transactionTypeName')
        
        # Bank/Gateway fields
        tg_transaction_id = data.get('tgTransactionId')
        ref_txn_id = data.get('refTxnId')
        
        # Financial fields
        cash_back = data.get('cashBack', '0.00')
        tip_amount = data.get('tipAmount', '0.00')
        credit_debit_type = data.get('creditDebitCardType')
        
        # Technical fields
        app_version = data.get('appVersion')
        
        # EMV chip data (for chip card transactions)
        aid = data.get('aid')
        ici = data.get('ici')
        apn = data.get('apn')
        app_label = data.get('appLabel')
        tvr = data.get('tvr')
        tsi = data.get('tsi')
        ac = data.get('ac')
        cid = data.get('cid')
        cvm = data.get('cvm')
        
        # Processing flags
        tip_processing = data.get('tipProcessing', False)
        transaction_mode = data.get('transactionMode')
        msr_pin_verification = data.get('MsrAndPinVerification', False)

        # non null values required by api
        required_fields = {
            'transactionID': transaction_id,
            'merchantId': merchant_id,
            'transactionRRN': transaction_rrn,
            'checksum': checksum_received,
            'transactionAmount': transaction_amount,
            'transactionDate': transaction_date_str,
            'transactionTime': transaction_time_str,
            'responseCode': response_code,
            'transactionStatus': transaction_status
        }

        # Check which required fields are missing
        missing_fields = []
        for field_name, field_value in required_fields.items():
            if not field_value:
                missing_fields.append(field_name)

        # If any required field is missing, reject immediately
        if missing_fields:
            return JsonResponse({'status': 400,'message': f'Missing required fields: {", ".join(missing_fields)}'}, status=status.HTTP_400_BAD_REQUEST)

        salt = settings.MOSAMBEE_SALT
        # CHECKSUM: TRANSACTIONID + MERCHANTID + TRANSACTIONRRN + SALT VALUE
        checksum_input=str(transaction_id) + str(merchant_id) + str(transaction_rrn) + salt
        hashed_value = hashlib.sha512(checksum_input.encode('utf-8')).hexdigest()

        if hashed_value.lower() != checksum_received.lower():
            return JsonResponse({'status': 401,'message': 'Checksum Error'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # check if repost
        existing_transaction = MosambeeTransaction.objects.filter(transactionID=transaction_id).first()

        # If transaction already exists (repost from Mosambee)
        if existing_transaction:
            # Increment repost counter
            existing_transaction.repost_count += 1
            existing_transaction.last_received_at = timezone.now()
            existing_transaction.save()
            
            # Return success with existing bill/invoice number
            return JsonResponse({'status': 200,'message': 'success','merchant_refTxnId': existing_transaction.billNumber})

        try:
            # Parse date: "02-04-2025" → date object
            transaction_date = datetime.strptime(transaction_date_str, '%d-%m-%Y').date()
            # Parse time: "19:43:03" → time object
            transaction_time = datetime.strptime(transaction_time_str, '%H:%M:%S').time()
            # Combine into full datetime
            transaction_datetime = datetime.combine(transaction_date, transaction_time)
            
        except ValueError as e:
            return JsonResponse({'status': 400,'message': f'Invalid date/time format: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # save data to db if all okay
        transaction = MosambeeTransaction.objects.create(
            # Critical identifiers
            transactionID=transaction_id,
            merchantId=merchant_id,
            transactionRRN=transaction_rrn,
            
            # Checksum validation results
            checksum_received=checksum_received,
            checksum_calculated=hashed_value,
            is_checksum_valid=True,  # We already validated it above
            
            # Financial details
            transactionAmount=transaction_amount,
            cashBack=cash_back or 0,
            tipAmount=tip_amount or 0,
            
            # Date/Time
            transaction_date=transaction_date,
            transaction_time=transaction_time,
            transaction_datetime=transaction_datetime,
            
            # Payment status
            responseCode=response_code,
            transactionStatus=transaction_status,
            
            # Invoice/Bill references
            invoiceNumber=invoice_number,
            billNumber=bill_number,
            
            # User/Merchant info
            name=name,
            businessName=business_name,
            addressLine1=address_line1,
            addressLine2=address_line2,
            
            # Card details
            transactionCardNumber=card_number,
            cardType=card_type,
            cardHolderName=card_holder_name,
            creditDebitCardType=credit_debit_type,
            
            # Terminal/Location
            transactionTerminalId=terminal_id,
            transactionLat=transaction_lat,
            transactionLong=transaction_long,
            
            # Transaction metadata
            transactionSTAN=transaction_stan,
            transactionAuthCode=transaction_auth_code,
            transactionBatchNumber=transaction_batch_number,
            acquirerName=acquirer_name,
            currencyId=currency_id,
            narration=narration,
            transactionTypeId=transaction_type_id,
            transactionTypeName=transaction_type_name,
            
            # Reference IDs
            tgTransactionId=tg_transaction_id,
            refTxnId=ref_txn_id,
            
            # EMV chip data
            aid=aid,
            ici=ici,
            apn=apn,
            appLabel=app_label,
            tvr=tvr,
            tsi=tsi,
            ac=ac,
            cid=cid,
            cvm=cvm,
            
            # Processing flags
            tipProcessing=tip_processing,
            transactionMode=transaction_mode,
            MsrAndPinVerification=msr_pin_verification,
            appVersion=app_version,
            
            # Store raw data for auditing
            raw_request_data=data,
            
            # Set initial statuses
            processing_status=MosambeeTransaction.ProcessingStatus.VALIDATED,
            verification_status=MosambeeTransaction.VerificationStatus.UNVERIFIED,
            reconciliation_status=MosambeeTransaction.ReconciliationStatus.PENDING,
        )

        # bill number was the passed data in documentation
        # response_data = {'status': 200,'message': 'success','merchant_refTxnId': bill_number or invoice_number}
        response_data = {'status': 200,'message': 'success','merchant_refTxnId': bill_number}

        # Store what we sent back (for audit trail)
        transaction.response_sent_to_mosambee = response_data
        transaction.save()

        return JsonResponse(response_data,status=status.HTTP_200_OK)

    except Exception as e:
        return JsonResponse({'status': 500,'message': 'Data Entry failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_settlement_data(request):
    """
    Fetch Mosambee payment transactions for settlement verification.
    
    Query Parameters:
    - from_date: Start date (YYYY-MM-DD) - required
    - to_date: End date (YYYY-MM-DD) - required
    - verification_status: Filter by verification status (optional)
    - reconciliation_status: Filter by reconciliation status (optional)
    - payment_status: 'approved' or 'declined' (optional)
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Check if user has permission (manager/admin only)
    if user.role not in ['company_admin','branch_admin', 'admin', 'super_admin']:
        return Response({'error': 'Insufficient permissions'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Get date range
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        
        if not from_date or not to_date:
            return Response({'error': 'from_date and to_date are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Base queryset
        queryset = MosambeeTransaction.objects.filter(
            transaction_date__gte=from_date,
            transaction_date__lte=to_date
        )
        
        # Filter by verification status
        verification_status = request.GET.get('verification_status')
        if verification_status and verification_status != 'ALL':
            queryset = queryset.filter(verification_status=verification_status)
        
        # Filter by reconciliation status
        reconciliation_status = request.GET.get('reconciliation_status')
        if reconciliation_status and reconciliation_status != 'ALL':
            queryset = queryset.filter(reconciliation_status=reconciliation_status)
        
        # Filter by payment status (approved/declined)
        payment_status = request.GET.get('payment_status')
        if payment_status == 'approved':
            queryset = queryset.filter(responseCode__in=['0', '00', '000'])
        elif payment_status == 'declined':
            queryset = queryset.exclude(responseCode__in=['0', '00', '000'])
        
        # Filter by merchant ID
        merchant_id = request.GET.get('merchant_id')
        if merchant_id and merchant_id != 'ALL':
            queryset = queryset.filter(merchantId=merchant_id)
        
        # Order by datetime (newest first)
        queryset = queryset.select_related('related_ticket', 'verified_by')
        queryset = queryset.order_by('-transaction_datetime')
        
        # Limit to 500 records
        queryset = queryset[:500]
        
        # Serialize
        serializer = MosambeeTransactionSerializer(queryset, many=True)
        
        return Response({'message': 'success','data': serializer.data,'count': len(serializer.data)}, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception("Error fetching settlement data")
        return Response({'message': 'Data fetching failed','error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def verify_settlement(request):
    """
    Manager verifies/rejects a settlement transaction.
    
    Request body:
    {
        "transaction_id": 123,
        "verification_status": "VERIFIED" | "REJECTED" | "FLAGGED",
        "verification_notes": "Optional notes"
    }
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({
            'error': 'Authentication required'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Check permissions
    if user.role not in ['company_admin', 'branch_admin','admin', 'super_admin']:
        return Response({'error': 'Insufficient permissions'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Validate input
        serializer = SettlementVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': 'Invalid data','details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get transaction
        transaction_id = serializer.validated_data['transaction_id']
        transaction = MosambeeTransaction.objects.get(id=transaction_id)
        
        # Check if already verified by someone else
        if transaction.verification_status == MosambeeTransaction.VerificationStatus.VERIFIED:
            return Response({
                'error': 'Transaction already verified',
                'verified_by': transaction.verified_by.username if transaction.verified_by else None
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update verification
        new_status = serializer.validated_data['verification_status']
        notes = serializer.validated_data.get('verification_notes', '')
        
        transaction.verification_status = new_status
        transaction.verified_by = user
        # uses django utils timezone class
        transaction.verified_at = tz.now()
        transaction.verification_notes = notes
        
        # If verified, update processing status
        if new_status == 'VERIFIED':
            transaction.processing_status = MosambeeTransaction.ProcessingStatus.PENDING_VERIFICATION

        transaction.save()
        
        # Return updated transaction
        response_serializer = MosambeeTransactionSerializer(transaction)
        
        return Response({'message': 'Transaction verified successfully','data': response_serializer.data}, status=status.HTTP_200_OK)
        
    except MosambeeTransaction.DoesNotExist:
        return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        logger.exception("Error verifying settlement")
        return Response({'message': 'Verification failed','error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_settlement_summary(request):
    """
    Get summary statistics for settlement verification dashboard.
    
    Query Parameters:
    - from_date: Start date (YYYY-MM-DD) - required
    - to_date: End date (YYYY-MM-DD) - required
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if user.role not in ['company_admin','branch_admin', 'admin', 'super_admin']:
        return Response({'error': 'Insufficient permissions'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from_date = request.GET.get('from_date')
        to_date = request.GET.get('to_date')
        
        if not from_date or not to_date:
            return Response({'error': 'from_date and to_date are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Base queryset
        queryset = MosambeeTransaction.objects.filter(
            transaction_date__gte=from_date,
            transaction_date__lte=to_date
        )
        
        # Count by verification status
        total_transactions = queryset.count()
        unverified = queryset.filter(
            verification_status=MosambeeTransaction.VerificationStatus.UNVERIFIED
        ).count()
        verified = queryset.filter(
            verification_status=MosambeeTransaction.VerificationStatus.VERIFIED
        ).count()
        rejected = queryset.filter(
            verification_status=MosambeeTransaction.VerificationStatus.REJECTED
        ).count()
        flagged = queryset.filter(
            verification_status=MosambeeTransaction.VerificationStatus.FLAGGED
        ).count()
        
        # Count by reconciliation status
        auto_matched = queryset.filter(
            reconciliation_status=MosambeeTransaction.ReconciliationStatus.AUTO_MATCHED
        ).count()
        amount_mismatch = queryset.filter(
            reconciliation_status=MosambeeTransaction.ReconciliationStatus.AMOUNT_MISMATCH
        ).count()
        not_found = queryset.filter(
            reconciliation_status=MosambeeTransaction.ReconciliationStatus.NOT_FOUND
        ).count()
        duplicate = queryset.filter(
            reconciliation_status=MosambeeTransaction.ReconciliationStatus.DUPLICATE
        ).count()
        
        # Payment status
        approved = queryset.filter(responseCode__in=['0', '00', '000']).count()
        declined = queryset.exclude(responseCode__in=['0', '00', '000']).count()
        
        # Total amounts
        from django.db.models import Sum
        total_amount = queryset.filter(
            responseCode__in=['0', '00', '000']
        ).aggregate(total=Sum('transactionAmount'))['total'] or 0
        
        verified_amount = queryset.filter(
            verification_status=MosambeeTransaction.VerificationStatus.VERIFIED,
            responseCode__in=['0', '00', '000']
        ).aggregate(total=Sum('transactionAmount'))['total'] or 0
        
        # Checksum validation
        checksum_valid = queryset.filter(is_checksum_valid=True).count()
        checksum_invalid = queryset.filter(is_checksum_valid=False).count()
        
        return Response({
            'message': 'success',
            'data': {
                'verification_summary': {
                    'total': total_transactions,
                    'unverified': unverified,
                    'verified': verified,
                    'rejected': rejected,
                    'flagged': flagged
                },
                'reconciliation_summary': {
                    'auto_matched': auto_matched,
                    'amount_mismatch': amount_mismatch,
                    'not_found': not_found,
                    'duplicate': duplicate
                },
                'payment_summary': {
                    'approved': approved,
                    'declined': declined
                },
                'amount_summary': {
                    'total_amount': float(total_amount),
                    'verified_amount': float(verified_amount),
                    'pending_amount': float(total_amount - verified_amount)
                },
                'security_summary': {
                    'checksum_valid': checksum_valid,
                    'checksum_invalid': checksum_invalid
                }
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception("Error fetching settlement summary")
        return Response({'message': 'Summary fetch failed','error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)