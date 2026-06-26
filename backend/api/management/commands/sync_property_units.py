from django.core.management.base import BaseCommand

from api.property_units_service import sync_all_property_units


class Command(BaseCommand):
    help = 'Create/update PropertyUnit rows from unit-level Property records and unit counts'

    def handle(self, *args, **options):
        count = sync_all_property_units()
        self.stdout.write(self.style.SUCCESS(f'Synced units for {count} portfolio properties.'))
