from django.db import migrations


class Migration(migrations.Migration):
    """
    Remove the unique_together constraint on (tenant, month, year) from PayrollRun.

    This constraint blocked the payroll reversal workflow — when a run is reversed
    and a corrective run is created for the same month/year, the DB rejected it.

    Uniqueness is now enforced at the application level in PayrollRunViewSet.perform_create():
    only one non-reversed run is allowed per (tenant, month, year) at a time.
    Reversed runs are explicitly excluded from the check, allowing corrective runs.
    """

    dependencies = [
        ('payroll', '0007_alter_mpesatransaction_status'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='payrollrun',
            unique_together=set(),
        ),
    ]
