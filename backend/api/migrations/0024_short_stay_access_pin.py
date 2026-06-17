from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_short_stay_check_times_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='shortstaybooking',
            name='access_pin',
            field=models.CharField(
                blank=True,
                default='',
                help_text='4-digit guest portal PIN emailed on confirmation',
                max_length=10,
            ),
        ),
    ]
