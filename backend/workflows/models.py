import uuid
from django.db import models
from tenants.models import Tenant
from core.tenant_models import TenantScopedModel
from users.models import User


class ApprovalTemplate(TenantScopedModel):
    """Configurable approval template for different workflows (e.g., leave, salary change, expense)"""
    WORKFLOW_TYPES = [
        ('leave', 'Leave Request'),
        ('salary_change', 'Salary Change'),
        ('employee_onboarding', 'Employee Onboarding'),
        ('employee_termination', 'Employee Termination'),
        ('promotion', 'Promotion'),
        ('transfer', 'Transfer'),
        ('payroll', 'Payroll'),
        ('expense', 'Expense Claim'),
        ('loan', 'Loan Request'),
        ('other', 'Other'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='approval_templates')
    name = models.CharField(max_length=255)
    workflow_type = models.CharField(max_length=50, choices=WORKFLOW_TYPES, default='other')
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'workflow_type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_workflow_type_display()})"


class ApprovalStep(TenantScopedModel):
    """Single step in an approval template (e.g., Manager approval → HR approval → Finance approval)"""
    APPROVER_TYPES = [
        ('role', 'Specific Role'),
        ('user', 'Specific User'),
        ('department_head', 'Department Head'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(ApprovalTemplate, on_delete=models.CASCADE, related_name='steps')
    order = models.PositiveIntegerField(help_text="Order of the step (1, 2, 3...)")
    name = models.CharField(max_length=255)
    approver_type = models.CharField(max_length=30, choices=APPROVER_TYPES, default='role')
    approver_role = models.CharField(max_length=50, blank=True, default='', help_text="Role required if approver_type is 'role'")
    approver_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_approval_steps', help_text="Specific user if approver_type is 'user'")
    requires_comment = models.BooleanField(default=False, help_text="Whether approval requires a comment")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(fields=['template', 'order'], name='unique_template_step_order'),
        ]

    def __str__(self):
        return f"Step {self.order}: {self.name}"


class ApprovalRequest(TenantScopedModel):
    """Actual approval request for a specific item (e.g., a leave request or salary change)"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='approval_requests')
    template = models.ForeignKey(ApprovalTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='requests')
    workflow_type = models.CharField(max_length=50, choices=ApprovalTemplate.WORKFLOW_TYPES, default='other')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_approvals')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    # Generic foreign key to the related object (leave request, expense claim, etc.)
    related_object_type = models.CharField(max_length=100, blank=True, default='')
    related_object_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'requester']),
            models.Index(fields=['tenant', 'workflow_type']),
        ]

    def __str__(self):
        return f"Approval Request: {self.title}"


class ApprovalAction(TenantScopedModel):
    """Action taken on an approval step (approve/reject with comment)"""
    ACTION_TYPES = [
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('delegate', 'Delegate'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ApprovalRequest, on_delete=models.CASCADE, related_name='actions')
    step = models.ForeignKey(ApprovalStep, on_delete=models.SET_NULL, null=True, blank=True, related_name='actions')
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='approval_actions')
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    comment = models.TextField(blank=True, default='')
    # If delegated, who was it delegated to?
    delegated_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='delegated_approval_actions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor.email} {self.action_type} for {self.request.title}"
