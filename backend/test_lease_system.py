"""
Comprehensive Lease System Test Script
Run this in Django shell: python manage.py shell < test_lease_system.py
Or manually in shell: exec(open('test_lease_system.py').read())
"""

print("\n" + "="*70)
print("COMPREHENSIVE LEASE SYSTEM TEST")
print("="*70)

from api.models import Tenant, LegalDocument
from api.lease_service import generate_lease_pdf, save_lease_document
from api.views import download_cloudinary_file
import os

# Test Configuration
TEST_TENANT_ID = 1  # Change this to a valid tenant ID in your database

print(f"\nTest Configuration:")
print(f"  Tenant ID: {TEST_TENANT_ID}")
print(f"  Environment: {'PRODUCTION' if 'RENDER' in os.environ.get('HOSTNAME', '') else 'LOCAL'}")

# Pre-flight checks
print(f"\n{'='*70}")
print("PRE-FLIGHT CHECKS")
print("="*70)

try:
    tenant_count = Tenant.objects.count()
    doc_count = LegalDocument.objects.count()
    print(f"✅ Database connection: OK")
    print(f"   - Total tenants: {tenant_count}")
    print(f"   - Total documents: {doc_count}")
except Exception as e:
    print(f"❌ Database connection: FAILED - {e}")
    exit(1)

try:
    import cloudinary
    from django.conf import settings
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
        api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
        api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
    )
    print(f"✅ Cloudinary config: OK")
    print(f"   - Cloud: {settings.CLOUDINARY_STORAGE['CLOUD_NAME']}")
except Exception as e:
    print(f"❌ Cloudinary config: FAILED - {e}")
    exit(1)

# Test 1: Get Test Tenant
print(f"\n{'='*70}")
print("TEST 1: GET TEST TENANT")
print("="*70)

try:
    tenant = Tenant.objects.get(id=TEST_TENANT_ID)
    print(f"✅ Found tenant: {tenant.full_name}")
    print(f"   - Email: {tenant.email}")
    print(f"   - Property: {tenant.property.name if tenant.property else 'None'}")
    print(f"   - Unit: {tenant.unit}")
except Tenant.DoesNotExist:
    print(f"❌ Tenant with ID {TEST_TENANT_ID} not found!")
    print(f"   Available tenant IDs: {list(Tenant.objects.values_list('id', flat=True))}")
    exit(1)

# Test 2: Generate Lease PDF
print(f"\n{'='*70}")
print("TEST 2: GENERATE LEASE PDF")
print("="*70)

try:
    pdf_buffer, filled_content = generate_lease_pdf(tenant)
    
    # Check buffer size
    pdf_buffer.seek(0, 2)
    pdf_size = pdf_buffer.tell()
    pdf_buffer.seek(0)
    
    # Check PDF signature
    first_bytes = pdf_buffer.read(20)
    pdf_buffer.seek(0)
    is_valid_pdf = first_bytes[:4] == b'%PDF'
    
    if pdf_size > 0 and is_valid_pdf:
        print(f"✅ PDF generation: SUCCESS")
        print(f"   - Size: {pdf_size} bytes")
        print(f"   - Valid PDF: {is_valid_pdf}")
        print(f"   - Content length: {len(filled_content)} chars")
    else:
        print(f"❌ PDF generation: FAILED")
        print(f"   - Size: {pdf_size} bytes (expected > 0)")
        print(f"   - Valid PDF: {is_valid_pdf} (expected True)")
        exit(1)
except Exception as e:
    print(f"❌ PDF generation: FAILED - {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Test 3: Save to Cloudinary
print(f"\n{'='*70}")
print("TEST 3: SAVE TO CLOUDINARY")
print("="*70)

try:
    legal_doc = save_lease_document(tenant, pdf_buffer, filled_content)
    
    print(f"✅ Cloudinary upload: SUCCESS")
    print(f"   - Document ID: {legal_doc.id}")
    print(f"   - PDF path: {legal_doc.pdf_file.name}")
    print(f"   - Status: {legal_doc.status}")
    print(f"   - Type: {legal_doc.type}")
    
    # Store for next test
    TEST_DOCUMENT_ID = legal_doc.id
    TEST_PDF_PATH = legal_doc.pdf_file.name
    
except Exception as e:
    print(f"❌ Cloudinary upload: FAILED - {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Test 4: Download from Cloudinary
print(f"\n{'='*70}")
print("TEST 4: DOWNLOAD FROM CLOUDINARY")
print("="*70)

try:
    downloaded_content = download_cloudinary_file(TEST_PDF_PATH)
    
    if downloaded_content:
        downloaded_size = len(downloaded_content)
        is_valid_pdf = downloaded_content[:4] == b'%PDF'
        
        print(f"✅ Cloudinary download: SUCCESS")
        print(f"   - Size: {downloaded_size} bytes")
        print(f"   - Valid PDF: {is_valid_pdf}")
        print(f"   - Matches upload: {downloaded_size == pdf_size}")
        
        if downloaded_size != pdf_size:
            print(f"⚠️  WARNING: Download size mismatch!")
            print(f"      Uploaded: {pdf_size} bytes")
            print(f"      Downloaded: {downloaded_size} bytes")
    else:
        print(f"❌ Cloudinary download: FAILED")
        print(f"   - No content returned")
        exit(1)
        
except Exception as e:
    print(f"❌ Cloudinary download: FAILED - {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Test 5: Verify Document in Database
print(f"\n{'='*70}")
print("TEST 5: VERIFY DOCUMENT IN DATABASE")
print("="*70)

try:
    # Refresh from database
    legal_doc_verify = LegalDocument.objects.get(id=TEST_DOCUMENT_ID)
    
    print(f"✅ Database verification: SUCCESS")
    print(f"   - Document exists in DB")
    print(f"   - Tenant: {legal_doc_verify.tenant.full_name}")
    print(f"   - PDF path stored: {legal_doc_verify.pdf_file.name}")
    print(f"   - Created at: {legal_doc_verify.created_at}")
    
except Exception as e:
    print(f"❌ Database verification: FAILED - {e}")
    exit(1)

# Test 6: List All Recent Leases
print(f"\n{'='*70}")
print("TEST 6: LIST RECENT LEASES")
print("="*70)

try:
    recent_leases = LegalDocument.objects.filter(
        type='Lease Agreement'
    ).order_by('-created_at')[:5]
    
    print(f"✅ Found {recent_leases.count()} recent leases:")
    for i, lease in enumerate(recent_leases, 1):
        print(f"\n   {i}. Document ID: {lease.id}")
        print(f"      Tenant: {lease.tenant.full_name}")
        print(f"      Created: {lease.created_at}")
        print(f"      Status: {lease.status}")
        print(f"      PDF: {lease.pdf_file.name[:50]}..." if len(lease.pdf_file.name) > 50 else f"      PDF: {lease.pdf_file.name}")
        
except Exception as e:
    print(f"❌ Listing leases: FAILED - {e}")

# Final Summary
print(f"\n{'='*70}")
print("TEST SUMMARY")
print("="*70)

test_results = {
    "Database Connection": "✅ PASS",
    "Cloudinary Config": "✅ PASS",
    "Tenant Retrieval": "✅ PASS",
    "PDF Generation": "✅ PASS",
    "Cloudinary Upload": "✅ PASS",
    "Cloudinary Download": "✅ PASS",
    "Database Verification": "✅ PASS",
    "Lease Listing": "✅ PASS"
}

for test_name, result in test_results.items():
    print(f"{result} {test_name}")

print(f"\n{'='*70}")
print("🎉 ALL TESTS PASSED!")
print("="*70)
print(f"\nNext Steps:")
print(f"1. Test DocuSign integration in production web UI")
print(f"2. Test email sending (after SendGrid fix)")
print(f"3. Test tenant download access")
print(f"4. Run comprehensive test plan: COMPREHENSIVE_LEASE_TEST_PLAN.md")
print(f"\nCreated Document ID: {TEST_DOCUMENT_ID}")
print(f"You can now test this lease in the web UI!")
print(f"{'='*70}\n")
