import uuid
from django.db import models
from django.utils import timezone

class Tenant(models.Model):
    STATUS_CHOICES = [
        ('Applicant', 'Applicant'),
        ('Approved', 'Approved'),
        ('Active', 'Active'),
        ('Past', 'Past'),
        ('Eviction Pending', 'Eviction Pending'),
        ('Declined', 'Declined'),
    ]

    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=50)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Applicant')
    property_unit = models.CharField(max_length=255)
    lease_start = models.DateField(null=True, blank=True)
    lease_end = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    deposit = models.DecimalField(max_digits=10, decimal_places=2)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    credit_score = models.IntegerField(null=True, blank=True)
    background_check_status = models.CharField(max_length=50, null=True, blank=True)
    application_data = models.JSONField(null=True, blank=True)
    lease_status = models.CharField(max_length=50, null=True, blank=True)
    signed_lease_url = models.URLField(null=True, blank=True)
    
    # File storage fields for application documents
    photo_id_files = models.JSONField(default=list, blank=True, help_text="List of uploaded photo ID file paths")
    income_verification_files = models.JSONField(default=list, blank=True, help_text="List of uploaded income verification file paths")
    background_check_files = models.JSONField(default=list, blank=True, help_text="List of uploaded background check file paths")

    def __str__(self):
        return self.name

    def calculate_balance(self):
        """
        Calculate current balance based on:
        - Rent amount (what tenant owes)
        - Deposit paid (reduces balance)
        - Payments received (reduce balance)
        - Pending charges (e.g. late fees) increase balance
        
        Balance = Rent Amount - Deposit - Total Paid + Total Pending Charges
        Positive balance = Tenant owes money
        Negative balance = Tenant has overpaid/credit
        """
        from decimal import Decimal
        from django.db.models import Sum
        
        total_paid = self.payments.filter(status='Paid').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')
        total_pending_charges = self.payments.filter(status='Pending').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')
        
        balance = self.rent_amount - self.deposit - total_paid + total_pending_charges
        
        return balance
    
    def update_balance(self):
        """Update the balance field with the calculated value"""
        self.balance = self.calculate_balance()
        self.save(update_fields=['balance'])

class Payment(models.Model):
    STATUS_CHOICES = [
        ('Paid', 'Paid'),
        ('Pending', 'Pending'),
        ('Overdue', 'Overdue'),
        ('Failed', 'Failed'),
    ]
    TYPE_CHOICES = [
        ('Rent', 'Rent'),
        ('Late Fee', 'Late Fee'),
        ('Deposit', 'Deposit'),
        ('Application Fee', 'Application Fee'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    method = models.CharField(max_length=50)
    reference = models.CharField(max_length=100, null=True, blank=True)
    proof_of_payment_files = models.JSONField(default=list, blank=True, help_text="List of uploaded proof of payment file paths (screenshots/receipts)")

    def __str__(self):
        return f"{self.tenant.name} - {self.amount} - {self.status}"

class OperatingExpense(models.Model):
    CATEGORY_CHOICES = [
        ('utilities', 'Utilities'),
        ('maintenance', 'Maintenance'),
        ('taxes', 'Taxes'),
        ('insurance', 'Insurance'),
        ('management', 'Management'),
        ('cleaning', 'Cleaning'),
        ('hoa', 'HOA Fees'),
        ('advertising', 'Advertising / Leasing'),
        ('legal', 'Legal & Professional'),
        ('supplies', 'Supplies & Materials'),
        ('transportation', 'Transportation'),
        ('bank_charges', 'Bank Charges'),
        ('mortgage_interest', 'Mortgage Interest'),
        ('mortgage_principal', 'Mortgage Principal'),
        ('depreciation', 'Depreciation'),
        ('other', 'Other'),
    ]
    VISIBILITY_CHOICES = [
        ('operating', 'Operating (visible to managers)'),
        ('admin_only', 'Admin only (financing / ownership)'),
    ]

    property = models.ForeignKey(
        'Property',
        on_delete=models.CASCADE,
        related_name='operating_expenses',
        null=True,
        blank=True,
        help_text='Optional: leave blank for portfolio-level expense',
    )
    unit = models.ForeignKey(
        'PropertyUnit',
        on_delete=models.SET_NULL,
        related_name='operating_expenses',
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='utilities')
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='operating',
        help_text='Admin-only expenses (mortgage, depreciation) are hidden from property managers',
    )
    date = models.DateField(default=timezone.now)
    notes = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_expenses',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        scope = self.property.name if self.property else 'Portfolio'
        return f"{scope} - {self.category} - {self.amount}"

class MaintenanceRequest(models.Model):
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Emergency', 'Emergency'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='maintenance_requests')
    category = models.CharField(max_length=50)
    description = models.TextField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Open')
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, default='Medium')
    created_at = models.DateTimeField(default=timezone.now)
    images = models.JSONField(default=list, blank=True)
    updates = models.JSONField(default=list, blank=True)
    assigned_to = models.CharField(max_length=255, null=True, blank=True)
    completion_attachments = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.category} - {self.tenant.name}"

class LeaseTemplate(models.Model):
    name = models.CharField(max_length=255)
    content = models.TextField(help_text="Lease template content with placeholders like {{tenant_name}}, {{rent_amount}}, etc.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class LegalDocument(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='legal_documents')
    type = models.CharField(max_length=100)
    generated_content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=50)
    delivery_method = models.CharField(max_length=50, null=True, blank=True)
    tracking_number = models.CharField(max_length=100, null=True, blank=True)
    # Lease-specific fields
    pdf_file = models.FileField(upload_to='leases/', null=True, blank=True)
    signed_pdf_url = models.URLField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    signing_audit = models.JSONField(null=True, blank=True, help_text="Who signed, when, IP, etc.")

    def __str__(self):
        return f"{self.type} - {self.tenant.name}"

class LeaseSigningToken(models.Model):
    """
    One-time token that lets a tenant open and sign their lease without needing
    to log in first. Created when admin sends a lease. Expires after 7 days.
    """
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    legal_document = models.OneToOneField(
        LegalDocument,
        on_delete=models.CASCADE,
        related_name='signing_token',
    )
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"SigningToken for doc {self.legal_document_id}"


class Listing(models.Model):
    title = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    beds = models.IntegerField()
    baths = models.DecimalField(max_digits=4, decimal_places=1)
    sqft = models.IntegerField()
    image = models.URLField()
    description = models.TextField()
    amenities = models.JSONField(default=list)

    def __str__(self):
        return self.title

class Property(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)
    units = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bedrooms = models.IntegerField(default=2, help_text="Number of bedrooms")
    bathrooms = models.DecimalField(max_digits=3, decimal_places=1, default=2.0, help_text="Number of bathrooms")
    square_footage = models.IntegerField(default=1000, help_text="Square footage")
    image = models.ImageField(upload_to='properties/', null=True, blank=True)
    image_url = models.URLField(null=True, blank=True)  # For external URLs
    furnishing_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Semi-furnished or Fully-furnished"
    )
    furnishings_breakdown = models.JSONField(
        default=list,
        blank=True,
        help_text="List of items available, e.g. [\"Sofa\", \"Dining table\", \"Bed\"]"
    )
    STATUS_CHOICES = [
        ('vacant', 'Vacant'),
        ('occupied', 'Occupied'),
        ('coming_soon', 'Coming Soon'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='vacant',
        help_text="Vacant = available to apply; Occupied/Coming Soon = hide Apply button and show label"
    )
    area = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        help_text="Area/location for filtering (e.g. Avenue Q, Sherman St). If missing, can be derived from address."
    )
    short_stay_enabled = models.BooleanField(default=True, help_text="Show property in short-stay/Airbnb booking flow")
    short_stay_nightly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Nightly rate for short stays; defaults from monthly price if unset"
    )
    short_stay_max_guests = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Maximum guests for short stays; defaults from bedroom count if unset"
    )
    short_stay_check_in_time = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='Override auto check-in time; defaults by bedroom count (Airbnb US norms)',
    )
    short_stay_check_out_time = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='Override auto checkout time; defaults by bedroom count (Airbnb US norms)',
    )
    short_stay_cleaning_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=75,
        help_text="One-time cleaning fee for short stays"
    )
    short_stay_listing_title = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Guest-facing Airbnb-style title (hides real property name)',
    )
    short_stay_listing_description = models.TextField(
        blank=True, default='',
        help_text='Guest-facing marketing blurb for short-stay listings',
    )
    short_stay_listing_area = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Vague neighborhood label shown to guests (no street address)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    
    @property
    def display_image(self):
        """Returns the uploaded image URL if available, otherwise the external URL"""
        if self.image:
            return self.image.url
        return self.image_url

    def _bedroom_nightly_baseline(self):
        """US Airbnb-style nightly baselines by bedroom count (2024–2025 market averages)."""
        from decimal import Decimal
        bedrooms = max(1, self.bedrooms or 2)
        baselines = {
            1: Decimal('115'),
            2: Decimal('165'),
            3: Decimal('215'),
            4: Decimal('275'),
            5: Decimal('340'),
        }
        if bedrooms in baselines:
            return baselines[bedrooms]
        return Decimal('340') + Decimal(str(bedrooms - 5)) * Decimal('45')

    def get_short_stay_nightly_rate(self):
        if self.short_stay_nightly_rate:
            return self.short_stay_nightly_rate
        from decimal import Decimal
        baseline = self._bedroom_nightly_baseline()
        if self.price:
            # Short-stay rates run ~35% above a straight monthly/30 prorate (turnover, furnishing).
            derived = (self.price / Decimal('30') * Decimal('1.35')).quantize(Decimal('0.01'))
            return max(baseline, derived)
        return baseline

    def get_short_stay_max_guests(self):
        if self.short_stay_max_guests:
            return self.short_stay_max_guests
        bedrooms = max(1, self.bedrooms or 2)
        # More generous than bedroom count — e.g. 3 BR comfortably fits 5 guests.
        return max(2, bedrooms + 2)

    def get_short_stay_included_guests(self):
        """Base nightly rate includes this many guests (US Airbnb standard)."""
        return 2

    def get_short_stay_extra_guest_fee_per_night(self):
        """Per extra guest per night beyond included count; scales with property size."""
        from decimal import Decimal
        bedrooms = max(1, self.bedrooms or 2)
        return Decimal(str(12 + bedrooms * 4))  # 1 BR $16, 2 BR $20, 3 BR $24, etc.

    def get_short_stay_cleaning_fee(self):
        from decimal import Decimal
        if self.short_stay_cleaning_fee is not None and self.short_stay_cleaning_fee != Decimal('75'):
            return self.short_stay_cleaning_fee
        bedrooms = max(1, self.bedrooms or 2)
        fees = {
            1: Decimal('65'),
            2: Decimal('85'),
            3: Decimal('110'),
            4: Decimal('140'),
            5: Decimal('175'),
        }
        if bedrooms in fees:
            return fees[bedrooms]
        return Decimal('175') + Decimal(str(bedrooms - 5)) * Decimal('25')

    def get_short_stay_check_in_time(self):
        """US Airbnb norms: 3 PM for smaller units, 4 PM for 3+ BR (cleaning turnover)."""
        if self.short_stay_check_in_time:
            return self.short_stay_check_in_time
        bedrooms = max(1, self.bedrooms or 2)
        return '4:00 PM' if bedrooms >= 3 else '3:00 PM'

    def get_short_stay_check_out_time(self):
        """US Airbnb norms: 11 AM default; 10 AM for larger homes needing more turnover time."""
        if self.short_stay_check_out_time:
            return self.short_stay_check_out_time
        bedrooms = max(1, self.bedrooms or 2)
        return '10:00 AM' if bedrooms >= 3 else '11:00 AM'

    def get_short_stay_listing_title(self):
        if self.short_stay_listing_title:
            return self.short_stay_listing_title
        beds = max(1, self.bedrooms or 2)
        return f'Cozy {beds}-Bed Retreat · Comfortable Houston Stay'

    def get_short_stay_listing_description(self):
        if self.short_stay_listing_description:
            return self.short_stay_listing_description
        furnishing = (self.furnishing_type or 'furnished').replace('-', ' ').lower()
        return (
            f'A welcoming {furnishing} space designed for rest and relaxation. '
            'Enjoy a clean, quiet environment with everything you need for a comfortable short stay.'
        )

    def get_short_stay_listing_area(self):
        if self.short_stay_listing_area:
            return self.short_stay_listing_area
        return 'Greater Houston'

    def get_short_stay_listing_location(self):
        city = self.city or 'Houston'
        state = self.state or 'TX'
        return f'{self.get_short_stay_listing_area()}, {city}, {state}'


class PropertyUnit(models.Model):
    """Individual rentable unit (door) within a property — e.g. Door 1 in a 4-plex."""
    STATUS_CHOICES = [
        ('occupied', 'Occupied'),
        ('vacant', 'Vacant'),
        ('coming_soon', 'Coming Soon'),
    ]

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='property_units')
    label = models.CharField(max_length=100, help_text='e.g. Door 1, Unit A')
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='vacant')
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        unique_together = [['property', 'label']]

    def __str__(self):
        return f"{self.property.name} — {self.label}"


class PropertyFinancials(models.Model):
    """Admin-only ownership & financing data — hidden from property managers."""
    property = models.OneToOneField(Property, on_delete=models.CASCADE, related_name='financials')
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    down_payment = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    closing_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    loan_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    interest_rate = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    loan_term_years = models.PositiveIntegerField(null=True, blank=True)
    monthly_mortgage_payment = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    land_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    annual_depreciation_years = models.DecimalField(max_digits=5, decimal_places=1, default=27.5)
    escrow_notes = models.CharField(max_length=255, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Financials — {self.property.name}"


class PropertyManagerProfile(models.Model):
    """Links a property manager user to the properties they manage."""
    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='manager_profile',
    )
    properties = models.ManyToManyField(Property, related_name='managers', blank=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Manager — {self.user.email}"


class ShortStayBooking(models.Model):
    STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('proof_submitted', 'Proof Submitted'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='short_stay_bookings')
    guest_name = models.CharField(max_length=255)
    guest_email = models.EmailField()
    guest_phone = models.CharField(max_length=50)
    check_in = models.DateField()
    check_out = models.DateField()
    num_guests = models.PositiveIntegerField(default=1)
    nights = models.PositiveIntegerField()
    nightly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cleaning_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending_payment')
    proof_of_payment_files = models.JSONField(default=list, blank=True)
    guest_id_files = models.JSONField(default=list, blank=True, help_text="Optional guest ID verification uploads")
    notes = models.TextField(blank=True, default='')
    access_pin = models.CharField(
        max_length=10, blank=True, default='',
        help_text='4-digit guest portal PIN emailed on confirmation',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.guest_name} — {self.property.name} ({self.check_in} to {self.check_out})"

    def get_guest_portal_reservation_id(self):
        return f'ss-{self.id}'


class ShortStayBlockedDate(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='short_stay_blocks')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date']

    def __str__(self):
        return f"Blocked {self.property.name}: {self.start_date} to {self.end_date}"