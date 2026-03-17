from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.conf import settings
from .company import Company, Dealer

# Authentication models

class CustomUser(AbstractUser):
    role = models.CharField(max_length=32, blank=True, null=True,default='user')
    is_verified = models.BooleanField(default=False)
    is_device_valid = models.BooleanField(default=False)
    # db stores id in company_id
    company=models.ForeignKey(to=Company,on_delete=models.CASCADE,null=True,blank=True,related_name='users')
    dealer = models.ForeignKey(to=Dealer,on_delete=models.SET_NULL,null=True,blank=True,related_name='users')
    
    class Meta:
        db_table = 'custom_user'
    
    def __str__(self):
        return self.username



# 0 (Pending): device requested, waiting for admin approval, login blocked.  
# 1 (Approved): device authorized, login allowed.  
# 2 (Inactive): device revoked/released, login blocked.
class UserDeviceMapping(models.Model):
    class DeviceStatus(models.IntegerChoices):
        PENDING = 0, "Pending"
        APPROVED = 1, "Approved"
        INACTIVE = 2, "Inactive"

    class DeviceType(models.TextChoices):
        ANDROID = "android", "Android"
        IOS = "ios", "iOS"
        WEB_DESKTOP = "web_desktop", "Web Desktop"
        WEB_MOBILE = "web_mobile", "Web Mobile"
        UNKNOWN = "unknown", "Unknown"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_mappings",
    )
    username_snapshot = models.CharField(max_length=150)
    device_uid = models.CharField(max_length=255)
    device_type = models.CharField(
        max_length=32,
        choices=DeviceType.choices,
        default=DeviceType.UNKNOWN,
    )
    user_agent = models.TextField(blank=True, null=True)
    status = models.IntegerField(choices=DeviceStatus.choices, default=DeviceStatus.PENDING)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_device_mappings",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_device_mapping"
        constraints = [
            models.UniqueConstraint(
                fields=["device_uid"],
                name="uniq_global_device_uid",
            )
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["device_uid"]),
        ]

    def __str__(self):
        return f"{self.username_snapshot} | {self.device_uid} | {self.get_status_display()}"
