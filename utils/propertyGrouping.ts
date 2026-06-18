import { IncomeStatementRow, Property } from '../types';

export const PROPERTY_GROUPS: { key: string; patterns: string[] }[] = [
  { key: 'Avenue Q', patterns: ['avenue q', 'ave q'] },
  { key: 'Sherman St', patterns: ['sherman'] },
  { key: 'Avenue H', patterns: ['avenue h', 'ave h'] },
  { key: '70th Street', patterns: ['70th'] },
  { key: 'Wooding St', patterns: ['wooding', 'wooden'] },
  { key: 'Bella Jess', patterns: ['bella jess'] },
  { key: 'Avenue F', patterns: ['avenue f', 'ave f'] },
  { key: 'Conroe', patterns: ['conroe'] },
  { key: 'Tomball', patterns: ['tomball', 'tomabll'] },
  { key: 'Magnolia Dr', patterns: ['magnolia'] },
  { key: 'Westlock Dr', patterns: ['westlock'] },
];

export function propertySearchText(parts: {
  area?: string;
  address?: string;
  name?: string;
  city?: string;
  state?: string;
}): string {
  return [parts.area, parts.address, parts.name, parts.city, parts.state]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getPropertyGroupKeyFromProperty(prop: Property): string {
  const text = propertySearchText(prop);
  if (prop.area?.trim()) {
    const byArea = PROPERTY_GROUPS.find((g) => g.key.toLowerCase() === prop.area!.trim().toLowerCase());
    if (byArea) return byArea.key;
  }
  const byLength = [...PROPERTY_GROUPS].sort((a, b) => b.key.length - a.key.length);
  for (const g of byLength) {
    if (g.patterns.some((p) => text.includes(p))) return g.key;
  }
  return (prop.name || '').replace(/\s*[-–]\s*unit\s+\w+/i, '').trim() || prop.name || 'Other';
}

export function getPropertyGroupKey(row: IncomeStatementRow, prop?: Property): string {
  if (prop) return getPropertyGroupKeyFromProperty(prop);
  const text = propertySearchText({
    address: row.address,
    name: row.propertyName,
    city: row.city,
    state: row.state,
  });
  const byLength = [...PROPERTY_GROUPS].sort((a, b) => b.key.length - a.key.length);
  for (const g of byLength) {
    if (g.patterns.some((p) => text.includes(p))) return g.key;
  }
  return (row.propertyName || '').replace(/\s*[-–]\s*unit\s+\w+/i, '').trim() || row.propertyName || 'Other';
}

export function extractUnitLabel(name: string, address?: string): string {
  const src = `${name} ${address || ''}`;
  const unit = src.match(/unit\s*[-–]?\s*([A-Za-z0-9]+)/i);
  if (unit) return `Unit ${unit[1].toUpperCase()}`;
  const door = src.match(/door\s*(\d+)/i);
  if (door) return `Door ${door[1]}`;
  return 'Main';
}

function unitSortKey(label: string): string {
  const m = label.match(/(\d+|[A-Za-z]+)/);
  return m ? m[1].padStart(4, '0') : label;
}

export type GroupedPropertyRow = IncomeStatementRow & { groupKey: string };

export function groupIncomeStatementProperties(
  rows: IncomeStatementRow[],
  propertyList: Property[],
): GroupedPropertyRow[] {
  const map = new Map<string, GroupedPropertyRow>();

  for (const row of rows) {
    const prop = propertyList.find((p) => p.id === row.propertyId);
    const groupKey = getPropertyGroupKey(row, prop);

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        ...row,
        groupKey,
        propertyId: groupKey,
        propertyName: groupKey,
        rentIncome: 0,
        shortStayIncome: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        units: [],
        unitsCount: 0,
        financials: row.financials,
        imageUrl: row.imageUrl,
        address: row.address,
        city: row.city,
        state: row.state,
      });
    }

    const group = map.get(groupKey)!;
    group.rentIncome += row.rentIncome;
    group.shortStayIncome += row.shortStayIncome;
    group.totalIncome += row.totalIncome;
    group.totalExpenses += row.totalExpenses;
    group.netIncome += row.netIncome;
    if (!group.imageUrl && row.imageUrl) group.imageUrl = row.imageUrl;
    if (!group.financials && row.financials) group.financials = row.financials;
    if (!group.address && row.address) group.address = row.address;

    if (row.units?.length) {
      group.units!.push(...row.units);
    } else {
      group.units!.push({
        unitId: row.propertyId,
        propertyId: row.propertyId,
        label: extractUnitLabel(row.propertyName, row.address),
        monthlyRent: prop?.price ?? 0,
        status: prop?.status || 'vacant',
        rentIncome: row.rentIncome,
        totalExpenses: row.totalExpenses,
        netIncome: row.netIncome,
      });
    }
    group.unitsCount = group.units!.length;
  }

  return Array.from(map.values()).map((g) => ({
    ...g,
    units: [...(g.units || [])].sort((a, b) => unitSortKey(a.label).localeCompare(unitSortKey(b.label))),
  }));
}

export type PropertyGroupUnit = {
  label: string;
  propertyId: string;
};

export type PropertyGroupOption = {
  groupKey: string;
  propertyId: string;
  label: string;
  address?: string;
  image?: string;
  units: PropertyGroupUnit[];
};

/** Group managed Property records by building for expense dropdowns. */
export function groupPropertiesForSelect(properties: Property[]): PropertyGroupOption[] {
  const map = new Map<string, PropertyGroupOption>();

  for (const prop of properties) {
    const groupKey = getPropertyGroupKeyFromProperty(prop);
    const unitLabel = extractUnitLabel(prop.name, prop.address);
    const existing = map.get(groupKey);

    if (!existing) {
      map.set(groupKey, {
        groupKey,
        propertyId: prop.id,
        label: groupKey,
        address: prop.address,
        image: prop.image,
        units: [{ label: unitLabel, propertyId: prop.id }],
      });
      continue;
    }

    const hasUnit = existing.units.some((u) => u.propertyId === prop.id);
    if (!hasUnit) {
      existing.units.push({ label: unitLabel, propertyId: prop.id });
      existing.units.sort((a, b) => unitSortKey(a.label).localeCompare(unitSortKey(b.label)));
    }
    if (!existing.image && prop.image) existing.image = prop.image;
    if (!existing.address && prop.address) existing.address = prop.address;
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function resolvePropertyIdForExpense(
  groups: PropertyGroupOption[],
  groupKey: string,
  unitLabel: string,
): string {
  const group = groups.find((g) => g.groupKey === groupKey);
  if (!group) return '';
  if (!unitLabel) return group.propertyId;
  return group.units.find((u) => u.label === unitLabel)?.propertyId || group.propertyId;
}

export const MANAGER_EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'maintenance', label: 'Repairs & Maintenance' },
  { value: 'utilities', label: 'Utilities (landlord paid)' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'advertising', label: 'Advertising / Leasing' },
  { value: 'legal', label: 'Legal & Professional' },
  { value: 'supplies', label: 'Supplies & Materials' },
  { value: 'transportation', label: 'Transportation / Mileage' },
  { value: 'hoa', label: 'HOA Fees' },
  { value: 'other', label: 'Other' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  utilities: 'Utilities',
  maintenance: 'Repairs & Maintenance',
  taxes: 'Property Taxes',
  insurance: 'Insurance',
  management: 'Management Fees',
  cleaning: 'Cleaning',
  hoa: 'HOA Fees',
  advertising: 'Advertising / Leasing',
  legal: 'Legal & Professional',
  supplies: 'Supplies & Materials',
  transportation: 'Transportation',
  bank_charges: 'Bank Charges',
  mortgage_interest: 'Mortgage Interest',
  mortgage_principal: 'Mortgage Principal',
  depreciation: 'Depreciation',
  other: 'Other',
};
