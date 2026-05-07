from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0039_alter_employeetype_emp_type_code_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── 1. Drop DeviceSettings table ─────────────────────────────────────
        migrations.DeleteModel(name='DeviceSettings'),

        # ── 2. Strip ETMDevice down to the new shape ──────────────────────────

        # Remove old indexes that reference fields being dropped
        migrations.RemoveIndex(model_name='etmdevice', name='etm_device_company_48e279_idx'),
        migrations.RemoveIndex(model_name='etmdevice', name='etm_device_licence_0e1c5c_idx'),

        # Remove fields
        migrations.RemoveField(model_name='etmdevice', name='display_name'),
        migrations.RemoveField(model_name='etmdevice', name='mac_address'),
        migrations.RemoveField(model_name='etmdevice', name='device_registration_id'),
        migrations.RemoveField(model_name='etmdevice', name='licence_status'),
        migrations.RemoveField(model_name='etmdevice', name='licence_active_to'),
        migrations.RemoveField(model_name='etmdevice', name='is_active'),
        migrations.RemoveField(model_name='etmdevice', name='approved_by'),
        migrations.RemoveField(model_name='etmdevice', name='approved_at'),
        migrations.RemoveField(model_name='etmdevice', name='depot'),

        # Add new fields
        migrations.AddField(
            model_name='etmdevice',
            name='allocation_status',
            field=models.CharField(
                choices=[
                    ('Stock', 'Stock'),
                    ('DealerPool', 'Dealer Pool'),
                    ('Allocated', 'Allocated'),
                    ('Inactive', 'Inactive'),
                ],
                default='Stock',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='etmdevice',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='etm_devices_created',
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # Add replacement indexes
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['company', 'allocation_status'], name='etm_dev_company_alloc_idx'),
        ),
        migrations.AddIndex(
            model_name='etmdevice',
            index=models.Index(fields=['allocation_status'], name='etm_dev_alloc_status_idx'),
        ),

        # ── 3. Remove Dealer licence-count fields ─────────────────────────────
        migrations.RemoveField(model_name='dealer', name='allocated_licence_count'),
        migrations.RemoveField(model_name='dealer', name='allocated_device_count'),
        migrations.RemoveField(model_name='dealer', name='allocated_mobile_device_count'),

        # ── 4. Remove palmtec_id from Settings ───────────────────────────────
        migrations.RemoveField(model_name='settings', name='palmtec_id'),

        # ── 5. Add palmtec_id to SettingsProfile ─────────────────────────────
        migrations.AddField(
            model_name='settingsprofile',
            name='palmtec_id',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text='Client-assigned device identifier (max 6 digits)',
            ),
        ),
    ]
