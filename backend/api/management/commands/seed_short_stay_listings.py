from django.core.management.base import BaseCommand

from api.models import Property

# Airbnb-style guest-facing copy — no real addresses or property names.
LISTING_PRESETS = [
    {
        'title': 'Cozy Urban Retreat · Sunlit & Peaceful',
        'description': (
            'Unwind in this beautifully kept home with soft lighting, comfy seating, and a calm atmosphere. '
            'Ideal for weekend escapes, work trips, or a relaxing Houston getaway.'
        ),
        'area': 'East Houston',
    },
    {
        'title': 'Modern Comfort Haven · Quiet Neighborhood',
        'description': (
            'A stylish, fully equipped stay with thoughtful touches throughout. '
            'Enjoy a clean, private space perfect for couples, families, or solo travelers.'
        ),
        'area': 'Southeast Houston',
    },
    {
        'title': 'Charming Family Getaway · Spacious & Warm',
        'description': (
            'Spread out and feel at home in this inviting space with room for everyone. '
            'Great for longer stays with easy access to dining, shopping, and local attractions.'
        ),
        'area': 'Inner Loop',
    },
    {
        'title': 'Serene Hideaway · Relaxed Vibes',
        'description': (
            'Step into a peaceful environment designed for rest and recharge. '
            'Comfortable beds, a welcoming layout, and a stress-free check-in experience.'
        ),
        'area': 'North Houston',
    },
    {
        'title': 'Bright & Airy Stay · Home Away From Home',
        'description': (
            'Natural light fills this cheerful space with everything you need for a comfortable visit. '
            'Perfect for travelers who value cleanliness, comfort, and convenience.'
        ),
        'area': 'West Houston',
    },
    {
        'title': 'Stylish City Escape · Walkable Area',
        'description': (
            'Discover Houston from a well-located, thoughtfully furnished retreat. '
            'Ideal for guests who want a polished stay without the hotel feel.'
        ),
        'area': 'Central Houston',
    },
    {
        'title': 'Tranquil Garden View Stay · Private & Calm',
        'description': (
            'Enjoy a quiet setting with a cozy interior and all the essentials for a great stay. '
            'A wonderful choice for guests seeking comfort and privacy.'
        ),
        'area': 'South Houston',
    },
    {
        'title': 'Elegant Short-Term Rental · Premium Comfort',
        'description': (
            'Experience elevated comfort in this well-maintained home with quality furnishings and a refined feel. '
            'Suited for business travelers and leisure guests alike.'
        ),
        'area': 'Medical Center Area',
    },
    {
        'title': 'Welcoming Guest Suite · Easy Check-In',
        'description': (
            'A hassle-free stay in a clean, comfortable environment. '
            'Everything is set up so you can settle in quickly and enjoy your time in Houston.'
        ),
        'area': 'Greater Houston',
    },
    {
        'title': 'Sunny Retreat · Perfect for Groups',
        'description': (
            'Room to gather, relax, and make memories in this friendly, well-appointed space. '
            'Great for families, friends, and small group trips.'
        ),
        'area': 'East End',
    },
    {
        'title': 'Nestled Comfort Cottage · Cozy Nights',
        'description': (
            'Snuggle into a warm, inviting atmosphere with soft linens and a laid-back charm. '
            'An excellent pick for a romantic weekend or peaceful solo retreat.'
        ),
        'area': 'Near Downtown',
    },
    {
        'title': 'Fresh & Clean Studio Feel · Minimal & Modern',
        'description': (
            'Simple, modern, and spotless — this stay is designed for guests who love a clutter-free space. '
            'Everything you need, nothing you do not.'
        ),
        'area': 'Midtown Houston',
    },
    {
        'title': 'Relaxing Weekend Spot · Unplug & Unwind',
        'description': (
            'Leave the hustle behind in this restful home with comfortable living spaces and a welcoming vibe. '
            'Perfect when you just want to slow down and breathe.'
        ),
        'area': 'Third Ward',
    },
    {
        'title': 'Houston Hideout · Central & Convenient',
        'description': (
            'Stay close to the action while enjoying a private, comfortable base. '
            'A smart choice for visitors exploring the city for the first time.'
        ),
        'area': 'Heights Area',
    },
    {
        'title': 'Peaceful Overnight Stay · Soft & Serene',
        'description': (
            'A gentle, welcoming space for short visits and extended stays alike. '
            'Expect a clean home, responsive host support, and a smooth booking experience.'
        ),
        'area': 'Southwest Houston',
    },
]


class Command(BaseCommand):
    help = 'Seeds Airbnb-style guest listing titles and descriptions for short stays'

    def handle(self, *args, **options):
        properties = list(Property.objects.filter(short_stay_enabled=True).order_by('id'))
        if not properties:
            properties = list(Property.objects.all().order_by('id'))

        updated = 0
        for idx, prop in enumerate(properties):
            preset = LISTING_PRESETS[idx % len(LISTING_PRESETS)]
            prop.short_stay_listing_title = preset['title']
            prop.short_stay_listing_description = preset['description']
            prop.short_stay_listing_area = preset['area']
            prop.save(update_fields=[
                'short_stay_listing_title',
                'short_stay_listing_description',
                'short_stay_listing_area',
            ])
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(f'Updated guest listing copy for {updated} propert{"y" if updated == 1 else "ies"}.')
        )
