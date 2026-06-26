import os
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'neela_backend.settings')
django.setup()

import openpyxl
from api.models import Property
from api.pnl_service import compute_property_pnl

ROOT = Path(__file__).resolve().parent.parent.parent
EXCEL = ROOT / '2026 Neela Capital Invesments LLC..xlsx'

SHEET_TO_KEY = {
    'Bella_Jess': 'Bella Jess',
    'Tomball': 'Tomabll',
    'Conroe': 'Conroe',
    'Ave_Q': 'Ave Q',
    'Sherman': 'Sherman',
    '70th': '70th',
    'Avenue H': 'Ave H',
    'Wooding': 'Wooden',
    'Avenue F': 'Ave F',
}
MONTH_LABELS = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}


def parse_decimal(val):
    if val is None:
        return Decimal('0')
    if isinstance(val, (int, float)):
        return Decimal(str(val))
    s = str(val).strip().replace(',', '').replace('$', '')
    if not s or s in ('-', '#REF!', '#N/A'):
        return Decimal('0')
    try:
        return Decimal(s)
    except Exception:
        return Decimal('0')


def excel_totals():
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    excel_income = excel_exp = excel_noi = Decimal('0')
    per_sheet = {}
    for sheet, key in SHEET_TO_KEY.items():
        ws = wb[sheet]
        rows = list(ws.iter_rows(values_only=True))
        inc = exp = noi = Decimal('0')
        for row in rows[2:20]:
            if not row or len(row) < 5 or not row[1]:
                continue
            label = str(row[1]).strip().lower().rstrip('.')
            if label not in MONTH_LABELS:
                continue
            i = parse_decimal(row[2])
            e = parse_decimal(row[3])
            n = parse_decimal(row[4])
            inc += i
            exp += e
            noi += n
        per_sheet[key] = {'income': inc, 'expenses': exp, 'noi': noi}
        excel_income += inc
        excel_exp += exp
        excel_noi += noi
    wb.close()
    return excel_income, excel_exp, excel_noi, per_sheet


def main():
    excel_income, excel_exp, excel_noi, per_sheet = excel_totals()
    props = list(Property.objects.filter(name__in=[
        'Bella Jess', 'Tomabll', 'Conroe', 'Ave Q', 'Sherman', '70th', 'Ave H', 'Wooden', 'Ave F',
    ]))
    pnl = compute_property_pnl(year=2026, properties=props, admin_view=True)
    p = pnl['portfolio']

    print('=== EXCEL (monthly summary rows) ===')
    print(f'Total Income: {excel_income}')
    print(f'Total Operating Expenses: {excel_exp}')
    print(f'Total NOI: {excel_noi}')
    print()
    print('=== APP (admin P&L) ===')
    print(f'Total Income: {p["total_income"]}')
    print(f'Total Expenses: {p["total_expenses"]}')
    print(f'NOI: {p["net_income"]}')
    print()
    print('=== DELTA ===')
    print(f'Income diff: {Decimal(str(p["total_income"])) - excel_income}')
    print(f'Expense diff: {Decimal(str(p["total_expenses"])) - excel_exp}')
    print(f'NOI diff: {Decimal(str(p["net_income"])) - excel_noi}')

    print('\n=== PER PROPERTY (Excel vs App) ===')
    by_name = {row['property_name']: row for row in pnl['by_property']}
    name_map = {
        'Bella Jess': 'Bella Jess',
        'Tomabll': 'Tomabll',
        'Conroe': 'Conroe',
        'Ave Q': 'Ave Q',
        'Sherman': 'Sherman',
        '70th': '70th',
        'Ave H': 'Ave H',
        'Wooden': 'Wooden',
        'Ave F': 'Ave F',
    }
    mismatches = 0
    for key, ex in per_sheet.items():
        app_name = name_map.get(key)
        app_row = by_name.get(app_name) if app_name else None
        if not app_row:
            print(f'{key}: NO MATCH IN APP')
            mismatches += 1
            continue
        ai = Decimal(str(app_row['total_income']))
        ae = Decimal(str(app_row['total_expenses']))
        an = Decimal(str(app_row['net_income']))
        if ai != ex['income'] or ae != ex['expenses']:
            mismatches += 1
            print(f'{key} / {app_row["property_name"]}:')
            print(f'  Excel  income={ex["income"]} exp={ex["expenses"]} noi={ex["noi"]}')
            print(f'  App    income={ai} exp={ae} noi={an}')
    if mismatches == 0:
        print('All properties match Excel summary rows.')
    return mismatches


if __name__ == '__main__':
    sys.exit(main())
