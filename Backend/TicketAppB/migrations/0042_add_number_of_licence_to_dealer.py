from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('TicketAppB', '0041_add_client_type_to_company'),
    ]

    operations = [
        migrations.AddField(
            model_name='dealer',
            name='number_of_licence',
            field=models.IntegerField(default=0),
        ),
    ]
