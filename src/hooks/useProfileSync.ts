import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, USER_KEY } from '../api';
import { SUPPORTED_CURRENCIES, useI18n, type Currency, type Lang } from '../i18n';
import type { Theme } from './useTheme';

export interface Preferences {
  language?: Lang;
  currency?: Currency;
  theme?: Theme;
}

export interface Profile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  preferences: Preferences;
}

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'pt';
const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(v);
const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

function sanitize(p: unknown): Preferences {
  const raw = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  return {
    ...(isLang(raw.language) ? { language: raw.language } : {}),
    ...(isCurrency(raw.currency) ? { currency: raw.currency } : {}),
    ...(isTheme(raw.theme) ? { theme: raw.theme } : {}),
  };
}

const SYNC_DEBOUNCE_MS = 600;

/**
 * Loads the signed-in user's server profile and keeps language / currency / theme in sync with it:
 * - on sign-in, preferences saved on the server win (so they follow the user across devices);
 *   anything the server doesn't have yet is uploaded from this device;
 * - afterwards, local changes are sent to the server (debounced).
 * localStorage remains the fallback when offline or when the API is unavailable.
 */
export function useProfileSync(uid: string | null, theme: Theme, setTheme: (t: Theme) => void) {
  const { lang, setLang, currency, setCurrency } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const ready = useRef(false);
  const lastSent = useRef<Preferences>({});
  const local = useRef<Required<Preferences>>({ language: lang, currency, theme });
  local.current = { language: lang, currency, theme };

  useEffect(() => {
    ready.current = false;
    setProfile(null);
    if (!uid) return;
    let cancelled = false;
    let retry: number | undefined;

    const load = async (attempt: number) => {
      try {
        const me = (await apiFetch('/users/me')) as Profile;
        if (cancelled) return;
        const server = sanitize(me?.preferences);
        lastSent.current = { ...server };
        if (server.language && server.language !== local.current.language) setLang(server.language);
        if (server.currency && server.currency !== local.current.currency) setCurrency(server.currency);
        if (server.theme && server.theme !== local.current.theme) setTheme(server.theme);
        setProfile({ ...me, preferences: server });
        ready.current = true;

        // Upload whatever the server doesn't know yet (first sign-in after this feature shipped).
        const missing: Preferences = {};
        (['language', 'currency', 'theme'] as const).forEach((k) => {
          if (server[k] === undefined) (missing as Record<string, string>)[k] = local.current[k];
        });
        if (Object.keys(missing).length) {
          lastSent.current = { ...lastSent.current, ...missing };
          apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ preferences: missing }) }).catch((err) =>
            console.warn('[prefs] could not save preferences', err),
          );
        }
      } catch (err) {
        // A brand-new Firebase user may not exist server-side until /users/sync finishes.
        if (!cancelled && err instanceof ApiError && err.status === 404 && attempt < 3) {
          retry = window.setTimeout(() => load(attempt + 1), 1000 * (attempt + 1));
        } else if (!cancelled) {
          console.warn('[prefs] profile unavailable; using this device’s settings', err);
        }
      }
    };
    load(0);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Push local changes (from Preferences, the language switcher, the theme toggle…).
  useEffect(() => {
    if (!ready.current) return;
    const current: Required<Preferences> = { language: lang, currency, theme };
    const changes: Preferences = {};
    (['language', 'currency', 'theme'] as const).forEach((k) => {
      if (current[k] !== lastSent.current[k]) (changes as Record<string, string>)[k] = current[k];
    });
    if (!Object.keys(changes).length) return;
    const timer = window.setTimeout(() => {
      lastSent.current = { ...lastSent.current, ...changes };
      apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ preferences: changes }) }).catch((err) =>
        console.warn('[prefs] could not save preferences', err),
      );
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [lang, currency, theme]);

  /** Rename the current user (server validates: 1–100 chars). Throws ApiError on failure. */
  const updateDisplayName = useCallback(async (displayName: string) => {
    const me = (await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName }) })) as Profile;
    setProfile((p) => ({ ...(p ?? me), ...me, preferences: sanitize(me?.preferences) }));
    // Keep the cached local session user in sync so a reload shows the new name immediately.
    try {
      const cached = localStorage.getItem(USER_KEY);
      if (cached) localStorage.setItem(USER_KEY, JSON.stringify({ ...JSON.parse(cached), displayName: me.displayName }));
    } catch {
      // ignore
    }
    return me;
  }, []);

  return { profile, updateDisplayName };
}
