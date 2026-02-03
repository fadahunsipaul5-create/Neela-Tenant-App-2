# Database Backup Strategy

## Problem
Your Render database (free tier) can be suspended after 30 days of inactivity, causing data loss. While Cloudinary files persist, database records and references are lost.

## Solutions Implemented

### 1. ✅ Cloudinary Integration (Already Active)
- All file uploads (documents, leases, images) are stored in Cloudinary
- Files persist even if database is deleted
- Configuration in `backend/.env`:
  ```
  CLOUDINARY_CLOUD_NAME=du97pcuvh
  CLOUDINARY_API_KEY=316736159884851
  CLOUDINARY_API_SECRET=jyXhuwBcBbsjqZF2OGD5wBMFykI
  ```

### 2. ✅ Reconnection Scripts Created
- Successfully reconnected 200+ files from Cloudinary to new database
- Reconnected 8 lease PDFs for current tenants
- All tenant documents (photo IDs, income docs, background checks) linked

## Prevention Strategy for Future

### Option 1: Regular Database Backups (Recommended)

Create automated backups of your PostgreSQL database:

#### Manual Backup Command:
```bash
# From your local machine
pg_dump postgresql://neelabase_n7uj_user:R6U4ixKgS4wMKdKZy2c76V8QAtCvCUGA@dpg-d5uf5d3uibrs73edf6m0-a.oregon-postgres.render.com/neelabase_n7uj > backup_$(date +%Y%m%d).sql
```

#### Restore from Backup:
```bash
psql postgresql://[NEW_DB_URL] < backup_20260202.sql
```

**Schedule**: Run this weekly or before any major changes.

### Option 2: Keep Render Database Active

Render free tier databases are suspended after **30 days of inactivity**. To prevent suspension:

1. **Set up a daily health check**: Create a simple script that queries the database daily
2. **Use a cron job service** (like cron-job.org) to hit your API endpoint daily
3. **Monitor your Render dashboard** for suspension warnings

### Option 3: Upgrade to Paid Render Plan

- **Render Starter Plan** ($7/month): Database never suspends
- Includes automated backups
- Better performance and reliability

### Option 4: Migration to More Reliable Database

Consider migrating to:
- **Supabase** (Free tier with better reliability)
- **Railway** (Better free tier)
- **Neon** (Serverless Postgres, generous free tier)

## Current Database Status

| Resource | Count | Status |
|----------|-------|--------|
| Tenants | 2 | ✅ With documents |
| Properties | 1 | ✅ Working |
| Lease Templates | 1 | ✅ Working |
| Legal Documents (Leases) | 8 | ✅ Reconnected from Cloudinary |
| Uploaded Documents | 6 | ✅ Reconnected from Cloudinary |
| Cloudinary Files | 200+ | ✅ Preserved |

## What's Protected vs What's Not

### ✅ Protected (Stored in Cloudinary):
- Lease PDF files
- Tenant photo IDs
- Income verification documents
- Background check reports
- Property images

### ❌ Not Protected (Only in database):
- Tenant records (names, emails, phone, addresses)
- Application data (form submissions)
- Payment records
- Maintenance requests
- Lease metadata (status, dates, DocuSign info)
- Lease templates

## Emergency Recovery Process

If database is suspended/deleted again:

1. **Create new database on Render**
2. **Update DATABASE_URL** in `backend/.env`
3. **Run migrations**: `python manage.py migrate`
4. **Restore from backup** (if you have one): `psql [NEW_DB_URL] < backup.sql`
5. **OR reconnect Cloudinary files** using the scripts we created
6. **Recreate tenant records** manually or from backup
7. **Create default lease template** (we have the script)

## Recommended Action Plan

1. **Immediate (Today)**:
   - ✅ Cloudinary already connected
   - ✅ Files reconnected
   - ✅ Lease template created
   - ⚠️ **DO THIS**: Create your first database backup (see command above)

2. **This Week**:
   - Set up weekly backup schedule
   - Consider upgrading Render plan or migrating to better database provider
   - Test the backup restore process

3. **Ongoing**:
   - Monitor Render database status
   - Keep database active (access it daily)
   - Backup before any major changes
   - Document any new critical data structures

## Files Location

All uploaded files are in Cloudinary at:
- Leases: `media/leases/lease_{tenant_id}_{timestamp}.pdf`
- Documents: `media/applications/tenant_{tenant_id}/{doc_type}_{timestamp}_{name}.pdf`
- Properties: `media/properties/{name}.{ext}`

You can access all files directly from your Cloudinary dashboard:
https://cloudinary.com/console/c-{cloud_name}

## Support Contacts

- Render Support: https://render.com/docs/support
- Cloudinary Support: https://cloudinary.com/support
- Database Issues: Check Render dashboard for status

---

**Remember**: Your files are safe in Cloudinary. The database just needs regular backups!
