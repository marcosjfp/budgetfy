import { useState } from 'react';
import type { Group } from '../../types';
import { useI18n, BUDGET_PERIOD_KEYS, type TranslationKey } from '../../i18n';
import { Button, Card, Modal, cn } from '../ui';

interface GroupStatsProps {
  group: Group;
  totalSpent: number;
  userShare: number;
  balance: number;
  paidPct: number;
}

interface StatDetail {
  title: TranslationKey;
  amount: number;
  paidPct?: string;
}

export function GroupStats({ group, totalSpent, userShare, balance, paidPct }: GroupStatsProps) {
  const { t, label, formatCurrency, formatNumber } = useI18n();
  const [detail, setDetail] = useState<StatDetail | null>(null);

  const pctText = formatNumber(paidPct, { maximumFractionDigits: 0 });
  const budgetRatio = group.maxBudget ? totalSpent / group.maxBudget : 0;
  const over = !!group.maxBudget && totalSpent > group.maxBudget;
  const balanceTitle: TranslationKey = balance >= 0 ? 'group.youAreOwed' : 'group.youOwe';

  const tile = 'w-full h-full p-4 sm:p-5';

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8" aria-label={t('group.summary')}>
        <li>
          <Card as="button" type="button" interactive padding="none" className={tile} onClick={() => setDetail({ title: 'group.totalSpend', amount: totalSpent })}>
            <span className="block eyebrow">{t('group.totalSpend')}</span>
            <span className="mt-1 block text-2xl 2xl:text-3xl font-semibold font-display tracking-tight text-fg tabular break-words">{formatCurrency(totalSpent)}</span>
            {group.maxBudget ? (
              <span className="mt-4 block">
                <span className="flex justify-between gap-2 text-xs font-medium mb-1.5">
                  <span className="text-fg-subtle">{t('group.budgetWithPeriod', { period: label(BUDGET_PERIOD_KEYS, group.budgetType) })}</span>
                  <span className={over ? 'text-red-700 dark:text-red-300' : 'text-brand-700 dark:text-brand-300'}>
                    {formatNumber(budgetRatio, { style: 'percent', maximumFractionDigits: 0 })}
                  </span>
                </span>
                <span
                  role="progressbar"
                  aria-label={t('group.budgetUsed')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(100, budgetRatio * 100))}
                  aria-valuetext={t('group.spentOfLimit', { spent: formatCurrency(totalSpent), limit: formatCurrency(group.maxBudget) })}
                  className="block h-2 rounded-full bg-surface-3 overflow-hidden"
                >
                  <span
                    className={cn('block h-full rounded-full transition-[width] duration-700 ease-out', over ? 'bg-red-600' : budgetRatio > 0.8 ? 'bg-amber-500' : 'bg-brand-600')}
                    style={{ width: `${Math.min(100, budgetRatio * 100)}%` }}
                  />
                </span>
                <span className="mt-1.5 block text-xs text-fg-subtle tabular">
                  {t('group.spentOfLimit', { spent: formatCurrency(totalSpent), limit: formatCurrency(group.maxBudget) })}
                </span>
              </span>
            ) : null}
          </Card>
        </li>
        <li>
          <Card as="button" type="button" interactive padding="none" className={tile} onClick={() => setDetail({ title: 'group.yourShare', amount: userShare, paidPct: pctText })}>
            <span className="block eyebrow">{t('group.yourShare')}</span>
            <span className="mt-1 block text-2xl 2xl:text-3xl font-semibold font-display tracking-tight text-fg tabular break-words">{formatCurrency(userShare)}</span>
            <span className="mt-2 block text-sm text-fg-subtle">{t('group.paidByYouPct', { pct: pctText })}</span>
          </Card>
        </li>
        <li>
          <Card as="button" type="button" interactive padding="none" className={tile} onClick={() => setDetail({ title: balanceTitle, amount: Math.abs(balance) })}>
            <span className="block eyebrow">{t(balanceTitle)}</span>
            <span
              className={cn(
                'mt-1 block text-2xl 2xl:text-3xl font-semibold font-display tracking-tight tabular break-words',
                balance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
              )}
            >
              {formatCurrency(Math.abs(balance))}
            </span>
            <span className="mt-2 block text-sm text-fg-subtle">{balance >= 0 ? t('group.balancePositiveHint') : t('group.balanceNegativeHint')}</span>
          </Card>
        </li>
      </ul>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="sm"
        centered
        title={detail ? t(detail.title) : ''}
        footer={
          <Button onClick={() => setDetail(null)} data-autofocus>
            {t('common.close')}
          </Button>
        }
      >
        {detail && (
          <div className="text-center pb-2">
            <p className="text-4xl sm:text-5xl font-semibold font-display tracking-tight text-fg tabular break-all">{formatCurrency(detail.amount)}</p>
            {detail.paidPct !== undefined && <p className="mt-3 text-sm text-fg-muted">{t('group.paidByYouPct', { pct: detail.paidPct })}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
