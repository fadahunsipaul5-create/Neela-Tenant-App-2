# Cloudinary Upload Debugging Guide

## 🔍 PROBLEM: PDFs Not Uploading to Cloudinary

### Symptoms
- Lease generation succeeds (database record created)
- But file doesn't exist in Cloudinary (404 errors)
- DocuSign sending fails (can't find file)

---

## ✅ FIXES APPLIED

### Fix 1: Better Error Logging
**File:** `backend/api/lease_service.py`

**Changed:**
- Line 360-364: Changed `print()` to `logger.error()`
- Added full traceback logging
- Added fallback error handling
- Added success path logging

**Before:**
```python
except Exception as e:
    print(f"Cloudinary raw upload failed...")  # Not in logs!
```

**After:**
```python
except Exception as e:
    logger.error(f"Cloudinary raw upload failed: {e}")
    logger.error(traceback.format_exc())  # Full error details
```

### Fix 2: Detailed Upload Logging
**Added logging for:**
- Buffer size before upload
- Upload result details (public_id, secure_url, format)
- Saved file path

**Now shows:**
```
INFO Uploading lease PDF to Cloudinary with public_id: media/leases/lease_1_...
INFO Buffer size: 12345 bytes
INFO Cloudinary upload successful!
INFO Result public_id: media/leases/lease_1_...
INFO Result secure_url: https://res.cloudinary.com/...
INFO Saved legal_doc.pdf_file.name: media/leases/lease_1_...
```

---

## 🧪 NEXT STEPS: Test Again

### Step 1: Generate New Lease
1. Go to your app → Lease Generation
2. Select tenant
3. Click "Generate Lease PDF"

### Step 2: Check Backend Logs
Look for one of these scenarios:

#### Scenario A: Upload Success ✅
```
INFO Uploading lease PDF to Cloudinary with public_id: media/leases/lease_X_...
INFO Buffer size: XXXXX bytes
INFO Cloudinary upload successful!
INFO Result public_id: media/leases/lease_X_...
INFO Result secure_url: https://res.cloudinary.com/du97pcuvh/raw/upload/...
INFO Saved legal_doc.pdf_file.name: media/leases/lease_X_...
```
**If you see this:** Upload worked! File is in Cloudinary.

---

#### Scenario B: Upload Failed (Cloudinary Error) ❌
```
INFO Uploading lease PDF to Cloudinary with public_id: media/leases/lease_X_...
ERROR Cloudinary raw upload failed: [error details]
ERROR Traceback (most recent call last):
  [full error stack]
ERROR Fallback save also failed: [error]
```

**Common Cloudinary errors:**
1. **"Invalid API key"** → Check credentials in .env
2. **"Upload preset required"** → Not configured correctly
3. **"Resource limit exceeded"** → Out of Cloudinary storage
4. **"Unauthorized"** → API secret wrong
5. **Connection timeout** → Network issue

---

#### Scenario C: Fallback Used ⚠️
```
INFO Uploading lease PDF to Cloudinary with public_id: media/leases/lease_X_...
ERROR Cloudinary raw upload failed: [error]
INFO Fallback save completed: media/leases/lease_X_...
```
**If you see this:** Cloudinary upload failed, but fallback worked. However, fallback might not work with Cloudinary storage backend.

---

## 🔧 TROUBLESHOOTING STEPS

### Check 1: Verify Cloudinary Credentials
```bash
cd backend
.\env\Scripts\python manage.py shell

# In Python shell:
from django.conf import settings
print(f"Cloud Name: {settings.CLOUDINARY_STORAGE['CLOUD_NAME']}")
print(f"API Key: {settings.CLOUDINARY_STORAGE['API_KEY']}")
print(f"API Secret (length): {len(settings.CLOUDINARY_STORAGE['API_SECRET'])}")

# Test connection:
import cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
)

# Try upload:
import cloudinary.uploader
result = cloudinary.uploader.upload(
    "https://via.placeholder.com/150",
    public_id="test_upload",
    resource_type="image"
)
print(f"Test upload successful: {result}")
```

**Expected:** Should print result with secure_url

---

### Check 2: Cloudinary Dashboard
1. Go to https://cloudinary.com/console
2. Check **Media Library**
3. Look for recent uploads
4. Check storage usage (might be at limit)

---

### Check 3: Network/Firewall
**If on Render (production):**
- Render might block Cloudinary uploads
- Check Render logs for network errors
- Try uploading from local environment first

---

## 📊 POSSIBLE ROOT CAUSES

### 1. Cloudinary Free Tier Exceeded
**Symptoms:**
- Uploads were working, now failing
- Error: "Resource limit exceeded"

**Solution:**
- Check Cloudinary dashboard for usage
- Upgrade plan or delete old files
- Free tier: 25GB storage, 25GB bandwidth/month

---

### 2. Invalid Credentials
**Symptoms:**
- Error: "Invalid API key" or "Unauthorized"
- Never worked

**Solution:**
- Verify credentials in `.env`
- Get new credentials from Cloudinary dashboard
- Check for typos or extra spaces

---

### 3. Network/Firewall Block
**Symptoms:**
- Connection timeout
- Works locally, fails on Render

**Solution:**
- Check Render firewall settings
- Try different Cloudinary endpoint
- Contact Render support

---

### 4. Buffer Position Issue
**Symptoms:**
- Upload succeeds but file is 0 bytes
- Error: "File is empty"

**Solution:**
- Already fixed with `pdf_buffer.seek(0)`
- Check "Buffer size" in logs (should be > 0)

---

### 5. Wrong Public ID Format
**Symptoms:**
- Upload succeeds
- But file not found when downloading

**Solution:**
- Already handled (removes .pdf extension)
- Check saved public_id matches uploaded public_id

---

## 🎯 EXPECTED BEHAVIOR AFTER FIX

### When Generating Lease:
1. PDF generated ✅
2. Upload to Cloudinary attempted
3. **If successful:**
   - Logs show "Cloudinary upload successful!"
   - File appears in Cloudinary Media Library
   - secure_url logged
4. **If failed:**
   - Logs show detailed error message
   - Fallback attempted
   - Error visible in logs (not hidden)

### When Sending via DocuSign:
1. Download from Cloudinary attempted
2. **If file exists:**
   - Download succeeds
   - DocuSign envelope created
3. **If file missing:**
   - Clear error: "Resource not found"
   - Error indicates exact public_id tried

---

## 📝 WHAT TO REPORT BACK

After testing, please report:

1. **What logs show:** Copy the upload section from logs
2. **Cloudinary dashboard:** Does file appear in Media Library?
3. **Any errors:** Full error message and traceback
4. **Buffer size:** What size was logged?
5. **Result URL:** What secure_url was returned (if any)?

---

## 🚀 DEPLOYMENT

To deploy these logging improvements:

```bash
git add backend/api/lease_service.py
git commit -m "Improve Cloudinary upload error logging and debugging"
git push origin main
```

Render will auto-deploy.

---

## 📞 COMMON FIXES

### Fix A: Refresh Cloudinary Config
```python
# In backend/api/lease_service.py, before upload:
cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
)
```
*Already in code at line 314-318*

### Fix B: Use Different Upload Method
```python
# Alternative: Use Cloudinary's secure upload
upload_result = cloudinary.uploader.upload(
    pdf_buffer,
    resource_type="raw",
    public_id=public_id,
    type="authenticated",  # Instead of "upload"
    secure=True,
)
```

### Fix C: Manual Upload Test
```bash
# Test Cloudinary manually
curl -X POST https://api.cloudinary.com/v1_1/du97pcuvh/raw/upload \
  -F "file=@test.pdf" \
  -F "public_id=test/manual_upload" \
  -F "api_key=YOUR_API_KEY" \
  -F "timestamp=TIMESTAMP" \
  -F "signature=SIGNATURE"
```

---

## ✅ SUCCESS CRITERIA

Upload is working when:
- ✅ Logs show "Cloudinary upload successful!"
- ✅ secure_url is returned
- ✅ File appears in Cloudinary Media Library
- ✅ DocuSign can download and send file
- ✅ No 404 errors when accessing file

---

**Next:** Generate a new lease and check the logs for detailed upload information.
