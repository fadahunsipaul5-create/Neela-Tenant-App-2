"""
Verifies that database recovery was successful.
Checks all data and shows current status.

Usage:
    python verify_recovery.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

from api.models import Tenant, Property, LegalDocument, LeaseTemplate, Payment, MaintenanceRequest
from django.db import connection

print("\n" + "="*70)
print("  DATABASE RECOVERY VERIFICATION")
print("="*70 + "\n")

try:
    # Check database connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()[0]
    
    print(f"[OK] Database connected: {db_name}")
    print("-"*70 + "\n")
    
    # Count all resources
    tenant_count = Tenant.objects.count()
    property_count = Property.objects.count()
    lease_template_count = LeaseTemplate.objects.count()
    legal_doc_count = LegalDocument.objects.count()
    payment_count = Payment.objects.count()
    maintenance_count = MaintenanceRequest.objects.count()
    
    print("DATABASE CONTENTS:")
    print("-"*70)
    print(f"Tenants: {tenant_count}")
    print(f"Properties: {property_count}")
    print(f"Lease Templates: {lease_template_count}")
    print(f"Legal Documents: {legal_doc_count}")
    print(f"Payments: {payment_count}")
    print(f"Maintenance Requests: {maintenance_count}")
    print("-"*70 + "\n")
    
    # Check each tenant
    if tenant_count > 0:
        print("TENANT DETAILS:")
        print("-"*70)
        for tenant in Tenant.objects.all():
            photo_ids = len(tenant.photo_id_files or [])
            income_docs = len(tenant.income_verification_files or [])
            background = len(tenant.background_check_files or [])
            total_docs = photo_ids + income_docs + background
            leases = tenant.legal_documents.filter(type='Lease Agreement').count()
            payments = tenant.payments.count()
            
            print(f"\n{tenant.name} (ID: {tenant.id})")
            print(f"  Status: {tenant.status}")
            print(f"  Email: {tenant.email}")
            print(f"  Documents: {total_docs} ({photo_ids} photo IDs, {income_docs} income, {background} background)")
            print(f"  Leases: {leases}")
            print(f"  Payments: {payments}")
        print("-"*70 + "\n")
    
    # Check lease templates
    if lease_template_count > 0:
        print("LEASE TEMPLATES:")
        print("-"*70)
        for template in LeaseTemplate.objects.all():
            status = "Active" if template.is_active else "Inactive"
            print(f"- {template.name} (ID: {template.id}) - {status}")
        print("-"*70 + "\n")
    
    # Verification checks
    print("VERIFICATION CHECKS:")
    print("-"*70)
    
    checks_passed = 0
    checks_total = 5
    
    # Check 1: Database connection
    if db_name:
        print("[PASS] Database connection working")
        checks_passed += 1
    else:
        print("[FAIL] Database connection issue")
    
    # Check 2: At least one tenant
    if tenant_count > 0:
        print("[PASS] Tenants exist in database")
        checks_passed += 1
    else:
        print("[WARN] No tenants found - you may need to restore from backup")
    
    # Check 3: Lease template exists
    if lease_template_count > 0:
        print("[PASS] Lease template exists")
        checks_passed += 1
    else:
        print("[FAIL] No lease template - run create_lease_template.py")
    
    # Check 4: At least one tenant has documents
    tenants_with_docs = 0
    for tenant in Tenant.objects.all():
        total_docs = (
            len(tenant.photo_id_files or []) +
            len(tenant.income_verification_files or []) +
            len(tenant.background_check_files or [])
        )
        if total_docs > 0:
            tenants_with_docs += 1
    
    if tenants_with_docs > 0:
        print(f"[PASS] {tenants_with_docs} tenant(s) have documents")
        checks_passed += 1
    else:
        print("[WARN] No tenant documents found - run reconnect_all_data.py")
    
    # Check 5: Cloudinary configuration
    from django.conf import settings
    if settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
        print("[PASS] Cloudinary configured")
        checks_passed += 1
    else:
        print("[FAIL] Cloudinary not configured")
    
    print("-"*70 + "\n")
    
    # Final status
    print("="*70)
    if checks_passed == checks_total:
        print("  [SUCCESS] RECOVERY COMPLETE - ALL CHECKS PASSED!")
    elif checks_passed >= 3:
        print("  [WARNING] RECOVERY PARTIAL - SOME ISSUES FOUND")
    else:
        print("  [ERROR] RECOVERY INCOMPLETE - PLEASE FIX ISSUES")
    print("="*70)
    print(f"\nChecks passed: {checks_passed}/{checks_total}")
    
    if checks_passed < checks_total:
        print("\nRECOMMENDED ACTIONS:")
        if tenant_count == 0:
            print("- Restore database from backup OR have tenants resubmit applications")
        if lease_template_count == 0:
            print("- Run: python create_lease_template.py")
        if tenants_with_docs == 0 and tenant_count > 0:
            print("- Run: python reconnect_all_data.py")
    else:
        print("\nYour database is fully recovered and ready to use!")
        print("\nNext steps:")
        print("1. Test your frontend application")
        print("2. Create a backup: python backup_database.py")
        print("3. Set up daily health checks: python keep_db_alive.py")
    
    print("\n")
    
except Exception as e:
    print(f"[ERROR] Verification failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
