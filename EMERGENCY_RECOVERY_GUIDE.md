# 🚨 Emergency Recovery Guide
## What to Do When Your Render Database Suspends

Follow these steps **in order** when your database is suspended or deleted.

---

## Step 1: Create New Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in details:
   - **Name**: `neela-database` (or any name)
   - **Database**: `neela_db`
   - **User**: (auto-generated)
   - **Region**: Choose closest to you
   - **Plan**: Free
4. Click **"Create Database"**
5. Wait for database to be created (2-3 minutes)

---

## Step 2: Get New Database URL

1. In Render dashboard, click on your new database
2. Scroll down to **"Connections"** section
3. Copy the **"External Database URL"**
   - It looks like: `postgresql://username:password@hostname.render.com/database_name`

---

## Step 3: Update Your `.env` File

1. Open `backend/.env` file in your editor
2. Find the line that says:
   ```
   DATABASE_URL=postgresql://...
   ```
3. Replace it with your new database URL:
   ```
   DATABASE_URL=postgresql://your_new_database_url_here
   ```
4. **Save the file**

---

## Step 4: Run Database Migrations

Open PowerShell/Terminal in your project folder and run:

```bash
cd backend
.\env\Scripts\Activate.ps1
python manage.py migrate
```

This creates all the tables in your new database.

**Expected output**: You should see `OK` messages for each migration.

---

## Step 5: Reconnect Files from Cloudinary

### Option A: Using the Script (Recommended)

I'll create a permanent recovery script for you. Run:

```bash
cd backend
.\env\Scripts\python reconnect_all_data.py
```

### Option B: Manual Recovery

If you have a backup (from running `backup_database.py`):

```bash
psql postgresql://your_new_database_url < backups/neela_backup_YYYYMMDD_HHMMSS.sql
```

---

## Step 6: Create Default Lease Template

Run this command:

```bash
cd backend
.\env\Scripts\python create_lease_template.py
```

---

## Step 7: Verify Everything Works

1. **Start your backend server**:
   ```bash
   cd backend
   python manage.py runserver
   ```

2. **Check the database**:
   ```bash
   python manage.py shell -c "from api.models import Tenant, LegalDocument; print(f'Tenants: {Tenant.objects.count()}'); print(f'Leases: {LegalDocument.objects.count()}')"
   ```

3. **Test your frontend**: Open your app and check if:
   - Documents appear
   - Leases are visible
   - You can generate new leases

---

## Quick Recovery Scripts

I'm creating permanent scripts for you that make recovery easy:

### 1. `reconnect_all_data.py`
Automatically reconnects all Cloudinary files to new database.

### 2. `create_lease_template.py`
Creates the default lease template.

### 3. `verify_recovery.py`
Checks if everything was recovered properly.

---

## What Gets Recovered vs What's Lost

### ✅ ALWAYS RECOVERED (Stored in Cloudinary):
- All uploaded PDFs (leases, documents)
- Property images
- Application documents

### ⚠️ NEEDS MANUAL RE-ENTRY:
- Tenant personal info (names, emails, phones)
- Application form data
- Payment records
- Maintenance requests

### 💾 RECOVERED IF YOU HAVE BACKUP:
- Everything above!
- That's why backups are important

---

## Prevention Tips

To avoid this happening again:

1. **Backup Weekly**:
   ```bash
   cd backend
   .\env\Scripts\python backup_database.py
   ```

2. **Keep Database Active** (set up daily task):
   ```bash
   cd backend
   .\env\Scripts\python keep_db_alive.py
   ```

3. **Upgrade to Paid Plan** ($7/month):
   - Database never suspends
   - Automated backups
   - Better performance

4. **Set Calendar Reminders**:
   - Every 25 days: Access your app to keep DB active
   - Every week: Run backup script
   - Every month: Check Render dashboard for warnings

---

## Troubleshooting

### Problem: "No module named django"
**Solution**: Activate virtual environment first:
```bash
cd backend
.\env\Scripts\Activate.ps1
```

### Problem: "Connection refused" 
**Solution**: Check if DATABASE_URL is correct in `.env` file

### Problem: "Migration errors"
**Solution**: Drop and recreate database, then run migrations again

### Problem: "Files not showing"
**Solution**: Run the reconnect script again:
```bash
.\env\Scripts\python reconnect_all_data.py
```

---

## Emergency Contacts

- **Render Support**: https://render.com/docs/support
- **Cloudinary Console**: https://cloudinary.com/console
- **Your Cloudinary Files**: Always accessible at cloudinary.com

---

## Summary: Quick Recovery Checklist

When database suspends:

- [ ] Create new database on Render
- [ ] Copy new database URL
- [ ] Update `backend/.env` with new URL
- [ ] Run migrations: `python manage.py migrate`
- [ ] Run reconnect script: `python reconnect_all_data.py`
- [ ] Create lease template: `python create_lease_template.py`
- [ ] Verify recovery: `python verify_recovery.py`
- [ ] Test frontend
- [ ] Create new backup immediately

**Time required**: 10-15 minutes

---

## Important Notes

1. **Your files are NEVER lost** - They're always safe in Cloudinary
2. **Only database records are lost** - That's why backups matter
3. **Recovery is simple** - Just follow these steps
4. **Reconnection is automatic** - The scripts do the hard work

Keep this guide handy! Bookmark this file or print it out.

---

**Need help?** Re-read the `BACKUP_STRATEGY.md` file for more details.
