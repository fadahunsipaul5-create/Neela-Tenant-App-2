# Generated migration: add status (vacant/occupied) to Property

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_legaldocument_dropbox_sign'),
    ]

    operations = [
        migrations.AddField(
            model_name='property',
            name='status',
            field=models.CharField(
                choices=[('vacant', 'Vacant'), ('occupied', 'Occupied')],
                default='vacant',
                help_text='Vacant = available to apply; Occupied = hide Apply button and show label',
                max_length=20,
            ),
        ),
    ]
