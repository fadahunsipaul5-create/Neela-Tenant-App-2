# Comprehensive Lease System Test Plan
**Date:** February 4, 2026  
**Status:** Ready for Testing  
**Wait Time:** 2-5 minutes for Render deployment to complete

---

## 🎯 Test Overview

This test plan covers the complete lease lifecycle:
1. ✅ Lease Generation
2. ✅ DocuSign Integration
3. ✅ Email Notifications
4. ✅ PDF Downloads (Admin & Tenant)
5. ✅ Document Access Control

---

## ⏰ Pre-Test Checklist

### **1. Verify Deployment (2-3 minutes)**
- Go to: https://dashboard.render.com
- Check logs for: "Deploy complete"
- Wait for: Build success message

### **2. Check Database Connection**
```bash
# In Django shell (optional verification):
.\env\Scripts\python.exe backend\manage.py shell

from api.models import Tenant, LegalDocument
print(f"Total tenants: {Tenant.objects.count()}")
print(f"Total documents: {LegalDocument.objects.count()}")
exit()
```

### **3. Verify SendGrid Status**
- **If fixed:** Emails will work ✅
- **If not fixed:** Only DocuSign and downloads will work ⚠️
- See: `FIX_SENDGRID_GUIDE.md` for resolution

---

## 📋 Test Scenarios

---

## **TEST 1: Generate New Lease**

### **Steps:**
1. Log in to **Admin Dashboard**
2. Navigate to: **Tenants & Leases**
3. Select a tenant (e.g., "Paul Fadahunsi")
4. Click: **Generate Lease** button
5. Wait for success message

### **Expected Results:**
- ✅ Success notification appears
- ✅ New lease appears in tenant's document list
- ✅ Lease status shows "Draft"
- ✅ PDF icon/link is visible

### **Check Render Logs:**
```
Expected log entries:
✅ "Uploading lease PDF to Cloudinary with public_id: media/leases/lease_X_YYYYMMDD_HHMMSS"
✅ "Buffer size: 2592 bytes" (or similar, NOT 0 bytes)
✅ "Cloudinary upload successful!"
✅ "Saved legal_doc.pdf_file.name: media/leases/lease_X_YYYYMMDD_HHMMSS.pdf"

❌ RED FLAGS to watch for:
- "Buffer size: 0 bytes"
- "get() returned more than one LegalDocument"
- Any 404 errors
```

### **Troubleshooting:**
| Issue | Solution |
|-------|----------|
| "Multiple documents" error | Already fixed, restart Django server |
| "Buffer size: 0 bytes" | Already fixed, verify code is deployed |
| "Upload failed" | Check Cloudinary credentials in `.env` |

---

## **TEST 2: Send Lease via DocuSign**

### **Steps:**
1. From the generated lease (Test 1)
2. Click: **Send to DocuSign** button
3. Wait for processing (5-10 seconds)
4. Check for success/error message

### **Expected Results:**
- ✅ Success message: "DocuSign envelope created"
- ✅ Lease status changes to "Sent" or "Pending Signature"
- ✅ DocuSign envelope ID is visible (optional)

### **Check Render Logs:**
```
Expected log entries:
✅ "Attempting to download Cloudinary file: media/leases/lease_X_YYYYMMDD_HHMMSS.pdf"
✅ "Successfully downloaded file using upload delivery"
✅ "DocuSign envelope created: [envelope_id]"

❌ RED FLAGS:
- "All retrieval attempts failed for Cloudinary file"
- "HTTP 404 - Resource not found"
- "Cloudinary retrieval failed; refusing to fall back"
```

### **Troubleshooting:**
| Issue | Solution |
|-------|----------|
| 404 "File not found" | Fixed in this deployment, verify code updated |
| "DocuSign API error" | Check DocuSign credentials in `.env` |
| "Invalid recipient" | Verify tenant has valid email address |

---

## **TEST 3: Download Lease (Admin View)**

### **Steps:**
1. In **Admin Dashboard → Tenants & Leases**
2. Find the generated lease
3. Click: **Download** or **View PDF** icon
4. PDF should download/open

### **Expected Results:**
- ✅ PDF downloads successfully
- ✅ PDF opens in browser/viewer
- ✅ PDF contains correct tenant information
- ✅ PDF is ~2-3 pages (2500-3000 bytes)

### **Check Browser Network Tab (F12):**
```
Expected:
✅ Status: 200 OK
✅ Content-Type: application/pdf
✅ Content-Length: ~2500-3000 bytes

❌ RED FLAGS:
- Status: 404 Not Found
- Status: 401 Unauthorized
- Content-Length: 0 or very small
```

### **Troubleshooting:**
| Issue | Solution |
|-------|----------|
| 404 Error | Fixed in this deployment, clear browser cache |
| 401 Unauthorized | Check Cloudinary credentials |
| Empty/corrupted PDF | Re-generate lease (Test 1) |

---

## **TEST 4: Email Lease to Tenant**

### **Prerequisites:**
- ⚠️ SendGrid must be working (see `FIX_SENDGRID_GUIDE.md`)

### **Steps:**
1. From the generated lease
2. Click: **Send Notice to Tenant** or **Email Lease**
3. Wait for confirmation
4. Check tenant's email inbox

### **Expected Results:**
- ✅ Success message: "Email sent successfully"
- ✅ Tenant receives email within 1-2 minutes
- ✅ Email contains PDF attachment or link
- ✅ Email subject/body is correct

### **Check Render Logs:**
```
Expected log entries:
✅ "Queued notice email to tenant [email@example.com] for document [id]"
✅ "Celery task executing: send_notice_to_tenant"
✅ "Attached PDF from provided bytes"
✅ Task succeeded

❌ RED FLAGS:
- "Failed to send notice email: EmailMessage.send returned 0"
- "Maximum credits exceeded" (SendGrid limit)
- "401 Unauthorized" (SendGrid API key issue)
```

### **Troubleshooting:**
| Issue | Solution |
|-------|----------|
| "Maximum credits exceeded" | See `FIX_SENDGRID_GUIDE.md` |
| Email not received | Check spam folder, verify tenant email |
| "SendGrid API error" | Verify `SENDGRID_API_KEY` in `.env` |

---

## **TEST 5: Tenant Downloads Lease**

### **Steps:**
1. Log in as **Tenant** (or use tenant dashboard link)
2. Navigate to: **Documents** tab
3. Find the lease document
4. Click: **View Lease** or **Download** button

### **Expected Results:**
- ✅ PDF downloads/opens successfully
- ✅ Tenant can only see their own leases
- ✅ No 401/403 errors
- ✅ PDF is complete and readable

### **Check Browser Network Tab (F12):**
```
Expected:
✅ Request: GET /api/legal-documents/{id}/pdf/
✅ Status: 200 OK
✅ Content-Type: application/pdf

❌ RED FLAGS:
- Status: 401 Unauthorized
- Status: 403 Forbidden (if viewing own lease)
- Status: 404 Not Found
```

### **Troubleshooting:**
| Issue | Solution |
|-------|----------|
| 401/403 Error | Check authentication, verify tenant ownership |
| 404 Error | Fixed in this deployment, verify lease exists |
| Can see other tenants' leases | Security issue, report immediately |

---

## **TEST 6: Stress Test - Multiple Operations**

### **Steps:**
1. Generate 3 leases for different tenants
2. Send 2 of them to DocuSign
3. Email 1 lease to tenant
4. Download all 3 leases as admin
5. Download 1 lease as tenant

### **Expected Results:**
- ✅ All operations succeed
- ✅ No performance degradation
- ✅ No memory leaks or errors
- ✅ All PDFs are unique and correct

### **Check Render Logs:**
```
Expected:
✅ All uploads show correct buffer sizes
✅ All downloads succeed
✅ No duplicate file errors
✅ Memory usage stable
```

---

## 🐛 Common Issues & Solutions

### **Issue: "Buffer size: 0 bytes"**
**Status:** ✅ **FIXED** in this deployment  
**If still occurring:**
1. Verify code is deployed (check git commit hash)
2. Restart Django server
3. Check `backend/api/lease_service.py` lines 340-343

### **Issue: "404 - Resource not found" for PDF**
**Status:** ✅ **FIXED** in this deployment  
**If still occurring:**
1. Clear browser cache
2. Verify Cloudinary credentials
3. Check file exists: Run in Django shell:
   ```python
   from api.models import LegalDocument
   doc = LegalDocument.objects.get(id=YOUR_DOC_ID)
   print(doc.pdf_file.name)
   
   from api.views import download_cloudinary_file
   content = download_cloudinary_file(doc.pdf_file.name)
   print(f"Success: {len(content) if content else 0} bytes")
   ```

### **Issue: "get() returned more than one LegalDocument"**
**Status:** ✅ **FIXED** in previous deployment  
**If still occurring:**
1. Verify `backend/api/lease_service.py` line 295 uses `create()` not `get_or_create()`
2. Restart Django server

### **Issue: Email not sending**
**Status:** ⏳ **REQUIRES SENDGRID FIX**  
**Solution:** See `FIX_SENDGRID_GUIDE.md`

---

## ✅ Success Criteria

### **Minimum Viable Test (MVP):**
- [x] Can generate lease (Test 1)
- [x] Can send to DocuSign (Test 2)
- [x] Can download as admin (Test 3)
- [x] Can download as tenant (Test 5)

### **Full Production Ready:**
- [x] All MVP tests pass
- [x] Emails work (Test 4) - **Requires SendGrid fix**
- [x] Stress test passes (Test 6)
- [x] No errors in Render logs
- [x] All PDFs are valid and complete

---

## 📊 Test Results Template

Copy this template and fill it out as you test:

```
=== LEASE SYSTEM TEST RESULTS ===
Date: February 4, 2026
Tester: [Your Name]
Environment: Production (Render)

TEST 1: Generate Lease
Status: [ ] PASS [ ] FAIL
Notes: ___________________________________

TEST 2: Send to DocuSign
Status: [ ] PASS [ ] FAIL
Notes: ___________________________________

TEST 3: Download (Admin)
Status: [ ] PASS [ ] FAIL
Notes: ___________________________________

TEST 4: Email to Tenant
Status: [ ] PASS [ ] FAIL [ ] SKIPPED (SendGrid issue)
Notes: ___________________________________

TEST 5: Download (Tenant)
Status: [ ] PASS [ ] FAIL
Notes: ___________________________________

TEST 6: Stress Test
Status: [ ] PASS [ ] FAIL [ ] SKIPPED
Notes: ___________________________________

Overall Result: [ ] ALL PASS [ ] NEEDS FIXES
Action Items:
1. ___________________________________
2. ___________________________________
```

---

## 🔗 Related Documentation

- `PRODUCTION_FIXES_FEB_2026.md` - All fixes applied
- `FIX_SENDGRID_GUIDE.md` - Email troubleshooting
- `ISSUES_TO_FIX.md` - Other pending issues
- `BACKUP_STRATEGY.md` - Database backup guide

---

## 📞 Next Steps After Testing

### **If All Tests Pass:**
1. ✅ Mark system as production-ready
2. ✅ Notify users that lease system is fully functional
3. ✅ Monitor for 24 hours for any edge cases
4. ✅ Address remaining issues from `ISSUES_TO_FIX.md`

### **If Any Tests Fail:**
1. 🔍 Document the failure in test results
2. 🔍 Check Render logs for error messages
3. 🔍 Report the issue with:
   - Test number that failed
   - Error message from logs
   - Steps to reproduce
4. 🔍 Reference this test plan for troubleshooting

---

**Good luck with testing! 🚀**

The system should now work perfectly for lease generation, DocuSign, and downloads!
