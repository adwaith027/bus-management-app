from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.conf import settings
from .company import Company

# Authentication models

class CustomUser(AbstractUser):
    role = models.CharField(max_length=32, blank=True, null=True,default='user')
    is_verified = models.BooleanField(default=False)
    # db stores id in company_id
    company=models.ForeignKey(to=Company,on_delete=models.CASCADE,null=True,blank=True,related_name='users')
    
    class Meta:
        db_table = 'custom_user'
    
    def __str__(self):
        return self.username
