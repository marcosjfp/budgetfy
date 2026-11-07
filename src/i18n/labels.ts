import type { TranslationKey } from './core';

/**
 * Maps stored data values (which stay in English in the DB) to display keys.
 * Translate only at render time: `t(CATEGORY_KEYS[cat])`.
 */
export const CATEGORY_KEYS: Record<string, TranslationKey> = {
  Food: 'category.food',
  Rent: 'category.rent',
  Utilities: 'category.utilities',
  Transport: 'category.transport',
  Entertainment: 'category.entertainment',
  Shopping: 'category.shopping',
  Health: 'category.health',
  Travel: 'category.travel',
  Other: 'category.other',
};

export const GROUP_TYPE_KEYS: Record<string, TranslationKey> = {
  household: 'groupType.household',
  trip: 'groupType.trip',
  personal: 'groupType.personal',
  other: 'groupType.other',
  custom: 'groupType.custom',
};

export const BUDGET_FREQ_KEYS: Record<string, TranslationKey> = {
  weekly: 'budgetFreq.weekly',
  monthly: 'budgetFreq.monthly',
  total: 'budgetFreq.total',
};

export const BUDGET_PERIOD_KEYS: Record<string, TranslationKey> = {
  weekly: 'budgetPeriod.weekly',
  monthly: 'budgetPeriod.monthly',
  total: 'budgetPeriod.total',
};

export const STATUS_KEYS: Record<string, TranslationKey> = {
  paid: 'status.paid',
  pending: 'status.pending',
};

export const ROLE_KEYS: Record<string, TranslationKey> = {
  admin: 'role.admin',
  member: 'role.member',
};

export const SPLIT_KEYS: Record<string, TranslationKey> = {
  equal: 'split.equal',
  percentage: 'split.percentage',
  exact: 'split.exact',
};

export const SPLIT_BADGE_KEYS: Record<string, TranslationKey> = {
  equal: 'split.badge.equal',
  percentage: 'split.badge.percentage',
  exact: 'split.badge.exact',
};

export const SORT_KEYS: Record<string, TranslationKey> = {
  date: 'sort.date',
  amount: 'sort.amount',
  category: 'sort.category',
};

export const COLOR_KEYS: Record<string, TranslationKey> = {
  Indigo: 'color.indigo',
  Rose: 'color.rose',
  Amber: 'color.amber',
  Emerald: 'color.emerald',
  Cyan: 'color.cyan',
  Violet: 'color.violet',
  Pink: 'color.pink',
  Slate: 'color.slate',
};
