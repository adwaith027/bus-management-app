import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0033_etmdevice'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='RouteDepot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='route_depots',
                    to='TicketAppB.company',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='route_depots_created',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('depot', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='route_depots',
                    to='TicketAppB.depot',
                )),
                ('route', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='route_depots',
                    to='TicketAppB.route',
                )),
            ],
            options={
                'db_table': 'mdb_route_depot',
            },
        ),
        migrations.AlterUniqueTogether(
            name='routedepot',
            unique_together={('route', 'depot')},
        ),
        migrations.AddIndex(
            model_name='routedepot',
            index=models.Index(fields=['route'], name='mdb_route_depot_route_idx'),
        ),
        migrations.AddIndex(
            model_name='routedepot',
            index=models.Index(fields=['company'], name='mdb_route_depot_company_idx'),
        ),
    ]
