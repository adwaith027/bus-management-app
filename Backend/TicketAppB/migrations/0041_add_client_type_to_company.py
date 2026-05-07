from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0040_refactor_device_management'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='client_type',
            field=models.CharField(
                choices=[('company', 'Company'), ('dealer_company', 'Dealer Company')],
                default='company',
                max_length=20,
            ),
        ),
    ]
