import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, Building2, Wallet, ChevronDown, ChevronUp,
  Lock, MapPin, Home, BarChart3, Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { IncomeStatementSummary, OperatingExpense, Property } from '../types';
import {
  CATEGORY_LABELS,
  groupIncomeStatementProperties,
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

const FALLBACK_PROPERTY_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

const IncomeStatementView: React.FC<Props> = ({ properties }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<IncomeStatementSummary | null>(null);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);

  const load = async (selectedYear: number) => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setExpenses([]);
    try {
      const statement = await api.getIncomeStatement(selectedYear);
      setSummary(statement);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load income statement');
    } finally {
      setLoading(false);
    }

    setExpensesLoading(true);
    api.getOperatingExpenses({ year: selectedYear, limit: 20 })
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setExpensesLoading(false));
  };

  useEffect(() => {
    load(year);
  }, [year]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date).getFullYear() === year).slice(0, 20),
    [expenses, year]
  );

  const maxMonthly = useMemo(() => {
    if (!summary?.monthly?.length) return 1;
    return Math.max(...summary.monthly.map((m) => Math.max(m.income, m.expenses)), 1);
  }, [summary]);

  const groupedProperties = useMemo(() => {
    if (!summary?.byProperty?.length) return [];
    return groupIncomeStatementProperties(summary.byProperty, properties);
  }, [summary, properties]);

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

      <div>
        <h3 className="font-bold text-slate-800 text-xl mb-4 flex items-center gap-2">
          <Home className="w-6 h-6 text-indigo-600" />
          Properties &amp; Units
        </h3>
        <div className="flex flex-col gap-4 max-w-4xl">
          {groupedProperties.map((row) => {
            const img =
              row.imageUrl ||
              properties.find((p) => row.units?.some((u) => u.propertyId === p.id))?.image ||
              FALLBACK_PROPERTY_IMAGE;
            const expanded = expandedProperty === row.groupKey;
            const unitCount = row.units?.length || 0;

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
                      {unitCount > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedProperty(expanded ? null : row.groupKey)}
                            className="inline-flex items-center justify-between gap-2 w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-colors"
                          >
                            <span>Units ({unitCount})</span>
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {expanded && (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {row.units!.map((unit) => (
                                <div
                                  key={unit.unitId}
                                  className="flex items-center justify-between text-xs sm:text-sm px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100"
                                >
                                  <span className="font-semibold text-slate-800">{unit.label}</span>
                                  <span className="text-emerald-700 font-medium">{formatMoney(unit.rentIncome)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: income / expenses / NOI */}
                  <div className="flex flex-col justify-center gap-2 md:w-52 lg:w-56 flex-shrink-0">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-bold">Income</p>
                      <p className="font-bold text-emerald-800 text-base sm:text-lg">{formatMoney(row.totalIncome)}</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-rose-600 font-bold">Expenses</p>
                      <p className="font-bold text-rose-800 text-base sm:text-lg">{formatMoney(row.totalExpenses)}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-indigo-600 font-bold">NOI</p>
                      <p className={`font-bold text-base sm:text-lg ${row.netIncome >= 0 ? 'text-indigo-800' : 'text-rose-700'}`}>
                        {formatMoney(row.netIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                {isAdmin && row.financials && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-2">
                      <Lock className="w-3.5 h-3.5" />
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
      </div>

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
                  <p className="text-xs text-slate-500">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
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
