import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_property_area_property_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeaseSigningToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('legal_document', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='signing_token',
                    to='api.legaldocument',
                )),
            ],
        ),
    ]
