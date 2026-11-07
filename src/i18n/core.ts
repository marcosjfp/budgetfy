import { en, type Dictionary } from './en';
import { pt } from './pt';

export type Lang = 'en' | 'pt';
export const LANGS: Lang[] = ['en', 'pt'];
export const STORAGE_KEY = 'budgetfy_lang';

/** BCP 47 locale used for Intl formatting per language. */
export const LOCALES: Record<Lang, string> = {
  en: 'en-US',
  pt: 'pt-BR',
};

/**
 * Default currency per language, used ONLY on first run to seed the user's
 * currency preference. After that the currency is an independent setting
 * (amounts are stored without a currency, so switching language must not
 * change what an amount means).
 */
export const DEFAULT_CURRENCY_FOR_LANG: Record<Lang, Currency> = {
  en: 'USD',
  pt: 'BRL',
};
/** @deprecated use DEFAULT_CURRENCY_FOR_LANG / getCurrency() */
export const CURRENCIES = DEFAULT_CURRENCY_FOR_LANG;

export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const CURRENCY_STORAGE_KEY = 'budgetfy_currency';

const DICTIONARIES: Record<Lang, Dictionary> = { en, pt };

type RawKey = keyof Dictionary;
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralBase<K> = K extends `${infer B}_${PluralSuffix}` ? B : never;
/** Any key in the dictionary, plus the base name of pluralised keys. */
export type TranslationKey = RawKey | PluralBase<RawKey>;
export type TranslationVars = Record<string, string | number>;

// ---------------------------------------------------------------------------
// Current language (module-level so non-React code can translate too)
// ---------------------------------------------------------------------------

export function detectLanguage(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    // localStorage unavailable
  }
  return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

let currentLang: Lang = detectLanguage();

function isCurrency(v: unknown): v is Currency {
  return typeof v === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(v);
}

/** Saved currency, or (first run) the default for the detected language, persisted. */
export function detectCurrency(): Currency {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY_FOR_LANG[currentLang];
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isCurrency(saved)) return saved;
    const initial = DEFAULT_CURRENCY_FOR_LANG[currentLang];
    localStorage.setItem(CURRENCY_STORAGE_KEY, initial);
    return initial;
  } catch {
    return DEFAULT_CURRENCY_FOR_LANG[currentLang];
  }
}

let currentCurrency: Currency = detectCurrency();

export function getCurrency(): Currency {
  return currentCurrency;
}

export function setCurrentCurrency(currency: Currency) {
  currentCurrency = currency;
}

export function getLang(): Lang {
  return currentLang;
}

export function setCurrentLang(lang: Lang) {
  currentLang = lang;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

const pluralRulesCache = new Map<string, Intl.PluralRules>();
function pluralRules(lang: Lang) {
  const locale = LOCALES[lang];
  let pr = pluralRulesCache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, pr);
  }
  return pr;
}

function lookup(lang: Lang, key: string): string | undefined {
  return (DICTIONARIES[lang] as Record<string, string>)[key];
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Resolve a key to its raw template (handles plurals and fallback to English,
 * then to the key itself).
 */
function resolveTemplate(lang: Lang, key: string, vars?: TranslationVars): string {
  if (vars && typeof vars.count === 'number') {
    const category = pluralRules(lang).select(vars.count);
    const plural =
      lookup(lang, `${key}_${category}`) ??
      lookup(lang, `${key}_other`) ??
      lookup('en', `${key}_${new Intl.PluralRules('en-US').select(vars.count)}`) ??
      lookup('en', `${key}_other`);
    if (plural !== undefined) return plural;
  }
  return lookup(lang, key) ?? lookup('en', key) ?? key;
}

export function translate(lang: Lang, key: TranslationKey, vars?: TranslationVars): string {
  return interpolate(resolveTemplate(lang, key, vars), vars);
}

/** Translate using the current module-level language (for non-React code). */
export function t(key: TranslationKey, vars?: TranslationVars): string {
  return translate(currentLang, key, vars);
}

/**
 * Split a translated template into parts so that some variables can be
 * React nodes (e.g. bold names). Returns an array of strings and the
 * provided node values, in order.
 */
export function translateParts<T>(
  lang: Lang,
  key: TranslationKey,
  vars: Record<string, T | string | number>,
): (string | T)[] {
  const template = resolveTemplate(lang, key, Object.fromEntries(
    Object.entries(vars).filter(([, v]) => typeof v === 'number'),
  ) as TranslationVars);
  const parts: (string | T)[] = [];
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push(template.slice(last, m.index));
    const name = m[1];
    if (name in vars) {
      const v = vars[name];
      parts.push(typeof v === 'number' ? String(v) : (v as T | string));
    } else {
      parts.push(m[0]);
    }
    last = re.lastIndex;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

// ---------------------------------------------------------------------------
// Formatting (Intl, locale-aware)
// ---------------------------------------------------------------------------

export function formatCurrency(
  lang: Lang,
  amount: number,
  options: Intl.NumberFormatOptions = {},
  currency: Currency = currentCurrency,
): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

export function currencySymbol(lang: Lang, currency: Currency = currentCurrency): string {
  const part = new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency,
  })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? '$';
}

export function formatNumber(lang: Lang, value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(LOCALES[lang], options).format(value);
}

export function formatDate(lang: Lang, date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(LOCALES[lang], options).format(date);
}

export function formatDateRange(
  lang: Lang,
  start: Date,
  end: Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const fmt = new Intl.DateTimeFormat(LOCALES[lang], options) as Intl.DateTimeFormat & {
    formatRange?: (a: Date, b: Date) => string;
  };
  if (typeof fmt.formatRange === 'function') return fmt.formatRange(start, end);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Uppercase the first letter (pt-BR month names are lowercase by default). */
export function capitalize(s: string, lang: Lang = currentLang): string {
  return s ? s.charAt(0).toLocaleUpperCase(LOCALES[lang]) + s.slice(1) : s;
}
