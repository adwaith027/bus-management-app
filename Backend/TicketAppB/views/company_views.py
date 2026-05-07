import json
import time
import logging
import requests
import threading
from datetime import datetime
from django.conf import settings
from rest_framework import status
from django.db import transaction
from django.http import JsonResponse
from ..serializers import CompanySerializer
from rest_framework.response import Response
from .auth_views import get_user_from_cookie
from django.forms.models import model_to_dict
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from django.db.utils import OperationalError, ProgrammingError
from django.db.models import Sum, Q, Count, Case, When, IntegerField
from ..models import Company,TransactionData,TripCloseData,Route,VehicleType,MosambeeTransaction,Dealer,DealerCustomerMapping
from .utils import _is_superadmin, _is_executive, _is_dealer_admin, _is_company_admin


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
        "GSTNumber": company.gst_number or '',
        "CustomerContactPerson": company.contact_person,
        "CustomerContact": company.contact_number,
        "CustomerAddress": company.address,
        "CustomerAddress2": company.address_2 or '',
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

            # NumberOfLicence → number_of_licence
            number_of_licence = auth_data.get('NumberOfLicence')
            if number_of_licence:
                try:
                    company.number_of_licence = int(number_of_licence)
                except (ValueError, TypeError):
                    pass

            # NoOfUPIDevice → device_count (default 0)
            try:
                company.device_count = int(auth_data.get('NoOfUPIDevice', 0))
            except (ValueError, TypeError):
                company.device_count = 0

            # NoOfBranch → depot_count (default 0)
            try:
                company.depot_count = int(auth_data.get('NoOfBranch', 0))
            except (ValueError, TypeError):
                company.depot_count = 0

            # NoOfMobileDevice → mobile_device_count (default 2)
            try:
                company.mobile_device_count = int(auth_data.get('NoOfMobileDevice', 2))
            except (ValueError, TypeError):
                company.mobile_device_count = 2

            logger.info(f"[BACKGROUND] Updated license details for company: {company.company_name}")
        
        company.save()
        logger.info(f"[BACKGROUND] Successfully updated company status to: {company.authentication_status}")
        
    except Company.DoesNotExist:
        logger.error(f"[BACKGROUND] Company not found with ID: {company_id}")
    except Exception as e:
        logger.exception(f"[BACKGROUND] Unexpected error during background polling: {str(e)}")

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
    
    with transaction.atomic():
        try:
            company = Company.objects.select_for_update().get(pk=pk)
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


def fetch_company_from_license_server(customer_id):
    """
    Single (non-polling) call to the license server to get current status
    and license details for a given customer_id.
    Used for the import-existing-company preview and atomic import.
    Returns a dict with success, status, and data keys.
    """
    payload = {"CustomerId": customer_id}
    try:
        response = requests.post(
            settings.PRODUCT_AUTH_URL,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        auth_status = data.get('Authenticationstatus', '')

        if not auth_status:
            return {'success': False, 'error': 'No response from license server.'}

        return {'success': True, 'status': auth_status, 'data': data}

    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'License server timed out. Try again.'}
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Cannot connect to license server.'}
    except requests.exceptions.HTTPError as e:
        return {'success': False, 'error': f'License server error: {e.response.status_code}'}
    except Exception as e:
        logger.exception(f"Unexpected error fetching from license server: {e}")
        return {'success': False, 'error': f'Unexpected error: {str(e)}'}


@api_view(['GET'])
def get_company_by_company_id(request, company_id):
    """
    Preview endpoint for the 'Add Existing Company' flow.

    1. Blocks if company_id already exists in our DB (returns 409).
    2. Fetches current license status from the license server (single call).
    3. Returns license data so the frontend can show a confirm banner.

    Note: This is read-only — no writes happen here.
    The actual atomic create is handled by POST /import-company.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    # ── Duplicate check ──────────────────────────────────────────────────────
    existing = Company.objects.filter(company_id=company_id).first()
    if existing:
        logger.warning(f"Import blocked: company_id '{company_id}' already exists as '{existing.company_name}'")
        return Response(
            {'message': f'"{existing.company_name}" is already registered in this system.'},
            status=status.HTTP_409_CONFLICT
        )

    # ── Single license server fetch (no polling loop) ────────────────────────
    result = fetch_company_from_license_server(customer_id=company_id)
    if not result['success']:
        return Response({'message': result['error']}, status=status.HTTP_502_BAD_GATEWAY)

    auth_data   = result['data']
    auth_status = result['status']

    # Map license server response fields for the frontend confirm step
    product_to_date   = auth_data.get('ProductToDate')
    product_from_date = auth_data.get('ProductFromDate')

    expired = False
    if product_to_date:
        try:
            expiry = check_datetime(product_to_date)
            expired = expiry is not None and datetime.now() > expiry
        except Exception:
            pass

    # License server does not return company details (name, address, etc.)
    # Only license/config fields are available — returned for the confirm banner.
    # The user fills in company details manually in the confirm step form.
    return Response(
        {
            'message': 'Success',
            'data': {
                'company_id':            company_id,
                'authentication_status': auth_status,
                'product_from_date':     product_from_date,
                'product_to_date':       product_to_date,
                'number_of_licence':     auth_data.get('NumberOfLicence', 1),
                'is_expired':            expired,
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@transaction.atomic
def import_company(request):
    """
    Atomic 'Add Existing Company' endpoint.

    Takes only { company_id } from the frontend.
    Re-fetches all data from the license server server-side and creates
    the Company record in a single DB transaction — no race window.

    Race condition handling:
      select_for_update() ensures that if two requests arrive simultaneously
      for the same company_id, only one proceeds; the other sees the duplicate
      and gets a 409.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    company_id = request.data.get('company_id', '').strip()
    if not company_id:
        return Response({'message': 'company_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # ── User account validation ───────────────────────────────────────────────
    imp_user_username = request.data.get('user_username', '').strip()
    imp_user_email = request.data.get('user_email', '').strip()
    imp_user_password = request.data.get('user_password', '').strip()
    if not imp_user_username or not imp_user_email or not imp_user_password:
        return Response({'error': 'User account details (username, email, password) are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=imp_user_username).exists():
        return Response({'message': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=imp_user_email).exists():
        return Response({'message': 'User email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Atomic duplicate check with row-level lock ───────────────────────────
    # select_for_update acquires a DB lock so concurrent requests serialise here.
    existing = Company.objects.select_for_update().filter(company_id=company_id).first()
    if existing:
        logger.warning(f"Import duplicate blocked (atomic): company_id '{company_id}' → '{existing.company_name}'")
        return Response(
            {'message': f'"{existing.company_name}" is already registered in this system.'},
            status=status.HTTP_409_CONFLICT
        )

    # ── Re-fetch from license server (single call) ───────────────────────────
    result = fetch_company_from_license_server(customer_id=company_id)
    if not result['success']:
        return Response({'message': result['error']}, status=status.HTTP_502_BAD_GATEWAY)

    auth_data   = result['data']
    auth_status = result['status']

    # Map auth_status string → Company.AuthStatus choice
    status_map = {
        'Approve':  Company.AuthStatus.APPROVED,
        'Expired':  Company.AuthStatus.EXPIRED,
        'Block':    Company.AuthStatus.BLOCKED,
        'Pending':  Company.AuthStatus.PENDING,
    }
    # Anything not in the map (e.g. 'Waiting') falls back to PENDING
    mapped_status = status_map.get(auth_status, Company.AuthStatus.PENDING)

    # Parse dates
    product_from_date = None
    product_to_date   = None
    try:
        raw_from = auth_data.get('ProductFromDate')
        raw_to   = auth_data.get('ProductToDate')
        if raw_from:
            dt = check_datetime(raw_from)
            product_from_date = dt.date() if dt else None
        if raw_to:
            dt = check_datetime(raw_to)
            product_to_date = dt.date() if dt else None
    except Exception:
        pass

    def safe_int(val, default=0):
        try:
            return int(val)
        except (TypeError, ValueError):
            return default

    # ── Validate company detail fields from request ──────────────────────────
    # License server does not return name/address/email, so the frontend
    # supplies these from the form the user filled in on the confirm step.
    form_data = {
        'company_id':      company_id,
        'company_name':    request.data.get('company_name', '').strip(),
        'company_email':   request.data.get('company_email', '').strip(),
        'contact_person':  request.data.get('contact_person', '').strip(),
        'contact_number':  request.data.get('contact_number', '').strip(),
        'gst_number':      request.data.get('gst_number', '').strip(),
        'address':         request.data.get('address', '').strip(),
        'address_2':       request.data.get('address_2', '').strip(),
        'city':            request.data.get('city', '').strip(),
        'state':           request.data.get('state', '').strip(),
        'zip_code':        request.data.get('zip_code', '').strip(),
        # number_of_licence comes from the license server (authoritative)
        'number_of_licence': safe_int(auth_data.get('NumberOfLicence'), safe_int(request.data.get('number_of_licence'), 1)),
    }

    if not form_data['company_name']:
        return Response({'message': 'Company name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Create Company record ────────────────────────────────────────────────
    company = Company.objects.create(
        **form_data,
        authentication_status   = mapped_status,
        product_registration_id = safe_int(auth_data.get('ProductRegistrationId')),
        unique_identifier       = auth_data.get('UniqueIDentifier', ''),
        product_from_date       = product_from_date,
        product_to_date         = product_to_date,
        device_count            = safe_int(auth_data.get('NoOfUPIDevice'), 0),
        depot_count             = safe_int(auth_data.get('NoOfBranch'), 0),
        mobile_device_count     = safe_int(auth_data.get('NoOfMobileDevice'), 2),
        client_type             = 'company',
        created_by              = user,
    )

    # ── Create company_admin user ─────────────────────────────────────────────
    User.objects.create_user(
        username=imp_user_username,
        email=imp_user_email,
        password=imp_user_password,
        role='company_admin',
        company=company,
        is_verified=True,
    )
    logger.info(f"Imported existing company '{company.company_name}' (company_id={company_id}) by user {user}")

    serializer = CompanySerializer(company)
    return Response(
        {
            'message': f'"{company.company_name}" imported successfully.',
            'data': serializer.data,
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
def all_company_data(request):
    """
    Retrieve companies based on the requesting user's role.

    Visibility rules:
      - superadmin   → all companies
      - executive    → only companies in their ExecutiveCompanyMapping
      - dealer_admin → only companies in their DealerCustomerMapping
      - company_admin→ only their own company
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if _is_superadmin(user):
        # Superadmin sees only direct companies they created (not dealer sub-companies).
        companies = Company.objects.filter(created_by=user, client_type='company').order_by('-id')

    elif _is_executive(user):
        # Executive sees only companies they are explicitly mapped to.
        from ..models import ExecutiveCompanyMapping  # avoid circular at module level
        company_ids = ExecutiveCompanyMapping.objects.filter(
            executive_user_id=user.id, is_active=True
        ).values_list('company_id', flat=True)
        companies = Company.objects.filter(id__in=company_ids).order_by('-id')

    elif _is_dealer_admin(user):
        if not user.dealer_id:
            return Response({'message': 'No dealer linked to this user'}, status=status.HTTP_400_BAD_REQUEST)
        company_ids = DealerCustomerMapping.objects.filter(
            dealer_id=user.dealer_id, is_active=True
        ).values_list('company_id', flat=True)
        companies = Company.objects.filter(id__in=company_ids).order_by('-id')

    elif _is_company_admin(user):
        if not user.company:
            return Response({'message': 'No company linked to this user'}, status=status.HTTP_400_BAD_REQUEST)
        companies = Company.objects.filter(pk=user.company.pk)

    else:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    serializer = CompanySerializer(companies, many=True)
    logger.info(f"Retrieved {len(companies)} companies for role={user.role}")
    return Response({"message": "Success", "data": serializer.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def create_company(request):
    """
    Create a new company.

    Allowed roles:
      - superadmin   : creates company for themselves; no dealer involvement.
      - dealer_admin : creates company under their dealer; auto-creates
                       DealerCustomerMapping and validates against dealer's
                       licence pool.
    """
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    if not _is_superadmin(user) and not _is_dealer_admin(user):
        return Response({'error': 'Only superadmin or dealer_admin can create companies.'}, status=status.HTTP_403_FORBIDDEN)

    if not request.data:
        return Response({"message": "No input received"}, status=status.HTTP_400_BAD_REQUEST)

    # ── User account validation (required for both superadmin and dealer_admin) ─
    user_username = request.data.get('user_username', '').strip()
    user_email_field = request.data.get('user_email', '').strip()
    user_password = request.data.get('user_password', '').strip()

    if not user_username or not user_email_field or not user_password:
        return Response({'error': 'User account details (username, email, password) are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=user_username).exists():
        return Response({'message': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=user_email_field).exists():
        return Response({'message': 'User email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    # ── Fetch dealer for mapping (dealer_admin only) ──────────────────────────
    dealer = None
    if _is_dealer_admin(user):
        if not user.dealer_id:
            return Response({'error': 'No dealer linked to this account.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            dealer = Dealer.objects.get(pk=user.dealer_id)
        except Dealer.DoesNotExist:
            return Response({'error': 'Dealer not found.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = CompanySerializer(data=request.data)
    if not serializer.is_valid():
        logger.warning(f"Company creation failed: {serializer.errors}")
        return Response({"message": "Validation failed", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    client_type_val = 'dealer_company' if _is_dealer_admin(user) else 'company'
    company = serializer.save(created_by=user, client_type=client_type_val)
    logger.info(f"Created new company: {company.company_name} (ID: {company.id}) by {user.role} {user.username}")

    # ── Create company_admin user ─────────────────────────────────────────────
    User.objects.create_user(
        username=user_username,
        email=user_email_field,
        password=user_password,
        role='company_admin',
        company=company,
        is_verified=True,
    )
    logger.info(f"Created company_admin user '{user_username}' for company: {company.company_name}")

    # ── Auto-create DealerCustomerMapping for dealer_admin ────────────────────
    if dealer:
        DealerCustomerMapping.objects.create(
            dealer=dealer,
            company=company,
            created_by=user,
            is_active=True,
        )
        logger.info(f"Auto-created DealerCustomerMapping: dealer={dealer.id} → company={company.id}")

    return Response({"message": "Company created successfully", "data": serializer.data}, status=status.HTTP_201_CREATED)


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


# Returns collections, operations, and settlements data for a given date.
@api_view(['GET'])
def get_company_dashboard_metrics(request):    
    #  Step 1: Authentication 
    user = get_user_from_cookie(request)
    if not user:
        return Response(
            {'error': 'Authentication required'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    #  Step 2: Date validation ─
    selected_date = request.GET.get('date')
    if not selected_date:
        return Response(
            {'error': 'Date parameter required (format: YYYY-MM-DD)'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if isinstance(selected_date, str):
        try:
            selected_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    #  Step 3: Company check ─
    company = user.company
    if not company:
        # User has no company — return zeros
        return Response({
            "message": "success",
            "data": {
                "collections": {
                    "daily_cash": 0,
                    "daily_upi": 0,
                    "monthly_total": 0,
                },
                "operations": {
                    "buses_active": 0,
                    "buses_total": 0,
                    "trips_completed": 0,
                    "trips_scheduled": 0,
                    "routes_active": 0,
                    "routes_total": 0,
                    "total_passengers": 0,
                },
                "settlements": {
                    "total_transactions": 0,
                    "verified": 0,
                    "pending_verification": 0,
                    "failed": 0,
                }
            }
        }, status=status.HTTP_200_OK)
    
    #  Initialize response structure ─
    collections = {
        "daily_cash": 0,
        "daily_upi": 0,
        "monthly_total": 0,
    }
    operations = {
        "buses_active": 0,
        "buses_total": 0,
        "trips_completed": 0,
        "trips_scheduled": 0,
        "routes_active": 0,
        "routes_total": 0,
        "total_passengers": 0,
    }
    settlements = {
        "total_transactions": 0,
        "verified": 0,
        "pending_verification": 0,
        "failed": 0,
    }
    
    #  Section 1: Collections (from TransactionData) 
    try:
        transaction_base = TransactionData.objects.filter(
            company_code=company,
            ticket_date=selected_date
        )
        
        # Daily cash collection
        daily_cash = transaction_base.filter(
            ticket_status=TransactionData.PaymentMode.CASH
        ).aggregate(total=Sum('ticket_amount'))['total'] or 0
        
        # Daily UPI collection
        daily_upi = transaction_base.filter(
            ticket_status=TransactionData.PaymentMode.UPI
        ).aggregate(total=Sum('ticket_amount'))['total'] or 0
        
        # Monthly total (all transactions in the same month)
        monthly_total = TransactionData.objects.filter(
            company_code=company,
            ticket_date__year=selected_date.year,
            ticket_date__month=selected_date.month
        ).aggregate(total=Sum('ticket_amount'))['total'] or 0
        
        collections = {
            "daily_cash": float(daily_cash),
            "daily_upi": float(daily_upi),
            "monthly_total": float(monthly_total),
        }
        
        # Total passengers (from ticket counts)
        total_passengers = transaction_base.aggregate(
            total=Sum('total_tickets')
        )['total'] or 0
        operations["total_passengers"] = int(total_passengers)
        
    except (OperationalError, ProgrammingError) as e:
        logger.warning(f"Collection metrics unavailable: {str(e)}")
    except Exception as e:
        logger.exception(f"Collection metrics error: {str(e)}")
    
    #  Section 2: Operations (from TripCloseData, Route, VehicleType) ─
    try:
        # Trips completed on this date
        trips_completed = TripCloseData.objects.filter(
            company_code=company,
            start_date=selected_date
        ).count()
        operations["trips_completed"] = trips_completed
        operations["trips_scheduled"] = trips_completed  # Assuming all completed trips were scheduled
        
        # Active buses (distinct palmtec_id on this date)
        buses_active = TripCloseData.objects.filter(
            company_code=company,
            start_date=selected_date
        ).values('palmtec_id').distinct().count()
        operations["buses_active"] = buses_active
        
    except (OperationalError, ProgrammingError) as e:
        logger.warning(f"Trip metrics unavailable: {str(e)}")
    except Exception as e:
        logger.exception(f"Trip metrics error: {str(e)}")
    
    try:
        # Total buses registered (not soft-deleted)
        operations["buses_total"] = VehicleType.objects.filter(
            company=company,
            is_deleted=False
        ).count()
        
        # Total routes
        operations["routes_total"] = Route.objects.filter(
            company=company
        ).count()
        
        # Active routes (not soft-deleted)
        operations["routes_active"] = Route.objects.filter(
            company=company,
            is_deleted=False
        ).count()
        
    except (OperationalError, ProgrammingError) as e:
        logger.warning(f"Route/vehicle metrics unavailable: {str(e)}")
    except Exception as e:
        logger.exception(f"Route/vehicle metrics error: {str(e)}")
    
    #  Section 3: Settlements (from MosambeeTransaction) 
    # IMPORTANT FIX: MosambeeTransaction doesn't have a direct company FK.
    # It links to TransactionData via related_ticket → company_code.
    # However, not all Mosambee transactions may be reconciled yet (related_ticket could be null).
    # 
    # Solution: We filter by transactions that are EITHER:
    #   1. Already linked to a ticket from this company, OR
    #   2. Have a merchantId that belongs to this company's devices/terminals
    #
    # For now, we use a simpler approach: filter by related_ticket__company_code
    # and include null related_ticket if merchantId matches company terminals.
    # If you don't have a merchantId → company mapping, just use related_ticket filter.
    
    try:
        # Base queryset: all transactions on this date
        settlement_qs = MosambeeTransaction.objects.filter(
            transaction_date=selected_date
        )
        
        # Filter by company:
        # Approach 1 (safer): Only count transactions linked to company's tickets
        settlement_qs = settlement_qs.filter(
            related_ticket__company_code=company
        )
        
        # Count totals
        settlements["total_transactions"] = settlement_qs.count()
        
        # Verified transactions
        settlements["verified"] = settlement_qs.filter(
            verification_status=MosambeeTransaction.VerificationStatus.VERIFIED
        ).count()
        
        # Pending verification (unverified + flagged)
        settlements["pending_verification"] = settlement_qs.filter(
            verification_status__in=[
                MosambeeTransaction.VerificationStatus.UNVERIFIED,
                MosambeeTransaction.VerificationStatus.FLAGGED,
            ]
        ).count()
        
        # Failed (rejected + disputed)
        settlements["failed"] = settlement_qs.filter(
            verification_status__in=[
                MosambeeTransaction.VerificationStatus.REJECTED,
                MosambeeTransaction.VerificationStatus.DISPUTED,
            ]
        ).count()
        
    except (OperationalError, ProgrammingError) as e:
        logger.warning(f"Settlement metrics unavailable: {str(e)}")
    except Exception as e:
        logger.exception(f"Settlement metrics error: {str(e)}")
    
    #  Return response ─
    return Response(
        {
            "message": "success",
            "data": {
                "collections": collections,
                "operations": operations,
                "settlements": settlements,
            }
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
def get_admin_dashboard_data(request):
    user = get_user_from_cookie(request)
    if not user:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        company_counts = Company.objects.aggregate(
            total=Count('id'),
            validated=Count(Case(When(authentication_status=Company.AuthStatus.APPROVED, then=1), output_field=IntegerField())),
            unvalidated=Count(Case(When(authentication_status=Company.AuthStatus.PENDING, then=1), output_field=IntegerField())),
            expired=Count(Case(When(authentication_status=Company.AuthStatus.EXPIRED, then=1), output_field=IntegerField())),
        )
        dashboard_data = {"company_summary": {}, "user_summary": {}}

        dashboard_data['company_summary'].update({
            "total_companies": company_counts['total'],
            "validated_companies": company_counts['validated'],
            "unvalidated_companies": company_counts['unvalidated'],
            "expired_companies": company_counts['expired'],
        })

        all_non_admin_users = User.objects.filter(is_superuser=False).count()
        users_by_company_qs = (
            User.objects.filter(is_superuser=False)
            .values('company__company_name')
            .annotate(count=Count('id'))
        )
        users_by_company = [
            {"company_name": row["company__company_name"], "count": row["count"]}
            for row in users_by_company_qs
        ]
        dashboard_data['user_summary'].update({
            "total_users": all_non_admin_users,
            "users_by_company": users_by_company,
        })

        return Response({"message": "Success", "data": dashboard_data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": "Data fetching failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)