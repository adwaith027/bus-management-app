import json
from datetime import datetime
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from ..models import MosambeeTransaction, TransactionData


@csrf_exempt
def mosambee_webhook(request):
    """Receives transaction posting from Mosambee payment gateway"""
    
    if request.method != 'POST':
        return JsonResponse({'status': 400, 'message': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required = ['transactionID', 'merchantId', 'transactionRRN', 
                   'transactionAmount', 'transactionDate', 'transactionTime',
                   'responseCode', 'transactionStatus', 'checksum']
        
        missing = [f for f in required if f not in data]
        if missing:
            return JsonResponse({
                'status': 400,
                'message': f'Missing required fields: {missing}'
            }, status=400)
        
        # Check for duplicate (idempotency)
        transaction_id = data['transactionID']
        existing = MosambeeTransaction.objects.filter(transactionID=transaction_id).first()
        
        if existing:
            existing.repost_count += 1
            existing.last_received_at = timezone.now()
            existing.save()
            return JsonResponse({
                'status': 200,
                'message': 'success',
                'merchant_refTxnId': existing.billNumber or existing.invoiceNumber
            })
        
        # Parse date and time
        transaction_date = datetime.strptime(data['transactionDate'], '%d-%m-%Y').date()
        transaction_time = datetime.strptime(data['transactionTime'], '%H:%M:%S').time()
        transaction_datetime = datetime.combine(transaction_date, transaction_time)
        
        # Create transaction record
        transaction = MosambeeTransaction.objects.create(
            transactionID=data['transactionID'],
            merchantId=data['merchantId'],
            transactionRRN=data['transactionRRN'],
            transactionAmount=data['transactionAmount'],
            transaction_date=transaction_date,
            transaction_time=transaction_time,
            transaction_datetime=transaction_datetime,
            responseCode=data['responseCode'],
            transactionStatus=data['transactionStatus'],
            checksum_received=data['checksum'],
            name=data.get('name', ''),
            invoiceNumber=data.get('invoiceNumber'),
            transactionCardNumber=data.get('transactionCardNumber', ''),
            cardType=data.get('cardType', ''),
            transactionTerminalId=data.get('transactionTerminalId', ''),
            acquirerName=data.get('acquirerName', ''),
            cardHolderName=data.get('cardHolderName'),
            businessName=data.get('businessName'),
            addressLine1=data.get('addressLine1'),
            addressLine2=data.get('addressLine2'),
            transactionLat=data.get('transactionLat'),
            transactionLong=data.get('transactionLong'),
            transactionSTAN=data.get('transactionSTAN'),
            transactionAuthCode=data.get('transactionAuthCode'),
            transactionBatchNumber=data.get('transactionBatchNumber'),
            billNumber=data.get('billNumber'),
            currencyId=data.get('currencyId', '1'),
            narration=data.get('narration'),
            transactionTypeId=data.get('transactionTypeId', 0),
            transactionTypeName=data.get('transactionTypeName'),
            tgTransactionId=data.get('tgTransactionId'),
            cashBack=data.get('cashBack', 0),
            tipAmount=data.get('tipAmount', 0),
            creditDebitCardType=data.get('creditDebitCardType'),
            appVersion=data.get('appVersion'),
            refTxnId=data.get('refTxnId'),
            aid=data.get('aid'),
            ici=data.get('ici'),
            apn=data.get('apn'),
            appLabel=data.get('appLabel'),
            tvr=data.get('tvr'),
            tsi=data.get('tsi'),
            ac=data.get('ac'),
            cid=data.get('cid'),
            cvm=data.get('cvm'),
            tipProcessing=data.get('tipProcessing', False),
            transactionMode=data.get('transactionMode'),
            MsrAndPinVerification=data.get('MsrAndPinVerification', False),
            raw_request_data=data,
            processing_status=MosambeeTransaction.ProcessingStatus.RECEIVED,
            verification_status=MosambeeTransaction.VerificationStatus.UNVERIFIED,
        )
        
        # Background processing happens via signals (see signals.py)
        # This keeps the webhook response fast
        
        # Send success response
        response_data = {
            'status': 200,
            'message': 'success',
            'merchant_refTxnId': data.get('billNumber') or data.get('invoiceNumber')
        }
        
        transaction.response_sent_to_mosambee = response_data
        transaction.save()
        
        return JsonResponse(response_data)
        
    except json.JSONDecodeError:
        return JsonResponse({'status': 400, 'message': 'Invalid JSON'}, status=400)
    
    except Exception as e:
        print(f"Error processing Mosambee webhook: {e}")
        return JsonResponse({'status': 401, 'message': 'Authorization Failed'}, status=401)
