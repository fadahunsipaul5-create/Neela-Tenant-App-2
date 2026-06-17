from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_short_stay_blocked_date'),
    ]

    operations = [
        migrations.AlterField(
            model_name='property',
            name='short_stay_check_in_time',
            field=models.CharField(
                blank=True,
                help_text='Override auto check-in time; defaults by bedroom count (Airbnb US norms)',
                max_length=20,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='property',
            name='short_stay_check_out_time',
            field=models.CharField(
                blank=True,
                help_text='Override auto checkout time; defaults by bedroom count (Airbnb US norms)',
                max_length=20,
                null=True,
            ),
        ),
    ]
