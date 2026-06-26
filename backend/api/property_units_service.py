"""Sync PropertyUnit rows from portfolio properties and unit-level Property records."""
import re

from .models import Property, PropertyUnit

PROPERTY_GROUPS = [
    ('Avenue Q', ['avenue q', 'ave q']),
    ('Sherman St', ['sherman']),
    ('Avenue H', ['avenue h', 'ave h']),
    ('70th Street', ['70th']),
    ('Wooding St', ['wooding', 'wooden']),
    ('Bella Jess', ['bella jess']),
    ('Avenue F', ['avenue f', 'ave f']),
    ('Conroe', ['conroe']),
    ('Tomball', ['tomball', 'tomabll']),
    ('Magnolia Dr', ['magnolia']),
    ('Westlock Dr', ['westlock']),
]


def normalize(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def property_search_text(prop):
    return ' '.join(
        x for x in (prop.area, prop.address, prop.name, prop.city, prop.state) if x
    ).lower()


def get_property_group_key(prop):
    text = property_search_text(prop)
    if prop.area and prop.area.strip():
        area = prop.area.strip().lower()
        for key, _ in PROPERTY_GROUPS:
            if key.lower() == area:
                return key
    for key, patterns in sorted(PROPERTY_GROUPS, key=lambda x: -len(x[0])):
        if any(p in text for p in patterns):
            return key
    return re.sub(r'\s*[-–]\s*unit\s+\w+', '', prop.name or '', flags=re.I).strip() or prop.name or 'Other'


def extract_unit_label(name, address=''):
    src = f'{name or ""} {address or ""}'
    unit = re.search(r'unit\s*[-–]?\s*([A-Za-z0-9]+)', src, re.I)
    if unit:
        return f'Unit {unit[1].upper()}'
    door = re.search(r'door\s*(\d+)', src, re.I)
    if door:
        return f'Door {door[1]}'
    trimmed = (name or '').strip()
    if trimmed:
        return trimmed
    return (address or '').strip() or 'Unit'


def unit_sort_key(label):
    m = re.search(r'(\d+|[A-Za-z]+)', label or '')
    return m.group(1).rjust(4, '0') if m else label


def is_portfolio_parent(prop, group_key):
    """Roll-up property (Excel sheet / building total), not an individual door."""
    name_norm = normalize(prop.name)
    group_norm = normalize(group_key)
    area_norm = normalize(prop.area or '')
    if name_norm == group_norm or name_norm == area_norm:
        return True
    short_keys = {
        'aveq': 'Avenue Q',
        'sherman': 'Sherman St',
        '70th': '70th Street',
        'aveh': 'Avenue H',
        'wooden': 'Wooding St',
        'avef': 'Avenue F',
        'tomabll': 'Tomball',
        'bellajess': 'Bella Jess',
        'conroe': 'Conroe',
    }
    if name_norm in short_keys and short_keys[name_norm] == group_key:
        return True
    return False


def find_group_siblings(prop, all_properties=None):
    group_key = get_property_group_key(prop)
    pool = all_properties if all_properties is not None else Property.objects.all()
    siblings = [p for p in pool if get_property_group_key(p) == group_key]
    unit_records = [p for p in siblings if not is_portfolio_parent(p, group_key)]
    if unit_records:
        return sorted(unit_records, key=lambda p: unit_sort_key(extract_unit_label(p.name, p.address)))
    return []


def sync_units_for_property(prop, all_properties=None, *, persist=True):
    """
    Ensure PropertyUnit rows exist for a portfolio property.
    Uses unit-level Property records in the same building group, or Unit A/B/C from prop.units.
    """
    existing = list(PropertyUnit.objects.filter(property_id=prop.id).order_by('sort_order', 'id'))
    siblings = find_group_siblings(prop, all_properties)
    target = []

    if siblings:
        for i, sib in enumerate(siblings):
            target.append({
                'label': extract_unit_label(sib.name, sib.address),
                'monthly_rent': sib.price or 0,
                'status': sib.status or 'vacant',
                'sort_order': i,
            })
    expected = int(prop.units or 1)
    if expected > 1 and len(target) < expected:
        used = {t['label'] for t in target}
        for i in range(expected):
            label = f'Unit {chr(ord("A") + i)}'
            if label in used:
                continue
            target.append({
                'label': label,
                'monthly_rent': 0,
                'status': 'vacant',
                'sort_order': len(target),
            })
            if len(target) >= expected:
                break
    elif not siblings and expected > 1:
        count = int(prop.units)
        labels = [f'Unit {chr(ord("A") + i)}' for i in range(min(count, 26))]
        if count > 26:
            labels = [f'Unit {i + 1}' for i in range(count)]
        for i, label in enumerate(labels):
            target.append({
                'label': label,
                'monthly_rent': 0,
                'status': 'vacant',
                'sort_order': i,
            })

    if not target:
        return existing

    if not persist:
        return target

    by_label = {u.label: u for u in existing}
    kept_ids = []
    for spec in target:
        unit = by_label.get(spec['label'])
        if unit:
            changed = []
            if unit.monthly_rent != spec['monthly_rent']:
                unit.monthly_rent = spec['monthly_rent']
                changed.append('monthly_rent')
            if unit.status != spec['status']:
                unit.status = spec['status']
                changed.append('status')
            if unit.sort_order != spec['sort_order']:
                unit.sort_order = spec['sort_order']
                changed.append('sort_order')
            if changed:
                unit.save(update_fields=changed)
        else:
            unit = PropertyUnit.objects.create(
                property=prop,
                label=spec['label'],
                monthly_rent=spec['monthly_rent'],
                status=spec['status'],
                sort_order=spec['sort_order'],
            )
        kept_ids.append(unit.id)

    PropertyUnit.objects.filter(property_id=prop.id).exclude(id__in=kept_ids).delete()
    return list(PropertyUnit.objects.filter(property_id=prop.id).order_by('sort_order', 'id'))


def sync_all_property_units():
    """Sync units for every portfolio-style property (area set or multi-unit)."""
    all_props = list(Property.objects.all())
    synced = 0
    for prop in all_props:
        group_key = get_property_group_key(prop)
        if is_portfolio_parent(prop, group_key) or (prop.units or 1) > 1:
            sync_units_for_property(prop, all_props)
            synced += 1
    return synced
