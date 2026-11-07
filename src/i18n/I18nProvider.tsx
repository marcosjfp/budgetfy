import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Lang,
  type TranslationKey,
  type TranslationVars,
  LOCALES,
  STORAGE_KEY,
  CURRENCY_STORAGE_KEY,
  type Currency,
  getLang,
  getCurrency,
  setCurrentCurrency,
  setCurrentLang,
  translate,
  translateParts,
  formatCurrency as coreFormatCurrency,
  formatNumber as coreFormatNumber,
  formatDate as coreFormatDate,
  formatDateRange as coreFormatDateRange,
  currencySymbol as coreCurrencySymbol,
  capitalize as coreCapitalize,
} from './core';
import { translateApiError, translateServerError, type ApiErrorLike } from './serverErrors';

export interface I18nContextValue {
  lang: Lang;
  /** BCP 47 locale for the active language, e.g. 'pt-BR'. */
  locale: string;
  setLang: (lang: Lang) => void;
  /** Translate a key. Supports {{var}} interpolation and plurals via `count`. */
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  /** Like t(), but variables may be React nodes (e.g. <strong>name</strong>). */
  tRich: (key: TranslationKey, vars: Record<string, React.ReactNode>) => React.ReactNode;
  /** Translate a known API error message; unknown messages pass through. */
  tServerError: (message: string) => string;
  /** Translate an API error body `{ error, code, details }` (by code, then message). */
  tApiError: (err: ApiErrorLike) => string;
  /** Display currency (user preference, independent of language). */
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Translate a stored data value via a label map (falls back to the raw value). */
  label: (map: Record<string, TranslationKey>, value: string | undefined | null) => string;
  formatCurrency: (amount: number, options?: Intl.NumberFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateRange: (start: Date, end: Date, options?: Intl.DateTimeFormatOptions) => string;
  currencySymbol: string;
  capitalize: (s: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);
  const [currency, setCurrencyState] = useState<Currency>(getCurrency);

  // Keep module-level language in sync during render so non-React helpers
  // (errorHandling, ErrorBoundary) translate correctly.
  setCurrentLang(lang);
  setCurrentCurrency(currency);

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setLangState(next);
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrentCurrency(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setCurrencyState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = LOCALES[lang];
    document.title = translate(lang, 'app.documentTitle');
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TranslationKey, vars?: TranslationVars) => translate(lang, key, vars);
    return {
      lang,
      locale: LOCALES[lang],
      setLang,
      t,
      tRich: (key, vars) =>
        translateParts<React.ReactNode>(lang, key, vars as Record<string, React.ReactNode>).map((part, i) =>
          typeof part === 'string' ? part : <React.Fragment key={i}>{part}</React.Fragment>,
        ),
      tServerError: (message) => translateServerError(lang, message),
      tApiError: (err) => translateApiError(lang, err),
      currency,
      setCurrency,
      label: (map, value) => {
        if (!value) return '';
        const key = map[value];
        return key ? t(key) : value;
      },
      formatCurrency: (amount, options) => coreFormatCurrency(lang, amount, options, currency),
      formatNumber: (v, options) => coreFormatNumber(lang, v, options),
      formatDate: (d, options) => coreFormatDate(lang, d, options),
      formatDateRange: (a, b, options) => coreFormatDateRange(lang, a, b, options),
      currencySymbol: coreCurrencySymbol(lang, currency),
      capitalize: (s) => coreCapitalize(s, lang),
    };
  }, [lang, setLang, currency, setCurrency]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Overrides the display currency for a subtree (e.g. a group with its own currency), so every
 * formatCurrency()/currencySymbol below it uses that currency. The user's preference is untouched.
 */
export function CurrencyScope({ currency, children }: { currency: Currency | null | undefined; children: React.ReactNode }) {
  const parent = useContext(I18nContext);
  if (!parent) throw new Error('CurrencyScope must be used inside <I18nProvider>');
  const value = useMemo<I18nContextValue>(() => {
    if (!currency || currency === parent.currency) return parent;
    return {
      ...parent,
      currency,
      formatCurrency: (amount, options) => coreFormatCurrency(parent.lang, amount, options, currency),
      currencySymbol: coreCurrencySymbol(parent.lang, currency),
    };
  }, [parent, currency]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
