"""
Creates default lease template in database.
Run this after database recovery to enable lease generation.

Usage:
    python create_lease_template.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

from api.models import LeaseTemplate

print("\n" + "="*70)
print("  CREATING DEFAULT LEASE TEMPLATE")
print("="*70 + "\n")

try:
    # Check if template already exists
    if LeaseTemplate.objects.filter(name="Standard Residential Lease").exists():
        print("[INFO] Template 'Standard Residential Lease' already exists!")
        template = LeaseTemplate.objects.get(name="Standard Residential Lease")
        print(f"Template ID: {template.id}")
        print(f"Status: {'Active' if template.is_active else 'Inactive'}")
    else:
        # Create new template
        template = LeaseTemplate.objects.create(
            name="Standard Residential Lease",
            is_active=True,
            content="""RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into between:

LANDLORD: {{landlord_name}}
Email: {{landlord_email}}

TENANT: {{tenant_name}}
Email: {{tenant_email}}
Phone: {{tenant_phone}}

PROPERTY ADDRESS: {{property_unit}}

LEASE TERMS:
- Lease Start Date: {{lease_start}}
- Lease End Date: {{lease_end}}
- Monthly Rent: ${{rent_amount}}
- Security Deposit: ${{deposit}}

PAYMENT TERMS:
Rent is due on the 1st of each month. Late payments will incur fees as per local regulations.

TENANT RESPONSIBILITIES:
- Maintain the property in good condition
- Pay rent and utilities on time
- Follow all building rules and regulations
- Provide notice before vacating

LANDLORD RESPONSIBILITIES:
- Maintain property in habitable condition
- Make necessary repairs in a timely manner
- Respect tenant's right to quiet enjoyment

This agreement is governed by the laws of the applicable jurisdiction.

SIGNATURES:

_________________________        Date: __________
Landlord Signature

_________________________        Date: __________
Tenant Signature
"""
        )
        print("[SUCCESS] Created new lease template!")
        print(f"Template Name: {template.name}")
        print(f"Template ID: {template.id}")
    
    print("\n" + "="*70)
    print("[OK] Lease template is ready!")
    print("="*70)
    print("\nYou can now generate leases in your application.")
    print("\n")
    
except Exception as e:
    print(f"[ERROR] Failed to create template: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
