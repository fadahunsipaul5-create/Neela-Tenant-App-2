"""
Simple script to backup the PostgreSQL database to a local file.
Run this weekly or before major changes.

Usage:
    python backup_database.py
"""

import os
import subprocess
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment variables")
    exit(1)

# Create backups directory if it doesn't exist
backup_dir = os.path.join(os.path.dirname(__file__), 'backups')
os.makedirs(backup_dir, exist_ok=True)

# Generate backup filename with timestamp
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = os.path.join(backup_dir, f'neela_backup_{timestamp}.sql')

print("=" * 60)
print("DATABASE BACKUP UTILITY")
print("=" * 60)
print(f"Backup file: {backup_file}")
print("Starting backup...")
print("-" * 60)

try:
    # Run pg_dump command
    result = subprocess.run(
        ['pg_dump', DATABASE_URL],
        stdout=open(backup_file, 'w'),
        stderr=subprocess.PIPE,
        text=True
    )
    
    if result.returncode == 0:
        file_size = os.path.getsize(backup_file)
        print(f"\n✓ Backup successful!")
        print(f"  File: {backup_file}")
        print(f"  Size: {file_size / 1024:.2f} KB")
        print("\nTo restore this backup:")
        print(f"  psql [NEW_DATABASE_URL] < {backup_file}")
    else:
        print(f"\n✗ Backup failed!")
        print(f"Error: {result.stderr}")
        
except FileNotFoundError:
    print("\n✗ Error: pg_dump not found!")
    print("\nPlease install PostgreSQL client tools:")
    print("  Windows: Download from https://www.postgresql.org/download/windows/")
    print("  Mac: brew install postgresql")
    print("  Linux: sudo apt-get install postgresql-client")
    
except Exception as e:
    print(f"\n✗ Error: {e}")

print("=" * 60)
