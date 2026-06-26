"""
Portfolio P&L calculations aligned with the Neela Capital Excel workbook.

Excel per property / month (see import_income_statement.parse_property_sheet):
  Total Income          → rent collected (+ short-stay when applicable)
  Total Operating Expenses → sum of operating expense line items
  Net Operating Income (NOI) → Total Income − Total Operating Expenses

Admin view includes admin_only categories (mortgage, depreciation, taxes, etc.).
Property managers only see operating expenses they record — not portfolio NOI.
"""
import re
from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum, Q
from django.db.models.functions import ExtractMonth

from .models import Payment, Property, Tenant, OperatingExpense, ShortStayBooking, PropertyUnit
from .property_units_service import get_property_group_key, is_portfolio_parent, sync_units_for_property
from .permissions import is_admin_user, exclude_import_placeholder_tenants

IMPORT_TAG = 'excel-import-2026'


def normalize(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def parse_import_property_id(reference):
    """Parse property id from excel-import payment reference: excel-import-2026-{prop_id}-..."""
    ref = reference or ''
    if not ref.startswith(IMPORT_TAG):
        return None
    parts = ref.split('-')
    if len(parts) >= 4:
        try:
            return int(parts[3])
        except (TypeError, ValueError):
            return None
    return None


def parse_import_tenant_property_id(email):
    """Synthetic rent-roll tenants: excel-import-{prop_id}@neela.local"""
    if not email:
        return None
    e = email.lower().strip()
    m = re.match(r'^excel-import-(\d+)@neela\.local$', e)
    if m:
        return int(m.group(1))
    return None


def build_tenant_property_map(tenants, property_ids_set, property_aliases):
    """
    Map tenant_id → property_id using property_unit text, import emails, or payment refs.
    """
    tenant_prop_map = {}

    for t in tenants:
        # Direct link from import rent-roll tenant
        pid = parse_import_tenant_property_id(t.email)
        if pid and pid in property_ids_set:
            tenant_prop_map[t.id] = pid
            continue

        token = normalize(t.property_unit)
        if not token:
            continue
        for prop_id, aliases in property_aliases:
            if prop_id not in property_ids_set:
                continue
            if any(alias and alias in token for alias in aliases):
                tenant_prop_map[t.id] = prop_id
                break

    # Back-fill from import payment references when tenant matching missed
    for pay in Payment.objects.filter(reference__startswith=IMPORT_TAG).only('id', 'tenant_id', 'reference'):
        pid = parse_import_property_id(pay.reference)
        if pid and pid in property_ids_set:
            tenant_prop_map[pay.tenant_id] = pid

    return tenant_prop_map


def _aggregate_expenses(expenses_qs, *, admin_view):
    """
    Excel imports store monthly __SUMMARY__ rows matching workbook totals.
    Line-item rows feed category breakdown only when a summary row exists.
    """
    expenses = list(expenses_qs)
    if not admin_view:
        expenses = [e for e in expenses if e.visibility != 'admin_only']

    summary_keys = {
        (e.property_id, e.date.month)
        for e in expenses
        if (e.notes or '').startswith(IMPORT_TAG) and '__SUMMARY__' in (e.notes or '')
    }
    properties_with_excel_summary = {pid for pid, _ in summary_keys}

    expenses_by_property = defaultdict(lambda: Decimal('0'))
    expenses_by_category = defaultdict(lambda: Decimal('0'))
    expenses_by_unit = defaultdict(lambda: Decimal('0'))

    for exp in expenses:
        amount = exp.amount or Decimal('0')
        notes = exp.notes or ''
        is_excel = notes.startswith(IMPORT_TAG)
        is_summary = is_excel and '__SUMMARY__' in notes

        if not is_summary:
            expenses_by_category[exp.category] += amount

        if is_excel and not is_summary and exp.property_id in properties_with_excel_summary:
            continue

        if exp.unit_id:
            expenses_by_unit[exp.unit_id] += amount
        if exp.property_id:
            expenses_by_property[exp.property_id] += amount
        else:
            expenses_by_property['portfolio'] += amount

    return expenses_by_property, expenses_by_category, expenses_by_unit


def _monthly_expense_map(expenses_qs, *, admin_view, property_ids_set):
    expenses = list(expenses_qs.filter(
        Q(property_id__in=property_ids_set) | Q(property_id__isnull=True)
    ))
    if not admin_view:
        expenses = [e for e in expenses if e.visibility != 'admin_only']

    summary_keys = {
        (e.property_id, e.date.month)
        for e in expenses
        if (e.notes or '').startswith(IMPORT_TAG) and '__SUMMARY__' in (e.notes or '')
    }
    properties_with_excel_summary = {pid for pid, _ in summary_keys}

    month_map = defaultdict(lambda: Decimal('0'))
    for exp in expenses:
        notes = exp.notes or ''
        is_excel = notes.startswith(IMPORT_TAG)
        is_summary = is_excel and '__SUMMARY__' in notes
        if is_excel and not is_summary and exp.property_id in properties_with_excel_summary:
            continue
        month_map[exp.date.month] += exp.amount or Decimal('0')
    return month_map


def portfolio_parent_property_ids():
    """Portfolio roll-up properties (one per building / Excel sheet)."""
    ids = set()
    for prop in Property.objects.only('id', 'name', 'area', 'address', 'units'):
        group_key = get_property_group_key(prop)
        if is_portfolio_parent(prop, group_key):
            ids.add(prop.id)
    return ids


def excel_portfolio_property_ids(year):
    """Property IDs with Excel workbook P&L import for this year."""
    ids = set()
    for ref in Payment.objects.filter(
        reference__startswith=f'{IMPORT_TAG}-',
        date__year=year,
    ).values_list('reference', flat=True):
        pid = parse_import_property_id(ref)
        if pid:
            ids.add(pid)
    return ids


def compute_property_pnl(
    *,
    year,
    properties,
    admin_view,
    request=None,
    summary_only=False,
):
    """
    Build income-statement payload matching Excel P&L structure.
    Returns dict suitable for JSON Response (snake_case keys).
    """
    property_ids = [p.id for p in properties]
    property_ids_set = set(property_ids)
    excel_property_ids = excel_portfolio_property_ids(year)

    property_aliases = []
    for p in properties:
        aliases = [normalize(p.name), normalize(p.address)]
        if p.area:
            aliases.append(normalize(p.area))
        aliases = [a for a in aliases if a]
        property_aliases.append((p.id, aliases))

    tenants_qs = exclude_import_placeholder_tenants(Tenant.objects.only('id', 'property_unit', 'email'))
    tenant_prop_map = build_tenant_property_map(
        list(tenants_qs),
        property_ids_set,
        property_aliases,
    )

    unit_rows_by_property = defaultdict(list)
    if not summary_only:
        all_props = list(properties) if len(properties) < 50 else list(Property.objects.all())
        for prop in properties:
            sync_units_for_property(prop, all_props)
            for unit in PropertyUnit.objects.filter(property_id=prop.id):
                unit_rows_by_property[prop.id].append(unit)

    rent_income_by_property = defaultdict(lambda: Decimal('0'))
    rent_income_by_unit = defaultdict(lambda: Decimal('0'))

    payments_qs = Payment.objects.filter(
        status='Paid',
        date__year=year,
        type='Rent',
    ).select_related('tenant').only('id', 'amount', 'tenant_id', 'tenant__property_unit', 'tenant__email', 'reference')

    for pay in payments_qs:
        prop_id = tenant_prop_map.get(pay.tenant_id) or parse_import_property_id(pay.reference)
        if prop_id not in property_ids_set:
            continue
        if excel_property_ids and prop_id in excel_property_ids:
            if not (pay.reference or '').startswith(IMPORT_TAG):
                continue
        amount = pay.amount or Decimal('0')
        rent_income_by_property[prop_id] += amount
        if not summary_only:
            unit_token = normalize(pay.tenant.property_unit if pay.tenant else '')
            for unit in unit_rows_by_property.get(prop_id, []):
                if normalize(unit.label) in unit_token or unit_token in normalize(unit.label):
                    rent_income_by_unit[unit.id] += amount
                    break

    short_stay_by_property = defaultdict(lambda: Decimal('0'))
    for row in ShortStayBooking.objects.filter(
        status='confirmed',
        check_in__year=year,
        property_id__in=property_ids,
    ).values('property_id').annotate(total=Sum('total_amount')):
        short_stay_by_property[row['property_id']] = row['total'] or Decimal('0')

    expenses_by_property = defaultdict(lambda: Decimal('0'))
    expenses_by_category = defaultdict(lambda: Decimal('0'))
    expenses_by_unit = defaultdict(lambda: Decimal('0'))

    expenses_qs = OperatingExpense.objects.filter(
        date__year=year,
    ).filter(
        Q(property_id__in=property_ids) | Q(property_id__isnull=True)
    ).select_related('property', 'unit').only(
        'id', 'amount', 'category', 'property_id', 'unit_id', 'visibility', 'notes', 'date'
    )

    expenses_by_property, expenses_by_category, expenses_by_unit = _aggregate_expenses(
        expenses_qs, admin_view=admin_view
    )

    if summary_only:
        total_rent = sum(rent_income_by_property.get(p.id, Decimal('0')) for p in properties)
        total_short = sum(short_stay_by_property.get(p.id, Decimal('0')) for p in properties)
        total_expenses = sum(expenses_by_property.get(p.id, Decimal('0')) for p in properties)
        portfolio_expenses = total_expenses + expenses_by_property['portfolio']
        portfolio_income = total_rent + total_short
        return {
            'year': year,
            'is_admin_view': admin_view,
            'portfolio': {
                'rent_income': float(total_rent),
                'short_stay_income': float(total_short),
                'total_income': float(portfolio_income),
                'total_expenses': float(portfolio_expenses),
                'net_income': float(portfolio_income - portfolio_expenses),
            },
            'by_property': [],
            'by_unit': [],
            'expenses_by_category': {k: float(v) for k, v in expenses_by_category.items()},
            'monthly': [],
        }

    property_rows = []
    unit_detail_rows = []
    total_rent = Decimal('0')
    total_short = Decimal('0')
    total_expenses = Decimal('0')

    for p in properties:
        rent = rent_income_by_property[p.id]
        short = short_stay_by_property[p.id]
        expenses = expenses_by_property[p.id]
        income = rent + short
        # Excel: NOI = Total Income − Total Operating Expenses
        net = income - expenses
        total_rent += rent
        total_short += short
        total_expenses += expenses

        image_url = None
        if p.image and request:
            image_url = request.build_absolute_uri(p.image.url)
        elif p.image_url:
            image_url = p.image_url

        financials_data = None
        if admin_view:
            fin = getattr(p, 'financials', None)
            if fin:
                financials_data = {
                    'purchase_price': float(fin.purchase_price or 0),
                    'down_payment': float(fin.down_payment or 0),
                    'closing_cost': float(fin.closing_cost or 0),
                    'loan_amount': float(fin.loan_amount or 0),
                    'interest_rate': float(fin.interest_rate or 0),
                    'loan_term_years': fin.loan_term_years,
                    'monthly_mortgage_payment': float(fin.monthly_mortgage_payment or 0),
                    'land_value': float(fin.land_value or 0),
                    'annual_depreciation_years': float(fin.annual_depreciation_years or 27.5),
                    'escrow_notes': fin.escrow_notes or '',
                }

        units = []
        for unit in unit_rows_by_property.get(p.id, []):
            unit_income = rent_income_by_unit[unit.id]
            unit_expenses = expenses_by_unit[unit.id]
            unit_detail = {
                'unit_id': unit.id,
                'property_id': p.id,
                'label': unit.label,
                'monthly_rent': float(unit.monthly_rent or 0),
                'status': unit.status,
                'rent_income': float(unit_income),
                'total_expenses': float(unit_expenses),
                'net_income': float(unit_income - unit_expenses),
            }
            units.append(unit_detail)
            unit_detail_rows.append(unit_detail)

        property_rows.append({
            'property_id': p.id,
            'property_name': p.name,
            'address': p.address,
            'city': p.city,
            'state': p.state,
            'units_count': p.units,
            'image_url': image_url,
            'rent_income': float(rent),
            'short_stay_income': float(short),
            'total_income': float(income),
            'total_expenses': float(expenses),
            'net_income': float(net),
            'units': units,
            'financials': financials_data,
        })

    portfolio_expenses = total_expenses + expenses_by_property['portfolio']
    portfolio_income = total_rent + total_short
    portfolio_net = portfolio_income - portfolio_expenses

    monthly = _monthly_cash_flow(
        year=year,
        property_ids=property_ids,
        admin_view=admin_view,
        tenant_prop_map=tenant_prop_map,
    )

    return {
        'year': year,
        'is_admin_view': admin_view,
        'portfolio': {
            'rent_income': float(total_rent),
            'short_stay_income': float(total_short),
            'total_income': float(portfolio_income),
            'total_expenses': float(portfolio_expenses),
            'net_income': float(portfolio_net),
        },
        'by_property': property_rows,
        'by_unit': unit_detail_rows,
        'expenses_by_category': {k: float(v) for k, v in expenses_by_category.items()},
        'monthly': monthly,
    }


def _monthly_cash_flow(*, year, property_ids, admin_view, tenant_prop_map):
    """Monthly income / expenses / NOI — mirrors Excel month summary rows."""
    property_ids_set = set(property_ids)
    excel_property_ids = excel_portfolio_property_ids(year)

    month_rent_map = defaultdict(lambda: Decimal('0'))
    for pay in Payment.objects.filter(
        status='Paid', type='Rent', date__year=year,
    ).only('amount', 'date', 'tenant_id', 'reference'):
        prop_id = tenant_prop_map.get(pay.tenant_id) or parse_import_property_id(pay.reference)
        if prop_id not in property_ids_set:
            continue
        if excel_property_ids and prop_id in excel_property_ids:
            if not (pay.reference or '').startswith(IMPORT_TAG):
                continue
        month = pay.date.month
        month_rent_map[month] += pay.amount or Decimal('0')

    month_short_map = {
        int(row['month']): row['total'] or Decimal('0')
        for row in ShortStayBooking.objects.filter(
            status='confirmed',
            check_in__year=year,
            property_id__in=property_ids,
        ).annotate(month=ExtractMonth('check_in')).values('month').annotate(total=Sum('total_amount'))
    }

    month_exp_qs = OperatingExpense.objects.filter(
        date__year=year,
    ).filter(
        Q(property_id__in=property_ids) | Q(property_id__isnull=True)
    ).only('amount', 'date', 'property_id', 'visibility', 'notes')

    month_exp_map = _monthly_expense_map(
        month_exp_qs, admin_view=admin_view, property_ids_set=property_ids_set
    )

    monthly = []
    for month in range(1, 13):
        month_rent = month_rent_map.get(month, Decimal('0'))
        month_short = month_short_map.get(month, Decimal('0'))
        month_exp = month_exp_map.get(month, Decimal('0'))
        income = month_rent + month_short
        monthly.append({
            'month': month,
            'income': float(income),
            'expenses': float(month_exp),
            'net': float(income - month_exp),
        })
    return monthly
