# Outstanding Issues - Action Plan
**From: NEELA CAPITAL INVESTMENTS Progress Report (27th Jan, 2026)**

---

## Priority Classification

### 🔴 CRITICAL (Fix Immediately)
Issues that break core functionality or prevent users from completing essential tasks.

### 🟡 HIGH (Fix Soon)
Important features that are broken but have workarounds.

### 🟢 MEDIUM (Fix When Possible)
Nice-to-have features or minor issues.

---

## FRONTEND ISSUES

### 🔴 CRITICAL - Admin Dashboard Issues

#### 1. Adjust Card Popup - No Close Button
**Location**: Admin Dashboard → Overview Section → Rents & Payments  
**Problem**: Popup cannot be closed without refresh  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `components/Payments.tsx` or `components/PaymentsView.tsx`
- Look for modal/popup component

**Fix needed**:
```typescript
// Add close button to modal
<button onClick={() => setShowAdjustCard(false)}>
  Close / X
</button>
```

---

#### 2. Tenant Notifications - Zero Balance Display
**Location**: Tenant Dashboard → Notifications  
**Problem**: Payment notifications show even when balance is GHS 0.00  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `components/DashboardView.tsx` (tenant view)
- Check notification rendering logic

**Fix needed**:
```typescript
// Only show payment notifications if balance > 0
{tenant.balance > 0 && (
  <div>Payment notification...</div>
)}

// Make "Make Payment" button disabled when balance is 0
<button disabled={tenant.balance <= 0}>
  Make Payment
</button>
```

---

## BACKEND ISSUES

### 🔴 CRITICAL - Data Synchronization Issues

#### 3. Balance Synchronization - Edit Modal Outdated
**Location**: Backend API / Frontend Modal  
**Problem**: Edit Tenant modal shows outdated balance  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `backend/api/views.py` (Tenant viewset)
- `backend/api/models.py` (Tenant model - `calculate_balance()`)
- `components/TenantsView.tsx` (Edit modal)

**Investigation needed**:
1. Check if `calculate_balance()` is called before returning tenant data
2. Check if frontend is caching old tenant data
3. Verify API response includes updated balance

**Fix needed**:
```python
# In backend/api/views.py or serializers.py
def retrieve(self, request, *args, **kwargs):
    instance = self.get_object()
    instance.update_balance()  # Ensure balance is fresh
    serializer = self.get_serializer(instance)
    return Response(serializer.data)
```

---

#### 4. Rent and Deposit Mismatch
**Location**: Backend API - Tenant Update  
**Problem**: Editing rent/deposit shows different values after refresh  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `backend/api/views.py` (Tenant update endpoint)
- `backend/api/serializers.py`
- `services/api.ts` (`updateTenant` function)

**Investigation needed**:
1. Check if frontend sends correct data
2. Check if backend saves correct values
3. Look for any calculation that modifies rent/deposit on save

**Debug steps**:
```python
# Add logging to tenant update view
import logging
logger = logging.getLogger(__name__)

def update(self, request, *args, **kwargs):
    logger.info(f"Received data: {request.data}")
    response = super().update(request, *args, **kwargs)
    logger.info(f"Saved data: {self.get_object().__dict__}")
    return response
```

---

### 🔴 CRITICAL - Payment & Invoice Features

#### 5. Adjust Payment Not Working
**Location**: Admin Dashboard → Rent & Payments → Adjust Payment  
**Problem**: Apply credit/charge buttons don't work  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `components/PaymentsView.tsx` or `components/Payments.tsx`
- `backend/api/views.py` (Check if there's an adjust payment endpoint)
- `services/api.ts` (Check API calls)

**Investigation needed**:
1. Check if API endpoint exists for adjusting payments
2. Check if frontend is calling the correct endpoint
3. Check browser console for errors

**Likely missing**: API endpoint for payment adjustments

---

#### 6. Invoice Emails Not Sent
**Location**: Admin Dashboard → Rent & Payments → Create Invoice  
**Problem**: Success popup shows but email not sent  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `backend/api/views.py` (Invoice creation view)
- `backend/api/email_service.py` or email sending code
- Email configuration in `backend/neela_backend/settings.py`

**Investigation needed**:
1. Check Django logs for email sending errors
2. Verify SendGrid API key is valid
3. Check if email task is queued but not processed

**Debug steps**:
```bash
# Check backend logs when creating invoice
cd backend
python manage.py runserver
# Then create invoice and watch console
```

---

#### 7. Send Email to Resident Not Working
**Location**: Admin Dashboard → Transactions → Send Email to Resident  
**Problem**: Success popup but no email delivered  
**Status**: ❌ NOT FIXED  

**Same as issue #6** - Email configuration problem

---

#### 8. Send Notice to Resident Not Working
**Location**: Admin Dashboard → Tenants & Leases → Send Notice  
**Problem**: Success popup but email not received  
**Status**: ❌ NOT FIXED  

**Same as issues #6 and #7** - Email configuration problem

**Root cause likely**: 
- SendGrid API key invalid or quota exceeded
- Email service not properly configured
- Celery worker not running for async email tasks

**Fix needed**:
```bash
# Check SendGrid API key
# In backend/.env
SENDGRID_API_KEY=your_valid_key_here

# Test email sending
cd backend
python manage.py shell -c "from django.core.mail import send_mail; send_mail('Test', 'Test', 'from@example.com', ['to@example.com'])"

# Check if Celery is running (if using background tasks)
celery -A neela_backend worker -l info
```

---

### 🟢 MEDIUM - Document Center

#### 9. Document Center Shows "Coming Soon"
**Location**: Admin Dashboard → Document Center  
**Problem**: Feature not implemented  
**Status**: ❌ NOT IMPLEMENTED  

**Question**: Is this feature planned or should it be removed?

**Action needed**: Clarify requirements
- If planned: Create implementation plan
- If not: Remove from UI to avoid confusion

---

## TENANT DASHBOARD ISSUES

### 🔴 CRITICAL - Lease Access Issues

#### 10. View Lease - Connection Error
**Location**: Tenant Dashboard → Overview → Lease Status → View Lease  
**Problem**: Connection error when viewing lease  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `components/PublicPortal.tsx` or tenant dashboard component
- `services/api.ts` (`getLegalDocuments` or similar)
- Backend endpoint for lease retrieval

**Investigation needed**:
1. Check browser console for specific error
2. Check if API endpoint exists and is accessible
3. Verify tenant authentication

**Fix needed**:
```typescript
// Check the lease viewing code
const viewLease = async () => {
  try {
    const response = await api.getLegalDocuments(tenantId);
    // Open PDF
  } catch (error) {
    console.error("Lease error:", error);
    // Show proper error message
  }
}
```

---

#### 11. Lease Agreement - HTTP 401 Unauthorized
**Location**: Tenant Dashboard → Documents → Lease Agreement  
**Problem**: 401 error when accessing lease  
**Status**: ❌ NOT FIXED  

**Files to check**:
- `backend/api/views.py` (LegalDocument viewset)
- Check permissions and authentication

**Investigation needed**:
1. Check if tenant authentication is working
2. Verify tenant has permission to view their own lease
3. Check if JWT token is valid

**Fix needed**:
```python
# In backend/api/views.py
class LegalDocumentViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # Ensure tenant can only see their own documents
        if self.request.user.is_staff:
            return LegalDocument.objects.all()
        return LegalDocument.objects.filter(
            tenant__email=self.request.user.email
        )
```

---

### 🟡 HIGH - Auto-Pay Feature

#### 12. Configure Auto-Pay Button Not Responding
**Location**: Tenant Dashboard → Payments → Auto-Pay Configuration  
**Problem**: Button doesn't respond when clicked  
**Status**: ❌ NOT FIXED  

**Files to check**:
- Tenant payments component
- Check for click handler

**Fix needed**:
```typescript
// Add or fix click handler
const handleConfigureAutoPay = () => {
  // Open auto-pay configuration modal
  setShowAutoPayModal(true);
};

<button onClick={handleConfigureAutoPay}>
  Configure Auto-Pay
</button>
```

---

## SUMMARY OF WORK NEEDED

### Immediate Actions Required

1. **Fix Email System** (Issues #6, #7, #8)
   - Verify SendGrid configuration
   - Test email sending
   - Fix email delivery

2. **Fix Balance Synchronization** (Issue #3)
   - Ensure `update_balance()` is called consistently
   - Add balance refresh after payments

3. **Fix Lease Access** (Issues #10, #11)
   - Fix authentication for tenant lease viewing
   - Add proper error handling

4. **Fix Modal Close Button** (Issue #1)
   - Add close button to Adjust Card popup

5. **Fix Payment Adjustment** (Issue #5)
   - Implement or fix adjust payment endpoint

### Investigation Required

- **Issue #4** (Rent/Deposit mismatch): Need to trace the data flow
- **Issue #9** (Document Center): Clarify if feature is needed

### Quick Wins (Easy Fixes)

- Issue #1: Add close button (5 minutes)
- Issue #2: Conditional notification display (10 minutes)
- Issue #12: Fix button click handler (5 minutes)

---

## TESTING CHECKLIST

After fixes, test:

- [ ] Adjust Card popup opens and closes properly
- [ ] No payment notifications when balance is 0
- [ ] Edit tenant shows correct balance
- [ ] Rent/deposit values persist after save
- [ ] Payment adjustments work
- [ ] Invoice emails are received
- [ ] Transaction emails are received
- [ ] Notice emails are received
- [ ] Tenants can view their leases
- [ ] Auto-pay button responds
- [ ] Lease documents are accessible

---

## FILES THAT LIKELY NEED CHANGES

### Frontend
- `components/PaymentsView.tsx`
- `components/Payments.tsx`
- `components/TenantsView.tsx`
- `components/DashboardView.tsx`
- `components/PublicPortal.tsx`
- `services/api.ts`

### Backend
- `backend/api/views.py`
- `backend/api/serializers.py`
- `backend/api/email_service.py`
- `backend/neela_backend/settings.py`

---

## ESTIMATED TIME TO FIX ALL ISSUES

- Frontend issues: 4-6 hours
- Backend issues: 8-12 hours
- Testing: 4 hours
- **Total: 2-3 days of focused work**

---

## PRIORITY ORDER

1. Fix email system (affects multiple features)
2. Fix balance synchronization
3. Fix lease access for tenants
4. Fix payment adjustment
5. Fix UI issues (modals, buttons)
6. Fix auto-pay button
7. Decide on Document Center
