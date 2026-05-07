from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0036_devicesettings'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SettingsProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('user_pwd', models.CharField(blank=True, max_length=255, null=True)),
                ('master_pwd', models.CharField(blank=True, max_length=255, null=True)),
                ('half_per', models.DecimalField(decimal_places=2, default=Decimal('50.00'), max_digits=5)),
                ('con_per', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=5)),
                ('phy_per', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=5)),
                ('round_amt', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('luggage_unit_rate', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('main_display', models.CharField(blank=True, max_length=50, null=True)),
                ('main_display2', models.CharField(blank=True, max_length=50, null=True)),
                ('header1', models.CharField(blank=True, max_length=100, null=True)),
                ('header2', models.CharField(blank=True, max_length=100, null=True)),
                ('header3', models.CharField(blank=True, max_length=100, null=True)),
                ('footer1', models.CharField(blank=True, max_length=100, null=True)),
                ('footer2', models.CharField(blank=True, max_length=100, null=True)),
                ('language_option', models.IntegerField(choices=[(0, 'Malayalam'), (1, 'Tamil')], default=0)),
                ('report_font', models.IntegerField(choices=[(0, 'Normal'), (1, 'Condensed')], default=0)),
                ('st_fare_edit', models.BooleanField(default=False)),
                ('st_max_amt', models.CharField(blank=True, default='0', max_length=5)),
                ('st_ratio', models.CharField(blank=True, default='0', max_length=2)),
                ('st_min_amt', models.CharField(blank=True, default='0', max_length=6)),
                ('st_roundoff_enable', models.BooleanField(default=False)),
                ('st_roundoff_amt', models.CharField(blank=True, default='0', max_length=3)),
                ('roundoff', models.BooleanField(default=False)),
                ('round_up', models.BooleanField(default=False)),
                ('remove_ticket_flag', models.BooleanField(default=False)),
                ('stage_font_flag', models.BooleanField(default=False)),
                ('next_fare_flag', models.BooleanField(default=False)),
                ('odometer_entry', models.BooleanField(default=False)),
                ('ticket_no_big_font', models.BooleanField(default=False)),
                ('crew_check', models.BooleanField(default=False)),
                ('tripsend_enable', models.BooleanField(default=False)),
                ('schedulesend_enable', models.BooleanField(default=False)),
                ('inspect_rpt', models.BooleanField(default=False)),
                ('multiple_pass', models.BooleanField(default=False)),
                ('simple_report', models.BooleanField(default=False)),
                ('inspector_sms', models.BooleanField(default=False)),
                ('auto_shut_down', models.BooleanField(default=False)),
                ('userpswd_enable', models.BooleanField(default=False)),
                ('exp_enable', models.BooleanField(default=False)),
                ('stage_updation_msg', models.IntegerField(default=0)),
                ('default_stage', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='settings_profiles', to='TicketAppB.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_profiles_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_profiles_updated', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'settings_profiles',
                'unique_together': {('company', 'name')},
            },
        ),
    ]
