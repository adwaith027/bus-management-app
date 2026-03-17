from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.conf import settings

# Company & Branch models

class Company(models.Model):
    # Authentication Status Choices
    class AuthStatus(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        # for showing in UI that license validation is undergoing
        VALIDATING = 'Validating', 'Validating'
        APPROVED = 'Approve', 'Approved'
        EXPIRED = 'Expired', 'Expired'
        BLOCKED = 'Block', 'Blocked'

    # Basic Company Information
    company_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    company_name = models.CharField(max_length=100)
    company_email = models.EmailField(unique=True)
    gst_number = models.CharField(max_length=20, null=True, blank=True)
    
    # Contact Information
    contact_person = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=20)
    
    # Address Information
    address = models.TextField()
    address_2 = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    
    # License Information
    number_of_licence = models.IntegerField(default=0)
    authentication_status = models.CharField(
        max_length=20,
        choices=AuthStatus.choices,
        default=AuthStatus.PENDING,
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='companies_created'
    )
    
    # License Server Fields
    product_registration_id = models.IntegerField(null=True, blank=True)
    unique_identifier = models.CharField(max_length=255, null=True, blank=True)
    product_from_date = models.DateField(null=True, blank=True)
    product_to_date = models.DateField(null=True, blank=True)
    
    # Additional License Fields
    project_code = models.CharField(max_length=100, null=True, blank=True)
    device_count = models.IntegerField(null=True, blank=True)
    branch_count = models.IntegerField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'company'
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
    
    def __str__(self):
        return self.company_name
    
    @property
    def is_validated(self):
        """Check if company license is validated"""
        return self.authentication_status == self.AuthStatus.APPROVED
    
    @property
    def needs_validation(self):
        """Check if company needs license validation"""
        return self.authentication_status == self.AuthStatus.PENDING
    
    @property
    def is_validating(self):
        """Check if validation is in progress"""
        return self.authentication_status == self.AuthStatus.VALIDATING



class Branch(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='branches'
    )

    branch_code = models.CharField(
        max_length=50,
        unique=True
    )

    branch_name = models.CharField(
        max_length=100
    )

    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)

    # who created this branch
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branches_created'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branch'
        unique_together = ['company', 'branch_code']
        indexes = [
            models.Index(fields=['company', 'branch_code']),
        ]

    def __str__(self):
        return f"{self.branch_name} ({self.company.company_name})"


class Dealer(models.Model):
    dealer_code = models.CharField(max_length=50, unique=True)
    dealer_name = models.CharField(max_length=150)
    contact_person = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=20)
    email = models.EmailField(unique=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    gst_number = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dealers_created'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dealer'
        indexes = [
            models.Index(fields=['dealer_code']),
            models.Index(fields=['dealer_name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.dealer_code} - {self.dealer_name}"


class DealerCustomerMapping(models.Model):
    dealer = models.ForeignKey(
        Dealer,
        on_delete=models.CASCADE,
        related_name='company_mappings'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='dealer_mappings'
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dealer_company_mappings_created'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dealer_customer_mapping'
        unique_together = ['dealer', 'company']
        indexes = [
            models.Index(fields=['dealer', 'company']),
            models.Index(fields=['company']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.dealer.dealer_name} -> {self.company.company_name}"


class ExecutiveCompanyMapping(models.Model):
    executive_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='executive_company_mappings'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='executive_mappings'
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='executive_company_mappings_created'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'executive_company_mapping'
        unique_together = ['executive_user', 'company']
        indexes = [
            models.Index(fields=['executive_user', 'company']),
            models.Index(fields=['company']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.executive_user.username} -> {self.company.company_name}"
