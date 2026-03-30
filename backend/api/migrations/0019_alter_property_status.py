from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_leasesigningtoken'),
    ]

    operations = [
        migrations.AlterField(
            model_name='property',
            name='status',
            field=models.CharField(
                choices=[('vacant', 'Vacant'), ('occupied', 'Occupied'), ('coming_soon', 'Coming Soon')],
                default='vacant',
                help_text='Vacant = available to apply; Occupied/Coming Soon = hide Apply button and show label',
                max_length=20,
            ),
        ),
    ]
