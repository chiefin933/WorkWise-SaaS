"""
Add payslip_s3_key to PayrollItem for persistent S3 payslip storage.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payroll', '0004_payrollconfig_geofence_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='payrollitem',
            name='payslip_s3_key',
            field=models.CharField(
                blank=True,
                default='',
                max_length=512,
                help_text='S3 object key for the stored payslip PDF (empty = not yet uploaded).',
            ),
        ),
    ]
