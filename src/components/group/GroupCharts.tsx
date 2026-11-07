import { useMemo } from 'react';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Expense, Group } from '../../types';
import { useI18n, CATEGORY_KEYS, BUDGET_PERIOD_KEYS } from '../../i18n';
import type { Theme } from '../../hooks/useTheme';
import { Card, CardHeader, EmptyState, cn } from '../ui';
import { CHART_COLORS } from './groupMath';

interface GroupChartsProps {
  group: Group;
  expenses: Expense[];
  periodExpenses: Expense[];
  theme: Theme;
}

/** Spending charts for a group. Lazy-loaded (Recharts is the heaviest dependency). */
export default function GroupCharts({ group, expenses, periodExpenses, theme }: GroupChartsProps) {
  const { t, label, formatCurrency, formatDate, formatNumber, capitalize } = useI18n();
  const dark = theme === 'dark';
  const axis = dark ? '#a1a1aa' : '#52525b';
  const grid = dark ? '#27272a' : '#e4e4e7';
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${grid}`,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
    padding: '8px 12px',
    backgroundColor: dark ? '#18181b' : '#ffffff',
    color: dark ? '#fafafa' : '#18181b',
    fontSize: 13,
  };
  const compact = (v: number) => formatCurrency(v, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });

  const lineData = useMemo(() => {
    if (group.budgetType !== 'weekly' && group.budgetType !== 'monthly') return [];
    const year = new Date().getFullYear();
    const data: { name: string; amount: number }[] = [];
    if (group.budgetType === 'weekly') {
      const jan1 = new Date(year, 0, 1);
      const start = new Date(jan1);
      start.setDate(jan1.getDate() - jan1.getDay());
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < 52; i++) {
        const ws = new Date(start);
        ws.setDate(start.getDate() + i * 7);
        const we = new Date(ws);
        we.setDate(ws.getDate() + 7);
        const amount = expenses
          .filter((e) => {
            const d = e.date.toDate();
            return d >= ws && d < we && d.getFullYear() === year;
          })
          .reduce((s, e) => s + e.amount, 0);
        data.push({ name: t('chart.weekShort', { n: i + 1 }), amount });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const amount = expenses
          .filter((e) => {
            const d = e.date.toDate();
            return d.getMonth() === m && d.getFullYear() === year;
          })
          .reduce((s, e) => s + e.amount, 0);
        data.push({ name: capitalize(formatDate(new Date(year, m, 1), { month: 'short' }).replace(/\.$/, '')), amount });
      }
    }
    return data;
  }, [group.budgetType, expenses, t, formatDate, capitalize]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    periodExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: label(CATEGORY_KEYS, name), value }))
      .sort((a, b) => b.value - a.value);
  }, [periodExpenses, label]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const { barData, monthTotal } = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();
    expenses
      .filter((e) => {
        const d = e.date.toDate();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return {
      monthTotal: total,
      barData: Array.from(map.entries())
        .map(([name, value]) => ({ name: label(CATEGORY_KEYS, name), value, percentage: total > 0 ? (value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value),
    };
  }, [expenses, label]);

  // Text alternatives for screen readers.
  const pct = (v: number) => formatNumber(v, { style: 'percent', maximumFractionDigits: 0 });
  const pieSummary = pieData.map((d) => `${d.name}: ${formatCurrency(d.value)} (${pct(pieTotal ? d.value / pieTotal : 0)})`).join('; ');
  const barSummary = barData.map((d) => `${d.name}: ${formatCurrency(d.value)}`).join('; ');
  const peak = lineData.reduce<{ name: string; amount: number } | null>((best, d) => (!best || d.amount > best.amount ? d : best), null);
  const lineSummary = peak
    ? t('chart.trendSummary', { total: formatCurrency(lineData.reduce((s, d) => s + d.amount, 0)), peak: peak.name, peakAmount: formatCurrency(peak.amount) })
    : '';

  const showTrend = lineData.length > 0;

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:gap-6 mb-8', showTrend ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2')}>
      {showTrend && (
        <Card as="section" className="min-w-0">
          <CardHeader as="h3" icon={<TrendingUp className="size-4" />} title={t('group.spendingTrend', { period: label(BUDGET_PERIOD_KEYS, group.budgetType) })} />
          <p className="sr-only">{lineSummary}</p>
          <div className="h-60 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={lineData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axis }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axis }} tickFormatter={compact} width={76} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: axis, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), t('chart.spent')]} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: dark ? '#18181b' : '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card as="section" className="min-w-0">
        <CardHeader as="h3" icon={<PieChartIcon className="size-4" />} title={t('group.categoryDistribution')} />
        {pieData.length > 0 ? (
          <>
            <p className="sr-only">{pieSummary}</p>
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
              <div className="h-44 w-44 shrink-0" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2} dataKey="value" stroke={dark ? '#18181b' : '#fff'} strokeWidth={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v), t('chart.total')]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm" aria-hidden="true">
                {pieData.slice(0, 6).map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate text-fg-muted">{d.name}</span>
                    </span>
                    <span className="text-fg-subtle tabular">{pct(pieTotal ? d.value / pieTotal : 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <EmptyState compact icon={<PieChartIcon />} title={t('group.noExpensesPeriod')} />
        )}
      </Card>

      <Card as="section" className="min-w-0 flex flex-col">
        <CardHeader
          as="h3"
          icon={<BarChart3 className="size-4" />}
          title={t('group.monthlyCategorySpend')}
          action={
            monthTotal > 0 ? (
              <div className="text-right">
                <p className="text-xs text-fg-subtle">{t('group.monthTotal')}</p>
                <p className="text-sm font-semibold text-fg tabular">{formatCurrency(monthTotal)}</p>
              </div>
            ) : undefined
          }
        />
        {barData.length > 0 ? (
          <>
            <p className="sr-only">{barSummary}</p>
            <div className="w-full" style={{ height: Math.max(120, barData.length * 32) }} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axis }} width={96} />
                  <Tooltip
                    cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ display: 'none' }}
                    formatter={(v: number) => [formatCurrency(v), t('chart.amount')]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm border-t border-line pt-3" aria-hidden="true">
              {barData.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate text-fg-muted">{c.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 tabular">
                    <span className="text-fg-subtle">{formatNumber(c.percentage / 100, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                    <span className="font-semibold text-fg">{formatCurrency(c.value)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState compact icon={<BarChart3 />} title={t('group.noExpensesMonth')} />
        )}
      </Card>
    </div>
  );
}
