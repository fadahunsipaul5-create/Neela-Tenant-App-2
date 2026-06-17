from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_alter_property_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='property',
            name='short_stay_enabled',
            field=models.BooleanField(default=True, help_text='Show property in short-stay/Airbnb booking flow'),
        ),
        migrations.AddField(
            model_name='property',
            name='short_stay_max_guests',
            field=models.PositiveIntegerField(blank=True, help_text='Maximum guests for short stays; defaults from bedroom count if unset', null=True),
        ),
        migrations.AddField(
            model_name='property',
            name='short_stay_nightly_rate',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Nightly rate for short stays; defaults from monthly price if unset', max_digits=10, null=True),
        ),
        migrations.CreateModel(
            name='ShortStayBooking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('guest_name', models.CharField(max_length=255)),
                ('guest_email', models.EmailField(max_length=254)),
                ('guest_phone', models.CharField(max_length=50)),
                ('check_in', models.DateField()),
                ('check_out', models.DateField()),
                ('num_guests', models.PositiveIntegerField(default=1)),
                ('nights', models.PositiveIntegerField()),
                ('nightly_rate', models.DecimalField(decimal_places=2, max_digits=10)),
                ('discount_percent', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('payment_method', models.CharField(blank=True, default='', max_length=50)),
                ('status', models.CharField(choices=[('pending_payment', 'Pending Payment'), ('proof_submitted', 'Proof Submitted'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled')], default='pending_payment', max_length=50)),
                ('proof_of_payment_files', models.JSONField(blank=True, default=list)),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('property', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='short_stay_bookings', to='api.property')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
