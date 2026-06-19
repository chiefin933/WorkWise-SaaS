# Generated manually for role-based invite flow.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_clerk_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='invite_token',
            field=models.CharField(blank=True, db_index=True, max_length=36, null=True),
        ),
    ]
