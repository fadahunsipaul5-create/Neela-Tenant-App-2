from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0024_short_stay_access_pin'),
    ]

    operations = [
        migrations.CreateModel(
            name='OperatingExpense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('category', models.CharField(choices=[('utilities', 'Utilities'), ('maintenance', 'Maintenance'), ('taxes', 'Taxes'), ('insurance', 'Insurance'), ('management', 'Management'), ('cleaning', 'Cleaning'), ('other', 'Other')], default='utilities', max_length=50)),
                ('date', models.DateField(default=django.utils.timezone.now)),
                ('notes', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('property', models.ForeignKey(blank=True, help_text='Optional: leave blank for portfolio-level expense', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='operating_expenses', to='api.property')),
            ],
            options={
                'ordering': ['-date', '-id'],
            },
        ),
    ]
