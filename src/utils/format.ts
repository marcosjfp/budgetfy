import {
  getLang,
  formatCurrency as coreFormatCurrency,
  formatDate as coreFormatDate,
} from '../i18n/core';

/**
 * Locale-aware currency formatting: number format follows the active language
 * (en-US / pt-BR); the currency is the user's preference (see i18n/core.ts
 * getCurrency), independent of language. Includes the currency symbol.
 * Inside React components prefer `useI18n().formatCurrency` so the UI
 * re-renders when the language changes.
 */
export const formatCurrency = (amount: number, options?: Intl.NumberFormatOptions): string =>
  coreFormatCurrency(getLang(), amount, options);

export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions): string =>
  coreFormatDate(getLang(), date, options);
