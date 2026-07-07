import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta

class Tenant(models.Model):
    STATUS_ACTIVE = 'ACTIVE'

    PLAN_CHOICES = [
        ('STARTER', 'Starter Plan'),
        ('GROWTH', 'Growth Plan'),
        ('BUSINESS', 'Business Plan'),
        ('ENTERPRISE', 'Enterprise Plan'),
    ]
    
    STATUS_CHOICES = [
        ('TRIAL', 'Trial'),
        (STATUS_ACTIVE, 'Active'),
        ('PAST_DUE', 'Past Due'),
        ('SUSPENDED', 'Suspended'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    country = models.CharField(max_length=100, default="Kenya")
    currency = models.CharField(max_length=10, default="KES")
    
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='STARTER')
    subscription_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TRIAL')
    
    max_employees = models.IntegerField(default=15)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    kra_pin = models.CharField(max_length=20, blank=True, default='')
    address = models.TextField(blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Set trial period (14 days) if new
        if not self.pk and not self.trial_ends_at:
            self.trial_ends_at = timezone.now() + timedelta(days=14)
            
        # Update max employees based on plan
        if self.plan == 'STARTER':
            self.max_employees = 15
        elif self.plan == 'GROWTH':
            self.max_employees = 75
        elif self.plan == 'BUSINESS':
            self.max_employees = 300
        elif self.plan == 'ENTERPRISE':
            self.max_employees = 999999
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_plan_display()})"


class MpesaSubscriptionPayment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='subscription_payments')
    plan = models.CharField(max_length=20)
    phone_number = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    merchant_request_id = models.CharField(max_length=100, db_index=True)
    checkout_request_id = models.CharField(max_length=100, db_index=True)
    
    result_code = models.CharField(max_length=10, blank=True, default='')
    result_desc = models.TextField(blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tenant.name} - {self.plan} ({self.status})"


class TenantSettings(models.Model):
    """Company customization settings for a tenant"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='settings')
    # Branding
    logo = models.ImageField(upload_to='tenant_logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#0ea5e9', help_text='Primary brand color (hex)')
    secondary_color = models.CharField(max_length=7, default='#0284c7', help_text='Secondary brand color (hex)')
    # Payslip template
    payslip_header_text = models.CharField(max_length=255, blank=True, default='')
    payslip_footer_text = models.CharField(max_length=255, blank=True, default='')
    # Leave policies (already covered in leave.models.LeavePolicy)
    # Working days
    working_days = models.JSONField(default=list, help_text='List of working days (0=Monday, 6=Sunday)')
    weekend_days = models.JSONField(default=list, help_text='List of weekend days (0=Monday, 6=Sunday)')
    # Time zone
    time_zone = models.CharField(max_length=100, default='Africa/Nairobi')
    # Language
    language = models.CharField(max_length=10, default='en')
    # Public holidays (JSON list of dates)
    public_holidays = models.JSONField(default=list, help_text='List of public holiday dates (YYYY-MM-DD)')
    # Created/Updated
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.tenant.name}"

