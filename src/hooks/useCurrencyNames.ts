import { useMemo } from 'react';
import { SUPPORTED_CURRENCIES, useI18n, type Currency } from '../i18n';

/** Localised currency names ("Brazilian Real" / "Real brasileiro") for the supported currencies. */
export function useCurrencyNames(): Record<Currency, string> {
  const { locale } = useI18n();
  return useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([locale], { type: 'currency' });
    } catch {
      dn = null;
    }
    return Object.fromEntries(SUPPORTED_CURRENCIES.map((c) => [c, dn?.of(c) ?? c])) as Record<Currency, string>;
  }, [locale]);
}
