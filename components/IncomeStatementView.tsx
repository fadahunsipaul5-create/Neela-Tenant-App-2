import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, Building2, Wallet, ChevronDown, ChevronUp,
  MapPin, Home, BarChart3, Sparkles, PieChart,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../services/api';
import { IncomeStatementSummary, OperatingExpense, Property } from '../types';
import {
  CATEGORY_LABELS,
  groupIncomeStatementProperties,
  GroupedPropertyRow,
} from '../utils/propertyGrouping';

interface Props {
  properties: Property[];
}

const formatMoney = (value: number) =>
  `$${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_COLORS: Record<string, string> = {
  utilities: 'bg-sky-100 text-sky-800 border-sky-200',
  maintenance: 'bg-amber-100 text-amber-800 border-amber-200',
  taxes: 'bg-violet-100 text-violet-800 border-violet-200',
  insurance: 'bg-blue-100 text-blue-800 border-blue-200',
  management: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  cleaning: 'bg-teal-100 text-teal-800 border-teal-200',
  hoa: 'bg-pink-100 text-pink-800 border-pink-200',
  advertising: 'bg-orange-100 text-orange-800 border-orange-200',
  legal: 'bg-slate-100 text-slate-800 border-slate-200',
  supplies: 'bg-lime-100 text-lime-800 border-lime-200',
  transportation: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  bank_charges: 'bg-gray-100 text-gray-800 border-gray-200',
  mortgage_interest: 'bg-rose-100 text-rose-900 border-rose-300',
  mortgage_principal: 'bg-red-100 text-red-900 border-red-300',
  depreciation: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
  other: 'bg-stone-100 text-stone-800 border-stone-200',
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  utilities: 'bg-sky-500',
  maintenance: 'bg-amber-500',
  taxes: 'bg-violet-500',
  insurance: 'bg-blue-500',
  management: 'bg-indigo-500',
  cleaning: 'bg-teal-500',
  hoa: 'bg-pink-500',
  advertising: 'bg-orange-500',
  legal: 'bg-slate-500',
  supplies: 'bg-lime-600',
  transportation: 'bg-cyan-500',
  bank_charges: 'bg-gray-500',
  mortgage_interest: 'bg-rose-600',
  mortgage_principal: 'bg-red-600',
  depreciation: 'bg-fuchsia-600',
  other: 'bg-stone-500',
};

const FALLBACK_PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

const PROPERTIES_PAGE_SIZE = 6;

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm animate-pulse">
      <p className="text-sm text-slate-400 font-medium mb-4">{label}</p>
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-slate-100" />
        <div className="h-16 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

/** Hide raw excel-import note prefixes; show the expense label only. */
function formatExpenseNote(notes?: string): string {
  if (!notes) return '';
  if (notes.includes('@neela.local')) return '';
  const imported = notes.match(/^excel-import-\d+\|[^|]+\|\d{2}\|(.+)$/);
  if (imported) return imported[1].trim();
  return notes;
}

const IncomeStatementView: React.FC<Props> = ({ properties }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<IncomeStatementSummary | null>(null);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertiesLimit, setPropertiesLimit] = useState(PROPERTIES_PAGE_SIZE);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  /** Per property group: 'all' = combined totals, otherwise a unitId */
  const [selectedUnitByGroup, setSelectedUnitByGroup] = useState<Record<string, string>>({});

  const load = async (selectedYear: number) => {
    setLoading(true);
    setDetailsLoading(true);
    setError(null);
    setSummary(null);
    setExpenses([]);
    setPropertiesLimit(PROPERTIES_PAGE_SIZE);

    try {
      const quick = await api.getIncomeStatement(selectedYear, { summary: true });
      setSummary(quick);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load income statement');
      setLoading(false);
      setDetailsLoading(false);
      return;
    }
    setLoading(false);
    setExpensesLoading(true);

    try {
      const [full, expenseRows] = await Promise.all([
        api.getIncomeStatement(selectedYear),
        api.getOperatingExpenses({ year: selectedYear, limit: 20 }),
      ]);
      setSummary(full);
      setExpenses(expenseRows);
    } catch {
      // Portfolio totals from summary fetch remain visible
    } finally {
      setDetailsLoading(false);
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    setSelectedUnitByGroup({});
    setExpandedProperty(null);
    load(year);
  }, [year]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date).getFullYear() === year).slice(0, 20),
    [expenses, year]
  );

  const monthlyChartData = useMemo(() => {
    if (!summary?.monthly?.length) return [];
    return summary.monthly.map((m) => ({
      name: MONTHS[m.month - 1],
      income: m.income,
      expenses: m.expenses,
    }));
  }, [summary]);

  const groupedProperties = useMemo(() => {
    if (!summary?.byProperty?.length) return [];
    return groupIncomeStatementProperties(summary.byProperty, properties);
  }, [summary, properties]);

  const visibleProperties = useMemo(
    () => groupedProperties.slice(0, propertiesLimit),
    [groupedProperties, propertiesLimit],
  );

  const hasMoreProperties = groupedProperties.length > propertiesLimit;

  const totalUnitsAcrossProperties = useMemo(
    () => groupedProperties.reduce((sum, g) => sum + (g.units?.length || g.unitsCount || 0), 0),
    [groupedProperties],
  );

  const expenseCategoryBreakdown = useMemo(() => {
    if (!summary?.expensesByCategory) return [];
    const entries = Object.entries(summary.expensesByCategory)
      .filter(([, amt]) => amt > 0)
      .sort(([, a], [, b]) => b - a);
    const total = entries.reduce((sum, [, amt]) => sum + amt, 0);
    return entries.map(([cat, amt]) => ({
      cat,
      label: CATEGORY_LABELS[cat] || cat.replace(/_/g, ' '),
      amount: amt,
      share: total > 0 ? (amt / total) * 100 : 0,
    }));
  }, [summary]);

  const getPropertyDisplay = (row: GroupedPropertyRow) => {
    const unitCount = row.units?.length || 0;
    const selection = selectedUnitByGroup[row.groupKey] ?? 'all';
    if (unitCount <= 1 || selection === 'all') {
      return {
        income: row.totalIncome,
        expenses: row.totalExpenses,
        noi: row.netIncome,
        unitLabel: unitCount === 1 ? row.units?.[0]?.label : null,
      };
    }
    const unit = row.units?.find((u) => u.unitId === selection);
    if (!unit) {
      return {
        income: row.totalIncome,
        expenses: row.totalExpenses,
        noi: row.netIncome,
        unitLabel: null,
      };
    }
    const unitIncome = unit.rentIncome;
    return {
      income: unitIncome,
      expenses: unit.totalExpenses,
      noi: unit.netIncome,
      unitLabel: unit.label,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p>Loading portfolio P&amp;L…</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-rose-600">{error || 'Could not load income statement'}</div>;
  }

  const isAdmin = summary.isAdminView !== false;

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700 text-white p-6 sm:p-8 shadow-2xl shadow-indigo-500/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')] opacity-15 bg-cover bg-center" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Portfolio P&amp;L · {year}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Income Statement</h2>
            <p className="text-indigo-100 mt-2 max-w-xl text-sm sm:text-base">
              Profit &amp; loss across every property — income, operating expenses, and net operating income (NOI).
            </p>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border-0 rounded-xl px-4 py-2.5 bg-white/15 backdrop-blur text-white font-semibold shadow-lg focus:ring-2 focus:ring-white/40"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y} className="text-slate-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: summary.portfolio.totalIncome, icon: DollarSign, grad: 'from-emerald-500 to-teal-600' },
          { label: 'Operating Expenses', value: summary.portfolio.totalExpenses, icon: Wallet, grad: 'from-rose-500 to-pink-600' },
          { label: 'Net Operating Income (NOI)', value: summary.portfolio.netIncome, icon: TrendingUp, grad: 'from-indigo-500 to-violet-600' },
          { label: 'Rent Collected', value: summary.portfolio.rentIncome, icon: Building2, grad: 'from-blue-500 to-cyan-600' },
        ].map(({ label, value, icon: Icon, grad }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-slate-200/50 p-5">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${grad} opacity-10 rounded-bl-full`} />
            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${grad} text-white shadow-md mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(value)}</p>
          </div>
        ))}
      </div>

      {detailsLoading && !summary.monthly.length ? (
        <SectionSkeleton label="Loading monthly cash flow…" />
      ) : (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 text-lg">Monthly Cash Flow — {year}</h3>
        </div>
        <div className="h-56 sm:h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number, name: string) => [
                  formatMoney(value),
                  name === 'income' ? 'Income' : 'Expenses',
                ]}
              />
              <Legend
                formatter={(value) => (value === 'income' ? 'Income' : 'Expenses')}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {expenseCategoryBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-lg">Expenses by Category</h3>
              </div>
              <p className="text-sm text-slate-500 max-w-2xl">
                Portfolio breakdown for {year} — operating costs recorded across all properties.
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Category total</p>
              <p className="text-xl font-bold text-rose-700">
                {formatMoney(expenseCategoryBreakdown.reduce((s, r) => s + r.amount, 0))}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {expenseCategoryBreakdown.map(({ cat, label, amount, share }, index) => (
              <div
                key={cat}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)_minmax(5.5rem,6.5rem)] gap-x-4 gap-y-1.5 items-center py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">{index + 1}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border flex-shrink-0 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.other}`}
                  >
                    {label}
                  </span>
                </div>

                <div className="hidden sm:block h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${CATEGORY_BAR_COLORS[cat] || CATEGORY_BAR_COLORS.other}`}
                    style={{ width: `${Math.max(share, share > 0 ? 2 : 0)}%` }}
                    title={`${share.toFixed(1)}% of category total`}
                  />
                </div>

                <div className="text-right sm:text-right">
                  <p className="font-bold text-slate-800 text-sm tabular-nums">{formatMoney(amount)}</p>
                  <p className="text-xs text-slate-400 tabular-nums">{share.toFixed(1)}%</p>
                </div>

                <div className="col-span-2 sm:hidden h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_BAR_COLORS[cat] || CATEGORY_BAR_COLORS.other}`}
                    style={{ width: `${Math.max(share, share > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailsLoading && !groupedProperties.length ? (
        <SectionSkeleton label="Loading properties…" />
      ) : (
      <div>
        <h3 className="font-bold text-slate-800 text-xl mb-4 flex items-center gap-2">
          <Home className="w-6 h-6 text-indigo-600" />
          Properties &amp; Units
          {groupedProperties.length > 0 && (
            <span className="text-sm font-normal text-slate-500">
              ({groupedProperties.length} propert{groupedProperties.length === 1 ? 'y' : 'ies'}
              {totalUnitsAcrossProperties > 0 ? ` · ${totalUnitsAcrossProperties} units` : ''})
            </span>
          )}
        </h3>
        <div className="flex flex-col gap-4 max-w-4xl">
          {visibleProperties.map((row) => {
            const img =
              row.imageUrl ||
              properties.find((p) => row.units?.some((u) => u.propertyId === p.id))?.image ||
              FALLBACK_PROPERTY_IMAGE;
            const expanded = expandedProperty === row.groupKey;
            const unitCount = row.units?.length || 0;
            const multiUnit = unitCount > 1 || (row.unitsCount ?? 0) > 1;
            const selectedUnit = selectedUnitByGroup[row.groupKey] ?? 'all';
            const display = getPropertyDisplay(row);

            return (
              <div
                key={row.groupKey}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-6">
                  {/* Left: image, name, units */}
                  <div className="flex gap-3 sm:gap-4 md:flex-1 md:min-w-0 md:max-w-[55%]">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                      <img src={img} alt={row.propertyName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">{row.propertyName}</h4>
                        {(row.address || row.city) && (
                          <p className="text-xs sm:text-sm text-slate-500 flex items-start gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              {[row.address, row.city, row.state].filter(Boolean).join(', ')}
                            </span>
                          </p>
                        )}
                      </div>
                      {multiUnit && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedProperty(expanded ? null : row.groupKey)}
                            className="inline-flex items-center justify-between gap-2 w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-colors"
                          >
                            <span>
                              Units ({unitCount})
                              {selectedUnit !== 'all' && (
                                <span className="text-indigo-600 font-normal ml-1">
                                  · {row.units!.find((u) => u.unitId === selectedUnit)?.label}
                                </span>
                              )}
                            </span>
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {expanded && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              <button
                                type="button"
                                onClick={() => setSelectedUnitByGroup((prev) => ({ ...prev, [row.groupKey]: 'all' }))}
                                className={`w-full flex items-center justify-between text-xs sm:text-sm px-2.5 py-2 rounded-lg border transition-colors ${
                                  selectedUnit === 'all'
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-200'
                                    : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200'
                                }`}
                              >
                                <span className="font-semibold">All units</span>
                                <span className="text-slate-500 font-medium">{formatMoney(row.totalIncome)}</span>
                              </button>
                              {row.units!.map((unit) => {
                                const isSelected = selectedUnit === unit.unitId;
                                return (
                                  <button
                                    type="button"
                                    key={unit.unitId}
                                    onClick={() => setSelectedUnitByGroup((prev) => ({ ...prev, [row.groupKey]: unit.unitId }))}
                                    className={`w-full flex items-center justify-between text-xs sm:text-sm px-2.5 py-2 rounded-lg border transition-colors ${
                                      isSelected
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-200'
                                        : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200'
                                    }`}
                                  >
                                    <span className="font-semibold text-left">{unit.label}</span>
                                    <span className="text-emerald-700 font-medium">{formatMoney(unit.rentIncome)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: income / expenses / NOI */}
                  <div className="flex flex-col justify-center gap-2 md:w-52 lg:w-56 flex-shrink-0">
                    {display.unitLabel && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 px-1">
                        {display.unitLabel}
                      </p>
                    )}
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-bold">Income</p>
                      <p className="font-bold text-emerald-800 text-base sm:text-lg">{formatMoney(display.income)}</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-rose-600 font-bold">Expenses</p>
                      <p className="font-bold text-rose-800 text-base sm:text-lg">{formatMoney(display.expenses)}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-indigo-600 font-bold">NOI</p>
                      <p className={`font-bold text-base sm:text-lg ${display.noi >= 0 ? 'text-indigo-800' : 'text-rose-700'}`}>
                        {formatMoney(display.noi)}
                      </p>
                    </div>
                  </div>
                </div>

                {isAdmin && row.financials && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-2">
                      Financing &amp; Ownership
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                      <span className="text-slate-400">Purchase Price</span><span>{formatMoney(row.financials.purchasePrice)}</span>
                      <span className="text-slate-400">Monthly Mortgage</span><span>{formatMoney(row.financials.monthlyMortgagePayment)}</span>
                      <span className="text-slate-400">Loan Amount</span><span>{formatMoney(row.financials.loanAmount)}</span>
                      <span className="text-slate-400">Interest Rate</span><span>{(row.financials.interestRate * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasMoreProperties && (
          <button
            type="button"
            onClick={() => setPropertiesLimit((n) => n + PROPERTIES_PAGE_SIZE)}
            className="mt-4 px-5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100 transition-colors"
          >
            Load more properties ({groupedProperties.length - propertiesLimit} remaining)
          </button>
        )}
      </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm max-w-4xl">
        <h3 className="font-bold text-slate-800 text-lg mb-4">Recent Expenses ({year})</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {expensesLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Loading recent expenses…</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No expenses recorded yet.</p>
          ) : (
            filteredExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">
                    {e.propertyName || 'Portfolio'}
                    {e.unitLabel ? ` · ${e.unitLabel}` : ''}
                    {' · '}{CATEGORY_LABELS[e.category] || e.category}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.date}
                    {formatExpenseNote(e.notes) ? ` · ${formatExpenseNote(e.notes)}` : ''}
                  </p>
                </div>
                <p className="font-bold text-sm text-rose-700 ml-3 flex-shrink-0">{formatMoney(e.amount)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomeStatementView;
