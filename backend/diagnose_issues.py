"""
Diagnostic script to check for common issues mentioned in the progress report.
Helps identify root causes of bugs.

Usage:
    python diagnose_issues.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

from django.conf import settings
from api.models import Tenant, Payment, LegalDocument
from django.core.mail import send_mail

print("\n" + "="*70)
print("  NEELA CAPITAL - ISSUE DIAGNOSTICS")
print("="*70 + "\n")

issues_found = []
checks_passed = []

# ==================== CHECK 1: Email Configuration ====================
print("1. CHECKING EMAIL CONFIGURATION...")
print("-"*70)

try:
    sendgrid_key = settings.SENDGRID_API_KEY
    if sendgrid_key and len(sendgrid_key) > 10:
        print("[OK] SendGrid API key is configured")
        print(f"    Key length: {len(sendgrid_key)} characters")
        checks_passed.append("Email configured")
        
        # Test email sending
        try:
            print("    Testing email send...")
            result = send_mail(
                'Test Email',
                'This is a test email from Neela diagnostic tool.',
                settings.DEFAULT_FROM_EMAIL,
                [settings.DEFAULT_FROM_EMAIL],
                fail_silently=False,
            )
            if result:
                print("[OK] Test email sent successfully!")
                checks_passed.append("Email sending works")
            else:
                print("[WARN] Email send returned 0 (may have failed)")
                issues_found.append("Email sending may not work - check SendGrid dashboard")
        except Exception as e:
            print(f"[ERROR] Test email failed: {e}")
            issues_found.append(f"Email sending broken: {e}")
    else:
        print("[ERROR] SendGrid API key missing or invalid")
        issues_found.append("SendGrid API key not configured")
except Exception as e:
    print(f"[ERROR] Email configuration error: {e}")
    issues_found.append(f"Email config error: {e}")

print()

# ==================== CHECK 2: Balance Calculation ====================
print("2. CHECKING BALANCE CALCULATIONS...")
print("-"*70)

try:
    tenants = Tenant.objects.all()
    if tenants.exists():
        for tenant in tenants[:5]:  # Check first 5 tenants
            stored_balance = tenant.balance
            calculated_balance = tenant.calculate_balance()
            
            if stored_balance != calculated_balance:
                print(f"[WARN] {tenant.name}: Balance mismatch")
                print(f"      Stored: GHS {stored_balance}")
                print(f"      Calculated: GHS {calculated_balance}")
                issues_found.append(f"Balance mismatch for {tenant.name}")
            else:
                print(f"[OK] {tenant.name}: Balance correct (GHS {stored_balance})")
                
        checks_passed.append("Balance calculation checked")
    else:
        print("[INFO] No tenants to check")
except Exception as e:
    print(f"[ERROR] Balance check failed: {e}")
    issues_found.append(f"Balance calculation error: {e}")

print()

# ==================== CHECK 3: Lease Documents Access ====================
print("3. CHECKING LEASE DOCUMENTS...")
print("-"*70)

try:
    leases = LegalDocument.objects.filter(type='Lease Agreement')
    if leases.exists():
        print(f"[OK] Found {leases.count()} lease documents")
        
        for lease in leases[:3]:  # Check first 3
            if lease.pdf_file:
                # Check if it's a Cloudinary URL
                if 'cloudinary.com' in str(lease.pdf_file):
                    print(f"[OK] Lease for {lease.tenant.name}: Cloudinary URL exists")
                else:
                    print(f"[WARN] Lease for {lease.tenant.name}: Not a Cloudinary URL")
                    issues_found.append(f"Lease PDF not in Cloudinary for {lease.tenant.name}")
            else:
                print(f"[ERROR] Lease for {lease.tenant.name}: No PDF file")
                issues_found.append(f"Missing PDF for {lease.tenant.name}")
                
        checks_passed.append("Lease documents exist")
    else:
        print("[WARN] No lease documents found in database")
        issues_found.append("No lease documents in database")
except Exception as e:
    print(f"[ERROR] Lease check failed: {e}")
    issues_found.append(f"Lease access error: {e}")

print()

# ==================== CHECK 4: Payment Records ====================
print("4. CHECKING PAYMENT RECORDS...")
print("-"*70)

try:
    payments = Payment.objects.all()
    if payments.exists():
        print(f"[OK] Found {payments.count()} payment records")
        
        paid_count = payments.filter(status='Paid').count()
        pending_count = payments.filter(status='Pending').count()
        
        print(f"    Paid: {paid_count}")
        print(f"    Pending: {pending_count}")
        
        checks_passed.append("Payment records exist")
    else:
        print("[INFO] No payment records (expected for new database)")
except Exception as e:
    print(f"[ERROR] Payment check failed: {e}")
    issues_found.append(f"Payment system error: {e}")

print()

# ==================== CHECK 5: Cloudinary Configuration ====================
print("5. CHECKING CLOUDINARY CONFIGURATION...")
print("-"*70)

try:
    cloud_name = settings.CLOUDINARY_STORAGE.get('CLOUD_NAME')
    api_key = settings.CLOUDINARY_STORAGE.get('API_KEY')
    
    if cloud_name and api_key:
        print(f"[OK] Cloudinary configured")
        print(f"    Cloud Name: {cloud_name}")
        print(f"    API Key: {api_key[:10]}...")
        checks_passed.append("Cloudinary configured")
    else:
        print("[ERROR] Cloudinary not properly configured")
        issues_found.append("Cloudinary configuration incomplete")
except Exception as e:
    print(f"[ERROR] Cloudinary check failed: {e}")
    issues_found.append(f"Cloudinary error: {e}")

print()

# ==================== CHECK 6: Database Connection ====================
print("6. CHECKING DATABASE CONNECTION...")
print("-"*70)

try:
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()[0]
        print(f"[OK] Connected to database: {db_name}")
        checks_passed.append("Database connected")
except Exception as e:
    print(f"[ERROR] Database connection failed: {e}")
    issues_found.append(f"Database error: {e}")

print()

# ==================== CHECK 7: Authentication ====================
print("7. CHECKING AUTHENTICATION SETUP...")
print("-"*70)

try:
    jwt_settings = settings.SIMPLE_JWT
    access_lifetime = jwt_settings.get('ACCESS_TOKEN_LIFETIME')
    print(f"[OK] JWT authentication configured")
    print(f"    Access token lifetime: {access_lifetime}")
    checks_passed.append("JWT configured")
except Exception as e:
    print(f"[ERROR] JWT check failed: {e}")
    issues_found.append(f"JWT error: {e}")

print()

# ==================== SUMMARY ====================
print("="*70)
print("  DIAGNOSTIC SUMMARY")
print("="*70 + "\n")

print(f"Checks Passed: {len(checks_passed)}")
print(f"Issues Found: {len(issues_found)}")
print()

if issues_found:
    print("ISSUES THAT NEED FIXING:")
    print("-"*70)
    for i, issue in enumerate(issues_found, 1):
        print(f"{i}. {issue}")
    print()

if checks_passed:
    print("WORKING CORRECTLY:")
    print("-"*70)
    for i, check in enumerate(checks_passed, 1):
        print(f"{i}. {check}")
    print()

# ==================== RECOMMENDATIONS ====================
print("="*70)
print("  RECOMMENDATIONS")
print("="*70 + "\n")

if "Email sending" in str(issues_found):
    print("1. FIX EMAIL SYSTEM:")
    print("   - Verify SendGrid API key in backend/.env")
    print("   - Check SendGrid dashboard for errors")
    print("   - Ensure daily email quota not exceeded")
    print()

if "Balance mismatch" in str(issues_found):
    print("2. FIX BALANCE SYNCHRONIZATION:")
    print("   - Run: python manage.py shell -c \"from api.models import Tenant; [t.update_balance() for t in Tenant.objects.all()]\"")
    print("   - Add balance recalculation to tenant update view")
    print()

if "lease" in str(issues_found).lower():
    print("3. FIX LEASE ACCESS:")
    print("   - Check permissions in LegalDocument viewset")
    print("   - Verify Cloudinary URLs are accessible")
    print("   - Test with: python manage.py shell -c \"from api.models import LegalDocument; print(LegalDocument.objects.first().pdf_file)\"")
    print()

if len(issues_found) == 0:
    print("[SUCCESS] No major issues detected!")
    print("System appears to be functioning correctly.")
    print()
    print("If you're still experiencing issues:")
    print("1. Check browser console for frontend errors")
    print("2. Check backend logs for API errors")
    print("3. Review ISSUES_TO_FIX.md for detailed troubleshooting")
    print()

print("="*70)
print()
