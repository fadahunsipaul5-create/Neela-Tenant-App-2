import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, Building2, Wallet, ChevronDown, ChevronUp,
  Lock, MapPin, Home, BarChart3, Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { IncomeStatementSummary, OperatingExpense, Property } from '../types';

interface Props {
  properties: Property[];
}

const formatMoney = (value: number) =>
  `$${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CARD_GRADIENTS = [
  'from-violet-600 via-purple-600 to-fuchsia-600',
  'from-blue-600 via-cyan-600 to-teal-500',
  'from-emerald-600 via-green-600 to-lime-500',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-rose-600 via-pink-600 to-red-500',
  'from-indigo-600 via-blue-600 to-sky-500',
];

const CATEGORY_LABELS: Record<string, string> = {
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

const FALLBACK_PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

const IncomeStatementView: React.FC<Props> = ({ properties }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<IncomeStatementSummary | null>(null);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    property: '',
    category: 'maintenance' as OperatingExpense['category'],
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    visibility: 'operating' as OperatingExpense['visibility'],
  });

  const load = async (selectedYear: number) => {
    setLoading(true);
    setError(null);
    try {
      const [statement, expenseRows] = await Promise.all([
        api.getIncomeStatement(selectedYear),
        api.getOperatingExpenses(),
      ]);
      setSummary(statement);
      setExpenses(expenseRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load income statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(year);
  }, [year]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date).getFullYear() === year).slice(0, 15),
    [expenses, year]
  );

  const maxMonthly = useMemo(() => {
    if (!summary?.monthly?.length) return 1;
    return Math.max(...summary.monthly.map((m) => Math.max(m.income, m.expenses)), 1);
  }, [summary]);

  const addExpense = async () => {
    if (!expenseForm.amount) return;
    setSaving(true);
    try {
      await api.createOperatingExpense({
        property: expenseForm.property || undefined,
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        notes: expenseForm.notes.trim(),
        visibility: expenseForm.visibility,
      });
      setExpenseForm((prev) => ({ ...prev, amount: '', notes: '' }));
      await load(year);
    } finally {
      setSaving(false);
    }
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
      {/* Hero */}
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
              Profit &amp; loss across every property and unit — income, operating expenses, and net operating income (NOI).
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

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: summary.portfolio.totalIncome, icon: DollarSign, grad: 'from-emerald-500 to-teal-600' },
          { label: 'Operating Expenses', value: summary.portfolio.totalExpenses, icon: Wallet, grad: 'from-rose-500 to-pink-600' },
          { label: 'Net Operating Income', value: summary.portfolio.netIncome, icon: TrendingUp, grad: 'from-indigo-500 to-violet-600' },
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

      {/* Monthly chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 text-lg">Monthly Cash Flow — {year}</h3>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-36">
          {summary.monthly.map((m) => (
            <div key={m.month} className="flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex flex-col justify-end h-28 gap-0.5">
                <div
                  className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md min-h-[2px] transition-all"
                  style={{ height: `${(m.income / maxMonthly) * 100}%` }}
                  title={`Income: ${formatMoney(m.income)}`}
                />
                <div
                  className="w-full bg-gradient-to-t from-rose-400 to-rose-300 rounded-b-md min-h-[2px] transition-all"
                  style={{ height: `${(m.expenses / maxMonthly) * 100}%` }}
                  title={`Expenses: ${formatMoney(m.expenses)}`}
                />
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate w-full text-center">
                {MONTHS[m.month - 1]}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Income</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400" /> Expenses</span>
        </div>
      </div>

      {/* Expense categories */}
      {Object.keys(summary.expensesByCategory).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-4">Expenses by Category</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => (
                <span
                  key={cat}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.other}`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                  <span className="opacity-80">{formatMoney(amt)}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Property cards */}
      <div>
        <h3 className="font-bold text-slate-800 text-xl mb-4 flex items-center gap-2">
          <Home className="w-6 h-6 text-indigo-600" />
          Properties &amp; Units
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {summary.byProperty.map((row, idx) => {
            const grad = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
            const img = row.imageUrl || properties.find((p) => p.id === row.propertyId)?.image || FALLBACK_PROPERTY_IMAGE;
            const expanded = expandedProperty === row.propertyId;
            return (
              <div
                key={row.propertyId}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="relative h-40 sm:h-44">
                  <img src={img} alt={row.propertyName} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${grad} opacity-75 mix-blend-multiply`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h4 className="text-xl font-bold">{row.propertyName}</h4>
                    {(row.address || row.city) && (
                      <p className="text-sm text-white/85 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {[row.address, row.city, row.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/20 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold text-white">
                    {row.unitsCount || row.units?.length || 0} units
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 rounded-xl bg-emerald-50">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-bold">Income</p>
                      <p className="font-bold text-emerald-800 text-sm sm:text-base">{formatMoney(row.totalIncome)}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-rose-50">
                      <p className="text-[10px] uppercase tracking-wide text-rose-600 font-bold">Expenses</p>
                      <p className="font-bold text-rose-800 text-sm sm:text-base">{formatMoney(row.totalExpenses)}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-indigo-50">
                      <p className="text-[10px] uppercase tracking-wide text-indigo-600 font-bold">NOI</p>
                      <p className={`font-bold text-sm sm:text-base ${row.netIncome >= 0 ? 'text-indigo-800' : 'text-rose-700'}`}>
                        {formatMoney(row.netIncome)}
                      </p>
                    </div>
                  </div>

                  {isAdmin && row.financials && (
                    <div className="mb-4 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-2">
                        <Lock className="w-3.5 h-3.5" />
                        Admin — Financing &amp; Ownership
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-slate-400">Purchase Price</span><span>{formatMoney(row.financials.purchasePrice)}</span>
                        <span className="text-slate-400">Monthly Mortgage</span><span>{formatMoney(row.financials.monthlyMortgagePayment)}</span>
                        <span className="text-slate-400">Loan Amount</span><span>{formatMoney(row.financials.loanAmount)}</span>
                        <span className="text-slate-400">Interest Rate</span><span>{(row.financials.interestRate * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedProperty(expanded ? null : row.propertyId)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-colors"
                  >
                    <span>Unit breakdown ({row.units?.length || 0})</span>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expanded && (
                    <div className="mt-3 space-y-2">
                      {(row.units?.length ? row.units : []).length === 0 ? (
                        <p className="text-sm text-slate-500 px-2 py-3 text-center bg-slate-50 rounded-xl">
                          No units configured yet. Add units under property setup to track per-door income.
                        </p>
                      ) : (
                        row.units!.map((unit) => (
                          <div key={unit.unitId} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50">
                            <div>
                              <p className="font-semibold text-slate-800">{unit.label}</p>
                              <p className="text-xs text-slate-500 capitalize">{unit.status} · Rent {formatMoney(unit.monthlyRent)}/mo</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-emerald-700 font-semibold">{formatMoney(unit.rentIncome)}</p>
                              <p className={`text-xs font-medium ${unit.netIncome >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                NOI {formatMoney(unit.netIncome)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add expense + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-lg">Record Expense</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={expenseForm.property} onChange={(e) => setExpenseForm((p) => ({ ...p, property: e.target.value }))}>
              <option value="">Portfolio (all properties)</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value as OperatingExpense['category'] }))}>
              {Object.entries(CATEGORY_LABELS)
                .filter(([k]) => isAdmin || !['mortgage_interest', 'mortgage_principal', 'depreciation'].includes(k))
                .map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
            </select>
            {isAdmin && (
              <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm sm:col-span-2" value={expenseForm.visibility} onChange={(e) => setExpenseForm((p) => ({ ...p, visibility: e.target.value as OperatingExpense['visibility'] }))}>
                <option value="operating">Operating (visible to managers)</option>
                <option value="admin_only">Admin only (mortgage / financing)</option>
              </select>
            )}
            <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm" type="number" min="0" step="0.01" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} />
            <input className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Notes (optional)" value={expenseForm.notes} onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))} />
          <button disabled={saving || !expenseForm.amount} onClick={addExpense} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-50 hover:from-indigo-700 hover:to-purple-700 transition-all">
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-4">Recent Expenses ({year})</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredExpenses.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No expenses recorded yet.</p>
            ) : filteredExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">
                    {e.propertyName || 'Portfolio'}
                    {e.unitLabel ? ` · ${e.unitLabel}` : ''}
                    {' · '}{CATEGORY_LABELS[e.category] || e.category}
                  </p>
                  <p className="text-xs text-slate-500">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
                </div>
                <p className="font-bold text-sm text-rose-700 ml-3 flex-shrink-0">{formatMoney(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeStatementView;
