"""
Seeds the database with all lease and legal document templates.
Run this after creating a new database (e.g. new Render Postgres) to restore templates.

Usage (from backend folder):
    python seed_all_lease_templates.py

Or with Django env already set:
    python create_lease_template.py
    python manage.py seed_lease_templates
    python manage.py seed_wills_packet
    python manage.py seed_termination_letter
    python manage.py seed_eviction_notice
"""

import os
import sys
import subprocess

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)

    # Ensure Django settings
    if 'DJANGO_SETTINGS_MODULE' not in os.environ:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
        import django
        django.setup()

    print("\n" + "=" * 60)
    print("  SEEDING ALL LEASE & LEGAL TEMPLATES")
    print("=" * 60 + "\n")

    steps = [
        ("Default lease template", [sys.executable, "create_lease_template.py"]),
        ("Texas Standard Residential Lease", [sys.executable, "manage.py", "seed_lease_templates"]),
        ("Wills Lease Packet", [sys.executable, "manage.py", "seed_wills_packet"]),
        ("Termination letter template", [sys.executable, "manage.py", "seed_termination_letter"]),
        ("Eviction notice template", [sys.executable, "manage.py", "seed_eviction_notice"]),
    ]

    for name, cmd in steps:
        print(f"Running: {name}...")
        try:
            result = subprocess.run(cmd, cwd=backend_dir)
            if result.returncode != 0:
                print(f"  [WARN] {name} returned code {result.returncode}")
            else:
                print(f"  [OK] {name}")
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")

    print("\n" + "=" * 60)
    print("  DONE. Refresh your app to see lease templates.")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
