import secrets
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from datetime import date
from ..models import Company, UserDeviceMapping
from django.conf import settings

User = get_user_model()


# Device Type Detection
# Purpose: Classify device from user agent string.
# NOTE: This is now used only for STORING device info,
#       NOT for deciding which login flow to enter.
def _classify_device_type(user_agent):
    agent = (user_agent or "").lower()
    if "android" in agent:
        return UserDeviceMapping.DeviceType.ANDROID
    if "iphone" in agent or "ipad" in agent or "ios" in agent:
        return UserDeviceMapping.DeviceType.IOS
    if any(token in agent for token in ["mobile", "opera mini", "blackberry", "iemobile"]):
        return UserDeviceMapping.DeviceType.WEB_MOBILE
    if agent:
        return UserDeviceMapping.DeviceType.WEB_DESKTOP
    return UserDeviceMapping.DeviceType.UNKNOWN


# Device Mapping Helpers
# Purpose: Create, update, and count device mappings.
def _get_active_device_count_for_company(company, exclude_device_uid=None):
    """
    Count how many APPROVED + is_active mappings exist
    across all users of a given company.
    Optionally exclude a specific device_uid (for re-login checks).
    """
    qs = UserDeviceMapping.objects.filter(
        user__company=company,
        status=UserDeviceMapping.DeviceStatus.APPROVED,
        is_active=True,
    )
    if exclude_device_uid:
        qs = qs.exclude(device_uid=exclude_device_uid)
    return qs.count()


def _create_pending_mapping(user, device_type, user_agent, device_uid):
    """
    Create a new device mapping with PENDING status and is_active=False.
    Called when a device_uid is seen for the first time.
    """
    mapping = UserDeviceMapping.objects.create(
        user=user,
        username_snapshot=user.username,
        device_uid=device_uid,
        device_type=device_type,
        user_agent=user_agent,
        status=UserDeviceMapping.DeviceStatus.PENDING,
        is_active=False,
        last_seen_at=timezone.now(),
    )
    return mapping


def _update_mapping_meta(mapping, user, device_type, user_agent):
    """
    Refresh the snapshot fields on an existing mapping on each login attempt.
    """
    mapping.last_seen_at = timezone.now()
    mapping.username_snapshot = user.username
    mapping.device_type = device_type
    mapping.user_agent = user_agent
    mapping.save(update_fields=[
        "last_seen_at",
        "username_snapshot",
        "device_type",
        "user_agent",
        "updated_at",
    ])


# Token + Cookie Helpers
# Purpose: Build JWT token responses and logout responses.
def _build_token_response(user, company):
    """
    Generate JWT tokens and return a Response with cookies set.
    """
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    valid_till = None
    if company and company.product_to_date:
        valid_till = company.product_to_date.strftime("%d-%m-%Y")

    response = Response({
        "message": "Login Successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_verified": user.is_verified,
            "company_name": company.company_name if company else None,
            "valid_till": valid_till,
            "license_status": company.authentication_status if company else None,
        }
    })

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=not settings.DEBUG,        # HTTPS in production
        samesite="Lax",
        max_age=1800,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,        # HTTPS in production
        samesite="Lax",
        max_age=604800,
        path="/",
    )
    return response


def _build_logout_response(message):
    response = Response({"message": message})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response


# Auth Utility
# Purpose: Extract and validate a user from cookie.
def get_user_from_cookie(request):
    """
    Extract and validate access token from cookies.
    Returns user object or None.
    """
    access_token = request.COOKIES.get("access_token")
    if not access_token:
        return None
    try:
        token = AccessToken(access_token)
        user_id = token["user_id"]
        user = User.objects.get(id=user_id)
        return user
    except (TokenError, User.DoesNotExist):
        return None


# Signup
@api_view(["POST"])
def signup_view(request):
    if not request.data:
        return Response({"error": "Invalid Input"}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get("username")
    email = request.data.get("mailid")
    role = request.data.get("role", "user")
    password = request.data.get("password")
    cpassword = request.data.get("cpassword")

    if not username or not email or not password or not cpassword:
        return Response({"error": "Fill out all the fields"}, status=status.HTTP_400_BAD_REQUEST)

    if password != cpassword:
        return Response({"error": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(
            username=username, email=email,
            password=password, role=role, is_verified=True
        )
        return Response({
            "message": "Account created successfully.",
            "user": {
                "username": user.username,
                "email": user.email,
                "role": user.role,
            }
        }, status=status.HTTP_201_CREATED)

    except Exception:
        return Response({"error": "Failed to create user"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Login
#
# NEW FLOW (replaces the old user-agent-based gate):
#
#   Step 1 — Authenticate credentials
#   Step 2 — Company license checks
#   Step 3 — Classify device type (for storage/info only)
#   Step 4 — Superadmin bypass (always skip device flow)
#   Step 5 — Check if device_uid is present in the request
#               YES → enter device approval flow (Steps 6–8)
#               NO  → treat as browser, issue tokens directly
#   Step 6 — Validate the device_uid (ownership + mapping)
#   Step 7 — Check mapping status (PENDING / INACTIVE / APPROVED)
#   Step 8 — Check active session slot count, then issue tokens
#
# WHY THIS IS BETTER:
#   The old gate used user-agent to decide if a request was mobile.
#   User-agent is unreliable (e.g. Dart sends "Dart/3.10 (dart:io)").
#   Now the presence of device_uid is the trigger — only your mobile
#   app sends it, making it a trustworthy signal regardless of framework.
@api_view(["POST"])
def login_view(request):
    if not request.data:
        return Response({"error": "Invalid request. No credentials provided"}, status=status.HTTP_400_BAD_REQUEST)

    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response({"error": "Please provide username and password"}, status=status.HTTP_400_BAD_REQUEST)

    # ── Step 1: Authenticate credentials ──
    user = authenticate(username=username, password=password)

    if not user:
        try:
            existing_user = User.objects.get(username=username)
            if not existing_user.is_active:
                return Response({"error": "Account is inactive. Contact administrator."}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            pass
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({"error": "Account is inactive"}, status=status.HTTP_403_FORBIDDEN)

    # ── Step 2: Company license checks ──
    company = user.company
    if company:
        if company.product_to_date and date.today() > company.product_to_date:
            return Response({"error": "License Expired. Contact Administrator"}, status=status.HTTP_403_FORBIDDEN)

        if company.authentication_status and company.authentication_status != Company.AuthStatus.APPROVED:
            return Response({"error": "Pending License Approval. Contact Administrator"}, status=status.HTTP_403_FORBIDDEN)

    # ── Step 3: Classify device type (for info/storage only, not for gating) ──
    user_agent = request.headers.get("User-Agent", "")
    device_type = _classify_device_type(user_agent)

    # ── Step 4: Superadmin always bypasses device flow ──
    if user.role == "superadmin":
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return _build_token_response(user, company)

    # ── Step 5: Check if device_uid is present ──
    # This is now the ONLY gate for the mobile device flow.
    # If device_uid is absent, the request is treated as a browser login.
    device_uid = request.data.get("device_uid")

    if not device_uid:
        # No device_uid → browser login → skip device flow entirely
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return _build_token_response(user, company)

    # ── Step 6: device_uid is present → enter device approval flow ──

    # Check if this device_uid is already mapped to a different user
    mapping = UserDeviceMapping.objects.filter(device_uid=device_uid).select_related("user").first()

    if mapping and mapping.user_id != user.id:
        return Response({
            "error_code": "DEVICE_UID_ALREADY_BOUND",
            "error": "This device is already linked to another user.",
        }, status=status.HTTP_403_FORBIDDEN)

    # Device seen for the first time — create PENDING mapping
    if not mapping:
        new_mapping = _create_pending_mapping(
            user=user,
            device_type=device_type,
            user_agent=user_agent,
            device_uid=device_uid,
        )
        return Response({
            "error_code": "DEVICE_PENDING_APPROVAL",
            "error": "Device registered. Awaiting admin approval.",
            "details": {
                "device_uid": new_mapping.device_uid,
                "device_type": new_mapping.device_type,
                "status": new_mapping.status,
            },
        }, status=status.HTTP_403_FORBIDDEN)

    # Device exists and belongs to this user — refresh its meta fields
    _update_mapping_meta(mapping, user, device_type, user_agent)

    # ── Step 7: Check mapping status ──
    if mapping.status == UserDeviceMapping.DeviceStatus.PENDING:
        return Response({
            "error_code": "DEVICE_PENDING_APPROVAL",
            "error": "Device is awaiting admin approval.",
            "details": {
                "device_uid": mapping.device_uid,
                "status": mapping.status,
            },
        }, status=status.HTTP_403_FORBIDDEN)

    if mapping.status == UserDeviceMapping.DeviceStatus.INACTIVE:
        return Response({
            "error_code": "DEVICE_INACTIVE",
            "error": "Device has been revoked. Contact administrator.",
        }, status=status.HTTP_403_FORBIDDEN)

    # ── Step 8: Approved device — check active session slot count ──
    # If device is already active (re-login), skip the slot count check
    if not mapping.is_active:
        active_count = _get_active_device_count_for_company(
            company=company,
            exclude_device_uid=device_uid,
        )
        allowed = company.mobile_device_count if company and company.mobile_device_count else 0

        if active_count >= allowed:
            return Response({
                "error_code": "DEVICE_LIMIT_REACHED",
                "error": f"Maximum active device limit ({allowed}) reached for your company.",
                "message": "Another active device must log out before this device can log in.",
            }, status=status.HTTP_403_FORBIDDEN)

        # Slot available — mark this device as active
        mapping.is_active = True
        mapping.save(update_fields=["is_active", "updated_at"])

    # ── Issue tokens ──
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return _build_token_response(user, company)


# Logout
# Purpose: Clear cookies and deactivate device slot if mobile.
@api_view(["POST"])
def logout_view(request):
    device_uid = request.data.get("device_uid")

    # Mobile logout — deactivate the device mapping (do NOT delete)
    if device_uid:
        mapping = UserDeviceMapping.objects.filter(device_uid=device_uid).first()
        if mapping:
            mapping.is_active = False
            mapping.save(update_fields=["is_active", "updated_at"])

    # Browser logout — just clear cookies (no device_uid sent)
    return _build_logout_response("Logged out successfully")


# Token Refresh
# Purpose: Issue a new access token using the refresh token cookie.
@api_view(["POST"])
def refresh_token_view(request):
    refresh_token = request.COOKIES.get("refresh_token")

    if not refresh_token:
        return Response({"error": "No refresh token found"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(refresh_token)
        new_access_token = str(refresh.access_token)

        response = Response({"message": "Token refreshed successfully"})
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            max_age=1800,
            path="/",
        )
        return response

    except TokenError:
        return Response({"error": "Invalid or expired refresh token"}, status=status.HTTP_401_UNAUTHORIZED)


# Auth Verification + Protected Route
# Purpose: Verify a user is authenticated via cookie.
@api_view(["GET"])
def verify_auth(request):
    user = get_user_from_cookie(request)

    if not user:
        return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)

    company = user.company
    valid_till = None
    if company and company.product_to_date:
        valid_till = company.product_to_date.strftime("%d-%m-%Y")

    return Response({
        "authenticated": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_verified": user.is_verified,
            "company_name": company.company_name if company else None,
            "valid_till": valid_till,
            "license_status": company.authentication_status if company else None,
        }
    })


@api_view(["GET"])
def protected_view(request):
    access_token = request.COOKIES.get("access_token")

    if not access_token:
        return Response({"error": "No access token provided"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        token = AccessToken(access_token)
        user_id = token["user_id"]
        user = User.objects.get(id=user_id)

        return Response({
            "message": f"Hello {user.username}!",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            }
        })

    except TokenError:
        return Response({"error": "Invalid or expired token"}, status=status.HTTP_401_UNAUTHORIZED)

    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_400_BAD_REQUEST)