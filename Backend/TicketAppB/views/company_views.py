from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from ..models import Company,TransactionData,TripCloseData
from ..serializers import CompanySerializer
from django.contrib.auth import get_user_model
from .auth_views import get_user_from_cookie
import requests
import time
import logging
import threading
from django.conf import settings
from datetime import datetime
import json
from django.forms.models import model_to_dict
from django.http import JsonResponse

# Setup logger  
logger = logging.getLogger(__name__)
User = get_user_model()


def check_datetime(date_str):
    try:
        if not date_str:
            return None  # FIX: explicit None handling

        if isinstance(date_str, str):
            # FIX: match incoming format WITH time
            return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')

        return date_str  # FIX: already a datetime/date, return as-is

    except Exception:
        return None  # FIX: never return raw invalid value

    

def build_license_registration_payload(company):
    """
    Build payload for license server registration.
    Maps Company model fields to license server expected format.
    """
    payload = {
        "CustomerName": company.company_name,
        "PhoneNumber": company.contact_number,
        "CustomerEmail": company.company_email,
        "GSTNumber": company.gst_number or '123456',
        "CustomerContactPerson": company.contact_person,
        "CustomerContact": company.contact_number,
        "CustomerAddress": company.address,
        "CustomerAddress2": company.address_2 or "sil",
        "CustomerState": company.state,
        "CustomerCity": company.city,
        "DeviceModel": "Windows",
        "DeviceIdentifier1": company.company_name,
        "DeviceType": 1,
        "Version": settings.APP_VERSION,
        "ProjectName": settings.PROJECT_NAME
    }
    
    logger.info(f"Built registration payload for company: {company.company_name}")
    return payload


def register_with_license_server(company):
    """
    Register company with external license server.
    Returns customer_id on success.
    """
    payload = build_license_registration_payload(company)
    
    try:
        logger.info(f"Sending registration request to: {settings.PRODUCT_REGISTRATION_URL}")
        logger.debug(f"Registration payload: {payload}")
        
        response = requests.post(
            settings.PRODUCT_REGISTRATION_URL,
            json=payload,
            timeout=30
        )
        
        logger.info(f"Registration response status: {response.status_code}")
        logger.debug(f"Registration response: {response.text}")
        
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'Success' and data.get('CustomerId'):
            logger.info(f"Registration successful. Customer ID: {data.get('CustomerId')}")
            return {
                'success': True,
                'customer_id': data['CustomerId']
            }
        else:
            logger.error(f"Registration failed. Response data: {data}")
            return {
                'success': False,
                'error': f"Registration failed: {data.get('message', 'Invalid response from license server')}"
            }
    
    except requests.exceptions.Timeout as e:
        logger.error(f"License server timeout: {str(e)}")
        return {
            'success': False,
            'error': 'License server timeout. Please try again later.'
        }
    except requests.exceptions.ConnectionError as e:
        logger.error(f"License server connection error: {str(e)}")
        return {
            'success': False,
            'error': 'Cannot connect to license server. Please check your network connection.'
        }
    except requests.exceptions.HTTPError as e:
        logger.error(f"License server HTTP error: {str(e)}")
        return {
            'success': False,
            'error': f'License server error: {e.response.status_code}'
        }
    except Exception as e:
        logger.exception(f"Unexpected error during registration: {str(e)}")
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }


def poll_license_authentication(customer_id, timeout_seconds=120, interval_seconds=3):
    """
    Poll license server for authentication approval.
    Checks every 3 seconds for up to 2 minutes (40 attempts max).
    Returns authentication data when approved.
    """
    payload = {"CustomerId": customer_id}
    start_time = time.time()
    poll_count = 0
    
    logger.info(f"Starting authentication polling for Customer ID: {customer_id}")
    
    while time.time() - start_time < timeout_seconds:
        poll_count += 1
        
        try:
            logger.debug(f"Poll attempt #{poll_count} for Customer ID: {customer_id}")

            response = requests.post(
                settings.PRODUCT_AUTH_URL,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            auth_status = data.get('Authenticationstatus', '')
            
            logger.debug(f"Poll #{poll_count} status: {auth_status}")
            
            # Success case
            if auth_status == 'Approve':
                logger.info(f"Authentication approved for Customer ID: {customer_id}")
                return {
                    'success': True,
                    'status': 'Approve',
                    'data': data
                }

            # Expired license
            if 'expired' in auth_status.lower():
                logger.warning(f"License expired for Customer ID: {customer_id}")
                return {
                    'success': True,
                    'status': 'Expired',
                    'data': data
                }

            # Blocked
            if auth_status == 'Block':
                logger.warning(f"License blocked for Customer ID: {customer_id}")
                return {
                    'success': True,
                    'status': 'Block',
                    'data': data
                }

            # Still waiting - continue polling
            if 'waiting' in auth_status.lower() or auth_status == 'Pending':
                logger.debug(f"Still waiting for approval. Next poll in {interval_seconds}s")
                time.sleep(interval_seconds)
                continue
            
            # Unknown status - treat as error
            logger.error(f"Unexpected authentication status: {auth_status}")
            return {
                'success': False,
                'error': f'Unexpected authentication status: {auth_status}'
            }
        
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout during poll #{poll_count}: {str(e)}")
            return {
                'success': False,
                'error': 'License server not responding. Please try again later.'
            }
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error during poll #{poll_count}: {str(e)}")
            return {
                'success': False,
                'error': 'Cannot connect to license server. Check your network connection.'
            }
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error during poll #{poll_count}: {str(e)}")
            return {
                'success': False,
                'error': f'License server error: {e.response.status_code}. Try again later.'
            }
        except Exception as e:
            logger.exception(f"Unexpected error during poll #{poll_count}: {str(e)}")
            return {
                'success': False,
                'error': 'Unexpected error during validation. Please try again.'
            }
    
    # Timeout
    elapsed = time.time() - start_time
    logger.error(f"Validation timeout after {elapsed:.1f}s and {poll_count} polls")
    return {
        'success': False,
        'error': f'Validation timeout - License not approved yet. Please try again later. ({poll_count} attempts over {int(elapsed)}s)'
    }


def background_license_polling(company_id):
    """
    Background function that polls license server and updates company status.
    This runs in a separate thread.
    """
    logger.info(f"[BACKGROUND] Starting license polling for company ID: {company_id}")
    
    try:
        # Get company from database
        company = Company.objects.get(id=company_id)
        
        # Poll for authentication
        auth_result = poll_license_authentication(company.company_id)

        if not auth_result['success']:
            # Polling failed or timed out - reset to Pending
            logger.error(f"[BACKGROUND] Polling failed for company {company_id}: {auth_result.get('error')}")
            company.authentication_status = Company.AuthStatus.PENDING
            company.save()
            return
        
        # Update company with license details
        auth_data = auth_result.get('data', {})
        auth_status = auth_result['status']
        
        logger.info(f"[BACKGROUND] Authentication result: {auth_status} for company: {company.company_name}")
        
        # Map authentication status to our model
        if auth_status == 'Approve':
            company.authentication_status = Company.AuthStatus.APPROVED
        elif auth_status == 'Expired':
            company.authentication_status = Company.AuthStatus.EXPIRED
        elif auth_status == 'Block':
            company.authentication_status = Company.AuthStatus.BLOCKED
        
        # Update license details (only if approved)
        if auth_status == 'Approve':
            product_from_date = auth_data.get('ProductFromDate')
            product_to_date = auth_data.get('ProductToDate')

            company.product_registration_id = auth_data.get('ProductRegistrationId')
            company.unique_identifier = auth_data.get('UniqueIDentifier')

            company.product_from_date = check_datetime(product_from_date).date() if product_from_date else None
            company.product_to_date = check_datetime(product_to_date).date() if product_to_date else None

            company.project_code = auth_data.get('ProjectCode')
            company.device_count = auth_data.get('TotalCount', 0)
            company.branch_count = auth_data.get('OutletCount', 0)
            
            # UPDATE: License count from server response
            number_of_licence = auth_data.get('NumberOfLicence')
            if number_of_licence:
                try:
                    company.number_of_licence = int(number_of_licence)
                except (ValueError, TypeError):
                    pass

            logger.info(f"[BACKGROUND] Updated license details for company: {company.company_name}")
        
        company.save()
        logger.info(f"[BACKGROUND] Successfully updated company status to: {company.authentication_status}")
        
    except Company.DoesNotExist:
        logger.error(f"[BACKGROUND] Company not found with ID: {company_id}")
    except Exception as e:
        logger.exception(f"[BACKGROUND] Unexpected error during background polling: {str(e)}")
        # Try to reset status to Pending if possible
        try:
            company = Company.objects.get(id=company_id)
            company.authentication_status = Company.AuthStatus.PENDING
            company.save()
        except:
            pass

    # This ensures status is never stuck in VALIDATING if thread fails
    finally:
        try:
            company = Company.objects.get(id=company_id)
            if company.authentication_status == Company.AuthStatus.VALIDATING:
                company.authentication_status = Company.AuthStatus.PENDING
                company.save()
        except:
            pass


@api_view(['POST'])
def register_company_with_license_server(request, pk):
    """
    Register company with license server only.
    This does NOT validate - only gets customer_id.
    
    Flow:
    1. Check if company exists
    2. Check if already registered (has company_id)
    3. Register with license server
    4. Save company_id to database
    5. Return success with customer_id
    """
    logger.info(f"License registration requested for company ID: {pk}")
    
    user = get_user_from_cookie(request)
    if not user:
        logger.warning(f"Unauthorized registration attempt for company ID: {pk}")
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        company = Company.objects.get(pk=pk)
        logger.info(f"Found company: {company.company_name} (ID: {pk})")
    except Company.DoesNotExist:
        logger.error(f"Company not found with ID: {pk}")
        return Response(
            {"message": "Company not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if already registered
    if company.company_id:
        logger.info(f"Company already registered with ID: {company.company_id}")
        return Response(
            {
                "message": "Company already registered with license server",
                "customer_id": company.company_id
            },
            status=status.HTTP_200_OK
        )
    
    # Register with license server
    logger.info(f"Initiating registration for: {company.company_name}")
    registration_result = register_with_license_server(company)
    
    if not registration_result['success']:
        logger.error(f"Registration failed: {registration_result['error']}")
        return Response(
            {
                "message": "License registration failed",
                "error": registration_result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Save company_id
    company.company_id = registration_result['customer_id']
    company.save()
    logger.info(f"Saved customer_id: {company.company_id} for company: {company.company_name}")
    
    return Response(
        {
            "message": f"Registered with license server successfully! Customer ID: {company.company_id}",
            "customer_id": company.company_id
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
def validate_company_license(request, pk):
    """
    START license validation by setting status to 'Validating' and 
    launching background polling thread.
    
    Returns immediately - polling happens in background.
    User can refresh to see updated status.
    
    Flow:
    1. Check if company exists
    2. Check if company is registered (has company_id)
    3. Check if already validating
    4. Set status to 'Validating'
    5. Start background thread
    6. Return immediately
    """
    logger.info(f"License validation requested for company ID: {pk}")
    
    user = get_user_from_cookie(request)
    if not user:
        logger.warning(f"Unauthorized license validation attempt for company ID: {pk}")
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        company = Company.objects.get(pk=pk)
        logger.info(f"Found company: {company.company_name} (ID: {pk})")
    except Company.DoesNotExist:
        logger.error(f"Company not found with ID: {pk}")
        return Response(
            {"message": "Company not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if company is registered
    if not company.company_id:
        logger.error(f"Company not registered yet. Cannot validate.")
        return Response(
            {
                "message": "Company not registered with license server yet",
                "error": "Please register the company first before validating"
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if already validating
    if company.authentication_status == Company.AuthStatus.VALIDATING:
        logger.info(f"Company already validating: {company.company_name}")
        return Response(
            {
                "message": "License validation already in progress",
                "status": "Validating"
            },
            status=status.HTTP_200_OK
        )
    
    # Set status to Validating
    company.authentication_status = Company.AuthStatus.VALIDATING
    company.save()
    logger.info(f"Set status to 'Validating' for company: {company.company_name}")
    
    # Start background thread
    thread = threading.Thread(
        target=background_license_polling,
        args=(company.id,),
        daemon=True
    )
    thread.start()
    logger.info(f"Started background polling thread for company ID: {pk}")
    
    # Return immediately
    serializer = CompanySerializer(company)
    return Response(
        {
            "message": "License validation started. This may take up to 2 minutes. Refresh to see updated status.",
            "status": "Validating",
            "data": serializer.data
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
def all_company_data(request):
    """
    Retrieve all companies.
    Returns companies ordered by most recent first.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    companies = Company.objects.all().order_by('-id')
    serializer = CompanySerializer(companies, many=True)
    
    logger.info(f"Retrieved {len(companies)} companies")
    
    return Response(
        {
            "message": "Success",
            "data": serializer.data
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
def create_company(request):
    """
    Create a new company.
    Initial authentication_status will be 'Pending'.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not request.data:
        return Response(
            {"message": "No input received"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    serializer = CompanySerializer(data=request.data)
    
    if serializer.is_valid():
        company = serializer.save(created_by=user)
        logger.info(f"Created new company: {company.company_name} (ID: {company.id})")
        return Response(
            {
                "message": "Company created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )
    
    logger.warning(f"Company creation failed: {serializer.errors}")
    return Response(
        {
            "message": "Validation failed",
            "errors": serializer.errors
        },
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['PUT'])
def update_company_details(request, pk):
    """
    Update existing company details.
    Cannot update license-related fields directly (use validate_license endpoint).
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    try:
        company = Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        logger.error(f"Company not found for update with ID: {pk}")
        return Response(
            {"message": "Company not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    serializer = CompanySerializer(company, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        logger.info(f"Updated company: {company.company_name} (ID: {pk})")
        return Response(
            {
                "message": "Company updated successfully", 
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )
    
    logger.warning(f"Company update failed for ID {pk}: {serializer.errors}")
    return Response(
        {
            "message": "Validation failed", 
            "errors": serializer.errors
        },
        status=status.HTTP_400_BAD_REQUEST
    )


# get data to be displayed in company dashboard
@api_view(['GET'])
def get_company_dashboard_metrics(request):
    # Get user from cookie and verify authentication
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    selected_date=request.GET.get('date')
    if not selected_date:
        return Response({'error': 'Date input missing'}, status=status.HTTP_400_BAD_REQUEST)
    
    if isinstance(selected_date,str):
        selected_date=datetime.strptime(selected_date,"%Y-%m-%d")

    # returns id as int
    company_id=user.company.id
    
    # Query TransactionData for payment metrics
    # Query TripCloseData for trip/bus metrics
    # Calculate aggregations using Django's aggregate/annotate
    # Return structured JSON response

    try:    
        transaction_queryset = TransactionData.objects.filter(
                company_code=user.company,
                ticket_date=selected_date
            )
        return JsonResponse(list(transaction_queryset.values()), safe=False)
    # Response structure
    #     {
    #     "collections": {
    #         "daily_total": 45280.50,
    #         "cash": 28150.00,
    #         "upi": 17130.50,
    #         "pending": 3200.00
    #     },
    #     "operations": {
    #         "buses_active": 12,
    #         "trips_completed": 48,
    #         "total_passengers": 1240,
    #         "active_routes": 8
    #     },
    #     "settlements": {
    #         "total_transactions": 156,
    #         "verified": 142,
    #         "pending_verification": 12,
    #         "failed": 2
    #     }
    # }
    
        return Response({"message": "Successfully retreived data"},status=status.HTTP_200_OK)

    except Exception as e:
        print(e)
        return Response({"message": "Data fetching failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)