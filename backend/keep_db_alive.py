"""
Health check script to keep Render database active.
Prevents suspension due to inactivity.

This script queries the database to maintain activity.
Run this daily using a cron job or task scheduler.

Usage:
    python keep_db_alive.py
    
Setup as Windows Task:
    1. Open Task Scheduler
    2. Create Basic Task
    3. Trigger: Daily
    4. Action: Start a program
    5. Program: C:\\path\\to\\env\\Scripts\\python.exe
    6. Arguments: C:\\path\\to\\backend\\keep_db_alive.py
    7. Start in: C:\\path\\to\\backend
"""

import os
import django
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

from api.models import Tenant, Property, LegalDocument
from django.db import connection

print(f"\n{'='*60}")
print(f"DATABASE HEALTH CHECK - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*60}\n")

try:
    # Simple query to keep connection active
    tenant_count = Tenant.objects.count()
    property_count = Property.objects.count()
    lease_count = LegalDocument.objects.count()
    
    # Get database name
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()[0]
    
    print(f"[OK] Database: {db_name}")
    print(f"[OK] Connection: Active")
    print(f"[OK] Tenants: {tenant_count}")
    print(f"[OK] Properties: {property_count}")
    print(f"[OK] Leases: {lease_count}")
    print(f"\n{'='*60}")
    print("[SUCCESS] Health check successful - Database is active!")
    print(f"{'='*60}\n")
    
except Exception as e:
    print(f"[ERROR] Health check failed: {e}")
    print(f"{'='*60}\n")
    exit(1)
