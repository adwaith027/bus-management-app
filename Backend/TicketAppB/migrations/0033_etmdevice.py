import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0032_mosambeepayoutcallback'),
    ]

    operations = [
        migrations.CreateModel(
            name='ETMDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('serial_number', models.CharField(max_length=100, unique=True)),
                ('display_name', models.CharField(blank=True, max_length=100)),
                ('device_type', models.CharField(
                    choices=[('ETM', 'ETM (Electronic Ticket Machine)'), ('ANDROID', 'Android App Device')],
                    default='ETM',
                    max_length=20,
                )),
                ('mac_address', models.CharField(blank=True, max_length=100)),
                ('device_registration_id', models.CharField(blank=True, max_length=255)),
                ('licence_status', models.CharField(
                    choices=[('Pending', 'Pending'), ('Active', 'Active'), ('Inactive', 'Inactive'), ('Expired', 'Expired')],
                    default='Pending',
                    max_length=20,
                )),
                ('licence_active_to', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=False)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approved_etm_devices',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('company', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etm_devices',
                    to='TicketAppB.company',
                )),
                ('dealer', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etm_devices',
                    to='TicketAppB.dealer',
                )),
                ('depot', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='etm_devices',
                    to='TicketAppB.depot',
                )),
            ],
            options={
                'db_table': 'etm_device',
            },
        ),
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['serial_number'], name='etm_dev_serial_idx'),
        ),
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['company', 'licence_status'], name='etm_dev_company_status_idx'),
        ),
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['dealer'], name='etm_dev_dealer_idx'),
        ),
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['licence_status'], name='etm_dev_status_idx'),
        ),
    ]
