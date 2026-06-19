from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
import logging
import calendar

logger = logging.getLogger(__name__)


@receiver(pre_save, sender='users.User')
def capture_user_role_before_save(sender, instance, **kwargs):
    """
    Stash the current role value on the instance so post_save can compare it.
    Only fires for existing users (pk is already set).
    """
    if not instance.pk:
        return
    try:
        instance._pre_save_role = sender.objects.get(pk=instance.pk).role
    except sender.DoesNotExist:
        instance._pre_save_role = None


@receiver(post_save, sender='users.User')
def role_change_audit_signal(sender, instance, created, **kwargs):
    """
    When an existing user's role field changes, write a PERMISSION_CHANGE
    AuditLog entry via the shared log_action() helper so the record is
    immutable and HMAC-sealed.
    """
    if created:
        return

    old_role = getattr(instance, '_pre_save_role', None)
    new_role = instance.role

    if old_role is None or old_role == new_role:
        return

    try:
        from core.audit import log_action, AuditAction
        log_action(
            action=AuditAction.PERMISSION_CHANGE,
            actor_id=str(instance.pk),
            actor_email=instance.email,
            tenant=instance.tenant,
            resource_type='User',
            resource_id=str(instance.pk),
            before={'role': old_role},
            after={'role': new_role},
        )
        logger.info(
            "AuditLog: role change for user pk=%s (%s → %s)",
            instance.pk, old_role, new_role,
        )
    except Exception as exc:
        # Never let audit failures crash the save
        logger.error("Failed to write role-change audit log: %s", exc)

# Signal receiver functions for leave, payroll, and employee events.
# To avoid early imports, we import Leave, PayrollRun, Employee in the ready method or inside the handlers.


@receiver(post_save, sender='leave.Leave')
def leave_notification_signal(sender, instance, created, **kwargs):
    from users.models import User, Notification
    
    try:
        tenant = instance.employee.tenant
    except Exception as e:
        logger.error(f"Error getting tenant for leave notification: {e}")
        return

    if created and instance.status == 'pending':
        # Leave submitted -> Notifies All ADMIN + HR users in tenant
        recipients = User.objects.filter(tenant=tenant, role__in=['ADMIN', 'HR'])
        leave_type_display = instance.get_leave_type_display()
        
        for recipient in recipients:
            title = "Leave Request Pending"
            message = f"{instance.employee.name} has submitted a {leave_type_display} request ({instance.start_date} to {instance.end_date}) that needs your approval."
            
            # Avoid duplicate notification creation
            if not Notification.objects.filter(
                tenant=tenant,
                recipient=recipient,
                type='leave',
                title=title,
                message=message
            ).exists():
                Notification.objects.create(
                    tenant=tenant,
                    recipient=recipient,
                    type='leave',
                    title=title,
                    message=message,
                    action_url='/leave'
                )
                logger.info(f"Created leave pending notification for {recipient.email}")
                
    elif not created:
        # Leave approved/rejected -> Notifies The requesting employee
        if instance.status in ['approved', 'rejected']:
            recipient = User.objects.filter(tenant=tenant, email=instance.employee.email).first()
            if recipient:
                status_display = instance.status.capitalize()
                title = f"Leave Request {status_display}"
                leave_type_display = instance.get_leave_type_display()
                message = f"Your request for {leave_type_display} ({instance.start_date} to {instance.end_date}) has been {instance.status}."
                
                # Check for duplicate
                if not Notification.objects.filter(
                    tenant=tenant,
                    recipient=recipient,
                    type='leave',
                    title=title,
                    message=message
                ).exists():
                    Notification.objects.create(
                        tenant=tenant,
                        recipient=recipient,
                        type='leave',
                        title=title,
                        message=message,
                        action_url='/leave'
                    )
                    logger.info(f"Created leave status change notification for {recipient.email}")

@receiver(post_save, sender='payroll.PayrollRun')
def payroll_notification_signal(sender, instance, created, **kwargs):
    from users.models import User, Notification
    
    tenant = instance.tenant
    
    if instance.status == 'processed':
        # Payroll run processed -> Notifies All ADMIN + HR users
        recipients = User.objects.filter(tenant=tenant, role__in=['ADMIN', 'HR'])
        
        items = instance.items.all()
        employee_count = items.count()
        total_net = sum(item.net_pay for item in items)
        
        try:
            month_name = calendar.month_name[instance.month]
        except Exception:
            month_name = f"Month {instance.month}"
            
        title = "Payroll Run Completed"  # Matches the title in wireframe
        message = f"{month_name} {instance.year} payroll has been processed successfully for {employee_count} employees. Total net pay: KES {total_net:,.2f}."
        
        for recipient in recipients:
            if not Notification.objects.filter(
                tenant=tenant,
                recipient=recipient,
                type='payroll',
                title=title,
                message=message
            ).exists():
                Notification.objects.create(
                    tenant=tenant,
                    recipient=recipient,
                    type='payroll',
                    title=title,
                    message=message,
                    action_url='/payroll'
                )
                logger.info(f"Created payroll processed notification for {recipient.email}")

@receiver(post_save, sender='employees.Employee')
def employee_notification_signal(sender, instance, created, **kwargs):
    from users.models import User, Notification

    # Only notify for genuine new employees, not bulk imports or updates.
    # Bulk imports set _skip_signal=True on the instance to suppress noise.
    if getattr(instance, '_skip_signal', False):
        return

    tenant = instance.tenant

    if created:
        recipients = User.objects.filter(tenant=tenant, role='ADMIN')
        title = "New Employee Onboarded"
        message = f"{instance.name} has completed onboarding and is now active in the system."

        for recipient in recipients:
            if not Notification.objects.filter(
                tenant=tenant,
                recipient=recipient,
                type='employee',
                title=title,
                message=message
            ).exists():
                Notification.objects.create(
                    tenant=tenant,
                    recipient=recipient,
                    type='employee',
                    title=title,
                    message=message,
                    action_url='/employees'
                )
                logger.info(f"Created employee onboarded notification for {recipient.email}")
