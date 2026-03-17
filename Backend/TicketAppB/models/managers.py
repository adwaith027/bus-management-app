from django.contrib.auth.models import UserManager


class CustomUserManager(UserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", "user")
        return super().create_user(
            username=username,
            email=email,
            password=password,
            **extra_fields,
        )

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("is_device_valid", True)
        extra_fields.setdefault("role", "superadmin")
        return super().create_superuser(
            username=username,
            email=email,
            password=password,
            **extra_fields,
        )
