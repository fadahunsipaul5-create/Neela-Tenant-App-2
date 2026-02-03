"""
EMERGENCY RECOVERY SCRIPT
Reconnects all data from Cloudinary to a new database after suspension.

This script:
1. Finds all files in Cloudinary
2. Reconnects tenant documents (photo IDs, income, background checks)
3. Reconnects lease PDFs
4. Shows summary of what was recovered

Usage:
    python reconnect_all_data.py
"""

import os
import django
import re
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

import cloudinary
import cloudinary.api
from django.conf import settings
from api.models import Tenant, LegalDocument

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
)

print("\n" + "="*70)
print("  EMERGENCY RECOVERY: RECONNECTING DATA FROM CLOUDINARY")
print("="*70 + "\n")

try:
    # Get all tenants from database
    tenants = {t.id: t for t in Tenant.objects.all()}
    
    if not tenants:
        print("[WARNING] No tenants found in database!")
        print("You need to recreate tenant records first.")
        print("\nEither:")
        print("1. Restore from backup: psql [DATABASE_URL] < backup.sql")
        print("2. Have tenants re-submit applications")
        print("3. Manually create tenant records in Django admin")
        exit(1)
    
    print(f"Found {len(tenants)} tenants in database:")
    for tenant in tenants.values():
        print(f"  - {tenant.name} (ID: {tenant.id})")
    print("\n" + "-"*70 + "\n")
    
    # ==================== RECONNECT TENANT DOCUMENTS ====================
    print("STEP 1: Reconnecting Tenant Documents...")
    print("-"*70)
    
    result = cloudinary.api.resources(
        type='upload',
        resource_type='image',
        prefix='media/applications/',
        max_results=500
    )
    application_files = result.get('resources', [])
    
    doc_count = 0
    for tenant in tenants.values():
        photo_ids = []
        income_docs = []
        background_checks = []
        
        for file in application_files:
            public_id = file.get('public_id', '')
            url = file.get('secure_url', '')
            
            if f'tenant_{tenant.id}' in public_id:
                if 'photo_id' in public_id:
                    photo_ids.append(url)
                elif 'income' in public_id:
                    income_docs.append(url)
                elif 'background' in public_id:
                    background_checks.append(url)
        
        if photo_ids or income_docs or background_checks:
            tenant.photo_id_files = photo_ids
            tenant.income_verification_files = income_docs
            tenant.background_check_files = background_checks
            tenant.save()
            
            total_docs = len(photo_ids) + len(income_docs) + len(background_checks)
            doc_count += total_docs
            print(f"[OK] {tenant.name}: {total_docs} documents reconnected")
    
    print(f"\nTotal documents reconnected: {doc_count}")
    print("-"*70 + "\n")
    
    # ==================== RECONNECT LEASE PDFs ====================
    print("STEP 2: Reconnecting Lease PDFs...")
    print("-"*70)
    
    result = cloudinary.api.resources(
        type='upload',
        resource_type='raw', 
        prefix='media/leases/',
        max_results=500
    )
    lease_files = result.get('resources', [])
    
    lease_count = 0
    skipped_count = 0
    
    for file in lease_files:
        public_id = file.get('public_id', '')
        url = file.get('secure_url', '')
        created_at_str = file.get('created_at', '')
        
        # Extract tenant ID from filename
        match = re.search(r'lease_(\d+)_', public_id)
        
        if match:
            tenant_id = int(match.group(1))
            
            if tenant_id in tenants:
                tenant = tenants[tenant_id]
                
                # Check if already exists
                if not LegalDocument.objects.filter(pdf_file=url).exists():
                    # Parse created_at
                    created_at = None
                    if created_at_str:
                        try:
                            created_at = datetime.strptime(created_at_str, '%Y-%m-%dT%H:%M:%SZ')
                        except:
                            created_at = datetime.now()
                    
                    LegalDocument.objects.create(
                        tenant=tenant,
                        type='Lease Agreement',
                        generated_content=f'Lease agreement for {tenant.name}',
                        status='Signed',
                        pdf_file=url,
                        created_at=created_at or datetime.now()
                    )
                    lease_count += 1
                else:
                    skipped_count += 1
            else:
                skipped_count += 1
    
    print(f"[OK] Leases reconnected: {lease_count}")
    print(f"[SKIP] Already exist or orphaned: {skipped_count}")
    print("-"*70 + "\n")
    
    # ==================== SUMMARY ====================
    print("="*70)
    print("  RECOVERY COMPLETE!")
    print("="*70)
    print("\nRECOVERY SUMMARY:")
    print("-"*70)
    print(f"Tenants processed: {len(tenants)}")
    print(f"Documents reconnected: {doc_count}")
    print(f"Leases reconnected: {lease_count}")
    print("-"*70)
    
    print("\nPER-TENANT SUMMARY:")
    print("-"*70)
    for tenant in Tenant.objects.all():
        docs = (
            len(tenant.photo_id_files or []) +
            len(tenant.income_verification_files or []) +
            len(tenant.background_check_files or [])
        )
        leases = tenant.legal_documents.filter(type='Lease Agreement').count()
        print(f"{tenant.name} (ID: {tenant.id}):")
        print(f"  - Documents: {docs}")
        print(f"  - Leases: {leases}")
    
    print("\n" + "="*70)
    print("[SUCCESS] All data reconnected from Cloudinary!")
    print("="*70)
    print("\nNext steps:")
    print("1. Create lease template: python create_lease_template.py")
    print("2. Verify recovery: python verify_recovery.py")
    print("3. Test your frontend application")
    print("4. Create a backup: python backup_database.py")
    print("\n")
    
except Exception as e:
    print(f"\n[ERROR] Recovery failed: {e}")
    import traceback
    traceback.print_exc()
    print("\nTroubleshooting:")
    print("1. Check DATABASE_URL in .env file")
    print("2. Make sure database exists and is accessible")
    print("3. Verify Cloudinary credentials are correct")
    print("4. Check if tenants exist in database")
    exit(1)
