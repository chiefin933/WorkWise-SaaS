import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from tenants.models import Tenant

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    username = None  # Use email instead
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, null=True, blank=True)
    role = models.CharField(max_length=50, choices=[
        ('ADMIN', 'Admin'),
        ('HR', 'HR Manager'),
        ('FINANCE', 'Finance Manager'),
        ('EMPLOYEE', 'Employee'),
    ], default='EMPLOYEE')
    clerk_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    invite_token = models.CharField(max_length=36, null=True, blank=True, db_index=True)
    # Stores per-user notification toggle preferences.
    # Keys: payroll_run, leave_status, new_member, trial_expiry
    # Values: True (enabled) or False (disabled). Missing key = True (default on).
    notification_preferences = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email


class Notification(models.Model):
    TYPE_CHOICES = [
        ('payroll', 'Payroll'),
        ('leave', 'Leave'),
        ('employee', 'Employee'),
        ('system', 'System')
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.recipient.email}"

