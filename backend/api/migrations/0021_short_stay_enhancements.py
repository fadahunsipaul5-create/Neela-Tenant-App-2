from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_short_stay_booking'),
    ]

    operations = [
        migrations.AddField(
            model_name='property',
            name='short_stay_check_in_time',
            field=models.CharField(default='3:00 PM', max_length=20),
        ),
        migrations.AddField(
            model_name='property',
            name='short_stay_check_out_time',
            field=models.CharField(default='11:00 AM', max_length=20),
        ),
        migrations.AddField(
            model_name='property',
            name='short_stay_cleaning_fee',
            field=models.DecimalField(decimal_places=2, default=75, help_text='One-time cleaning fee for short stays', max_digits=10),
        ),
        migrations.AddField(
            model_name='shortstaybooking',
            name='cleaning_fee',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='shortstaybooking',
            name='guest_id_files',
            field=models.JSONField(blank=True, default=list, help_text='Optional guest ID verification uploads'),
        ),
    ]
