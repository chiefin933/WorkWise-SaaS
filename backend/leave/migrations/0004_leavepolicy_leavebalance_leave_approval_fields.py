"""
Migration: Add LeavePolicy, LeaveBalance models and approval-stage fields to Leave.
"""

import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leave', '0003_add_reason_to_leave'),
        ('employees', '0005_alter_employee_bank_details_alter_employee_kra_pin_and_more'),
        ('tenants', '__latest__'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── LeavePolicy ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LeavePolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('annual_days',    models.PositiveIntegerField(default=21)),
                ('sick_days',      models.PositiveIntegerField(default=30)),
                ('maternity_days', models.PositiveIntegerField(default=90)),
                ('paternity_days', models.PositiveIntegerField(default=14)),
                ('notice_days',    models.PositiveIntegerField(
                    default=14,
                    help_text='Minimum advance notice required for leave requests.'
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='leave_policy',
                    to='tenants.tenant',
                )),
            ],
            options={
                'verbose_name': 'Leave Policy',
                'verbose_name_plural': 'Leave Policies',
            },
        ),

        # ── LeaveBalance ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LeaveBalance',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('leave_type', models.CharField(
                    choices=[
                        ('annual', 'Annual Leave'),
                        ('sick', 'Sick Leave'),
                        ('maternity', 'Maternity Leave'),
                        ('paternity', 'Paternity Leave'),
                        ('unpaid', 'Unpaid Leave'),
                    ],
                    max_length=20,
                )),
                ('year',          models.PositiveIntegerField()),
                ('entitled_days', models.DecimalField(decimal_places=1, default=Decimal('0.0'), max_digits=6)),
                ('used_days',     models.DecimalField(decimal_places=1, default=Decimal('0.0'), max_digits=6)),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='leave_balances',
                    to='employees.employee',
                )),
            ],
            options={'abstract': False},
        ),
        migrations.AddIndex(
            model_name='leavebalance',
            index=models.Index(fields=['employee', 'year'], name='lb_employee_year_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='leavebalance',
            unique_together={('employee', 'leave_type', 'year')},
        ),

        # ── Leave: add approval-stage fields ─────────────────────────────────
        migrations.AddField(
            model_name='leave',
            name='approved_by',
            field=models.ForeignKey(
                blank=True,
                help_text='HR/Admin who gave final approval or rejection.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approved_leaves',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='leave',
            name='manager_approved_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Line manager who gave first-stage approval.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='manager_approved_leaves',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Extend status choices to include manager_approved stage
        migrations.AlterField(
            model_name='leave',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('manager_approved', 'Manager Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
