"""
Add office_latitude, office_longitude, and geofence_radius_meters to PayrollConfig.
These enable optional geofence validation on employee clock-in.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payroll', '0003_mpesatransaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='payrollconfig',
            name='office_latitude',
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True
            ),
        ),
        migrations.AddField(
            model_name='payrollconfig',
            name='office_longitude',
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True
            ),
        ),
        migrations.AddField(
            model_name='payrollconfig',
            name='geofence_radius_meters',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text='Geofence radius in metres around the office coordinates. Leave blank to disable.',
            ),
        ),
    ]
