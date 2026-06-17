"""Helpers for Neela Guest (neelaguest-main) portal integration."""
import random
import re

from .models import ShortStayBooking


def generate_short_stay_access_pin() -> str:
    """Generate a unique 4-digit PIN for confirmed short-stay bookings."""
    for _ in range(50):
        pin = f'{random.randint(0, 9999):04d}'
        if not ShortStayBooking.objects.filter(access_pin=pin, status='confirmed').exists():
            return pin
    raise RuntimeError('Could not generate a unique access PIN')


def build_guest_property_payload(property_obj, booking: ShortStayBooking) -> dict:
    """Map Django property + booking to neelaguest Property shape."""
    slug = re.sub(r'[^a-zA-Z0-9]', '', property_obj.name or 'NeelaGuest')[:12] or 'NeelaGuest'
    max_guests = property_obj.get_short_stay_max_guests()
    check_in = property_obj.get_short_stay_check_in_time()
    check_out = property_obj.get_short_stay_check_out_time()

    return {
        'id': str(property_obj.id),
        'name': property_obj.get_short_stay_listing_title(),
        'address': property_obj.get_short_stay_listing_location(),
        'latitude': None,
        'longitude': None,
        'wifi_name': f'NeelaGuest_{slug}',
        'wifi_password': f'Stay{booking.access_pin}!',
        'house_rules': [
            f'Check-in from {check_in}',
            f'Checkout by {check_out}',
            f'{max_guests} guests maximum',
            'No smoking inside the property',
            'Quiet hours after 10 PM',
            'No parties or events',
        ],
        'contact_phone': '+1 (832) 555-0100',
        'check_in_time': check_in,
        'check_out_time': check_out,
        'emergency_contacts': [
            {'name': 'Neela Capital Host', 'phone': '+1 (832) 555-0100', 'type': 'host'},
            {'name': 'Emergency', 'phone': '911', 'type': 'emergency'},
        ],
        'created_at': property_obj.created_at.isoformat() if property_obj.created_at else '',
        'updated_at': property_obj.updated_at.isoformat() if property_obj.updated_at else '',
    }


def build_guest_reservation_payload(booking: ShortStayBooking) -> dict:
    """Map confirmed booking to neelaguest Reservation shape."""
    prop = booking.property
    return {
        'id': booking.get_guest_portal_reservation_id(),
        'property_id': str(prop.id),
        'guest_name': booking.guest_name,
        'pin_code': booking.access_pin,
        'start_date': booking.check_in.isoformat(),
        'end_date': booking.check_out.isoformat(),
        'guest_count': booking.num_guests,
        'bedrooms': prop.bedrooms or 2,
        'beds': prop.bedrooms or 2,
        'created_at': booking.created_at.isoformat() if booking.created_at else '',
        'updated_at': booking.updated_at.isoformat() if booking.updated_at else '',
    }
