from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0003_add_refresh_jti_to_usersession'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='scheduledata',
            name='received_at',
        ),
        migrations.RemoveField(
            model_name='tripdata',
            name='received_at',
        ),
    ]
