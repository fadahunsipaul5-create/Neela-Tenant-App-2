# How to Fix SendGrid "Maximum Credits Exceeded" Error

## The Problem

Your SendGrid account shows:
```
Error 401 (Unauthorized): Maximum credits exceeded
```

This means you've hit your SendGrid plan limits.

---

## SendGrid Free Tier Limits

- **100 emails per day**
- **Limited to 30 days** (then requires verification)
- Resets daily at midnight UTC

---

## Solutions (Choose One)

### Option 1: Upgrade SendGrid Plan (Recommended)

**Best for production apps**

1. Go to https://app.sendgrid.com/
2. Click **"Settings"** → **"Plan & Billing"**
3. Upgrade to **Essentials Plan** ($19.95/month):
   - 40,000 emails/month
   - No daily limits
   - Better deliverability
   - Email support

**After upgrading:**
- No code changes needed
- Current API key continues to work
- Emails will start sending immediately

---

### Option 2: Wait for Daily Reset

**If you're just testing**

- Limit resets at **midnight UTC**
- Calculate your local time:
  - Pacific: 4:00 PM
  - Eastern: 7:00 PM
  - Central: 6:00 PM

**Temporary fix:**
```bash
# Test if it's working again
cd backend
.\env\Scripts\python diagnose_issues.py
```

---

### Option 3: Create New SendGrid Account

**Quick workaround (not recommended for production)**

1. Go to https://signup.sendgrid.com/
2. Sign up with a **different email address**
3. Verify email
4. Get new API key:
   - Go to **Settings** → **API Keys**
   - Click **Create API Key**
   - Name it "Neela Tenant App"
   - Select **Full Access**
   - Click **Create & View**
   - **COPY THE KEY** (you can't see it again!)

5. Update your `.env` file:

```bash
# In backend/.env
SENDGRID_API_KEY=SG.new_key_here...
```

6. Restart your backend:
```bash
cd backend
# Stop current server (Ctrl+C)
python manage.py runserver
```

7. Test email sending:
```bash
cd backend
.\env\Scripts\python diagnose_issues.py
```

---

### Option 4: Switch to Alternative Email Service

**If SendGrid is too expensive**

#### A. Mailgun (Alternative)
- **Free tier**: 5,000 emails/month
- **Cost**: $35/month for 50k emails
- Better free tier than SendGrid

#### B. AWS SES (Cheapest for high volume)
- **Free tier**: 62,000 emails/month (if on EC2)
- **Cost**: $0.10 per 1,000 emails after free tier
- Requires AWS account setup

#### C. Brevo (formerly Sendinblue)
- **Free tier**: 300 emails/day
- **Cost**: $25/month for unlimited
- Easy to set up

---

## How to Update to Different Email Service

### If switching to Mailgun:

1. Sign up at https://www.mailgun.com/
2. Get API key from dashboard
3. Update `backend/neela_backend/settings.py`:

```python
# Replace SendGrid config with:
EMAIL_BACKEND = 'anymail.backends.mailgun.EmailBackend'
ANYMAIL = {
    "MAILGUN_API_KEY": os.environ.get('MAILGUN_API_KEY'),
    "MAILGUN_SENDER_DOMAIN": os.environ.get('MAILGUN_DOMAIN'),
}
```

4. Update `backend/.env`:
```bash
# Remove or comment out:
# SENDGRID_API_KEY=...

# Add:
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_domain.mailgun.org
```

---

## Monitoring Email Usage

To avoid hitting limits again:

### Check SendGrid Dashboard Daily
1. Go to https://app.sendgrid.com/
2. View **"Email Activity"**
3. Monitor daily sending volume

### Set Up Alerts
1. In SendGrid dashboard
2. Go to **"Settings"** → **"Alerts"**
3. Create alert for:
   - 80% of daily limit reached
   - API errors

### Track in Your App
Add this to your backend to monitor usage:

```python
# In backend/api/email_service.py
import logging
logger = logging.getLogger(__name__)

# After every email send:
logger.info(f"Email sent to {recipient}. Check SendGrid dashboard for quota.")
```

---

## Preventing Future Issues

### 1. Implement Email Batching
Don't send emails immediately - queue them:

```python
# Instead of sending 100 welcome emails at once,
# spread them over the day
```

### 2. Consolidate Emails
- Send daily digest instead of individual notifications
- Combine multiple updates into one email

### 3. Add Email Preferences
Let users choose which emails they want:
- Payment receipts only
- Important notices only
- All communications

### 4. Use SMS for Critical Messages
For urgent notifications (like payment due), consider SMS instead of email

---

## Testing Email After Fix

Run diagnostic:
```bash
cd backend
.\env\Scripts\python diagnose_issues.py
```

Expected output:
```
[OK] SendGrid API key is configured
    Testing email send...
[OK] Test email sent successfully!
```

---

## Cost Comparison

| Service | Free Tier | Monthly Cost | Emails/Month |
|---------|-----------|--------------|--------------|
| SendGrid Essentials | 100/day | $19.95 | 40,000 |
| Mailgun Concept | 5,000 total | $0 | 5,000 |
| Mailgun Foundation | - | $35 | 50,000 |
| AWS SES | 62,000* | ~$5 | 100,000 |
| Brevo Free | 300/day | $0 | 9,000 |
| Brevo Starter | - | $25 | Unlimited |

*AWS SES free tier only if sending from EC2

---

## Recommendation

For **Neela Tenant App**:

1. **Short term (today)**: Create new SendGrid account
2. **Long term (this week)**: Upgrade to SendGrid Essentials ($19.95/month)
3. **Future**: Monitor usage and optimize email sending

---

## Need Help?

If emails still don't work after fixing:

1. Check Render logs for errors
2. Run diagnostic: `python diagnose_issues.py`
3. Check SendGrid "Email Activity" for delivery status
4. Review `ISSUES_TO_FIX.md` for other email-related issues

---

**Remember:** Once you fix the SendGrid issue, 3 of your production errors will be resolved:
- ✅ Payment receipt emails
- ✅ Invoice emails  
- ✅ Notice emails
