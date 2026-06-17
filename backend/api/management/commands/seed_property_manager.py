from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from api.models import Property, PropertyManagerProfile

User = get_user_model()

MANAGER_EMAIL = 'manager@neelacapital.com'
MANAGER_PASSWORD = 'neela2025'


class Command(BaseCommand):
    help = 'Seeds the default property manager and assigns all properties'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=MANAGER_EMAIL,
            defaults={
                'first_name': 'Neela',
                'last_name': 'Manager',
                'role': 'property_manager',
                'is_verified': True,
                'is_active': True,
                'is_staff': False,
                'is_superuser': False,
            },
        )
        user.first_name = user.first_name or 'Neela'
        user.last_name = user.last_name or 'Manager'
        user.role = 'property_manager'
        user.is_verified = True
        user.is_active = True
        user.is_staff = False
        user.is_superuser = False
        user.set_password(MANAGER_PASSWORD)
        user.save()

        profile, _ = PropertyManagerProfile.objects.get_or_create(user=user)
        if not profile.phone:
            profile.phone = '(713) 555-0199'
            profile.save(update_fields=['phone'])

        properties = list(Property.objects.all())
        profile.properties.set(properties)

        action = 'Created' if created else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'{action} property manager {MANAGER_EMAIL} — '
                f'{len(properties)} propert{"y" if len(properties) == 1 else "ies"} assigned.'
            )
        )
