/**
 * Consent-gated, lazy Amplitude loader.
 *
 * - Nothing is loaded or sent until the user accepts analytics (GDPR / LGPD). The choice is stored
 *   on this device and can be changed in Preferences.
 * - `@amplitude/unified` is a large chunk, so it is only imported after consent, once the page is idle.
 * - Session replay masks all text and numbers ('conservative'), so amounts, names and emails are never recorded.
 * - `track()` calls made before the SDK is ready are queued; without consent they are dropped.
 */
import { useSyncExternalStore } from 'react';

type AmplitudeModule = typeof import('@amplitude/unified');
export type AnalyticsConsent = 'granted' | 'denied';

const CONSENT_KEY = 'budgetfy_analytics_consent';
const CONSENT_EVENT = 'budgetfy:analytics-consent';

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage unavailable (private mode): the choice only lasts for this page.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));

  if (consent === 'granted') {
    initAnalytics()
      .then((amplitude) => amplitude.setOptOut(false))
      .catch((err) => console.error('[amplitude] failed to load', err));
  } else if (sdk) {
    // Already loaded in this tab: stop sending events and replays immediately.
    sdk.then((amplitude) => amplitude.setOptOut(true)).catch(() => undefined);
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current consent choice (null = not asked yet), kept in sync across components and tabs. */
export function useAnalyticsConsent(): AnalyticsConsent | null {
  return useSyncExternalStore(subscribe, getAnalyticsConsent, () => null);
}

/** True when an Amplitude key is configured for this build (otherwise no banner is shown). */
export const analyticsAvailable = Boolean(import.meta.env.VITE_AMPLITUDE_API_KEY);

let sdk: Promise<AmplitudeModule> | null = null;

function initAnalytics(): Promise<AmplitudeModule> {
  if (!sdk) {
    sdk = import('@amplitude/unified').then((amplitude) => {
      const amplitudeKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
      if (!amplitudeKey) {
        console.warn('[amplitude] VITE_AMPLITUDE_API_KEY is not set — no events will be sent');
      } else {
        amplitude.initAll(amplitudeKey, {
          serverZone: 'EU',
          analytics: { autocapture: true },
          sessionReplay: {
            sampleRate: 1,
            // Mask every text node and input: replays show layout and interactions only.
            privacyConfig: { defaultMaskLevel: 'conservative' },
          },
        });
      }
      return amplitude;
    });
  }
  return sdk;
}

/** Load analytics once the page is idle, only if the user has accepted it. */
export function initAnalyticsWhenIdle() {
  if (!analyticsAvailable || getAnalyticsConsent() !== 'granted') return;
  const start = () => {
    initAnalytics().catch((err) => console.error('[amplitude] failed to load', err));
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 4000 });
  else window.setTimeout(start, 1500);
}

/** Same signature as Amplitude's `track`; safe to call any time. Dropped without consent. */
export function track(...args: Parameters<AmplitudeModule['track']>): void {
  if (getAnalyticsConsent() !== 'granted') return;
  initAnalytics()
    .then((amplitude) => amplitude.track(...args))
    .catch(() => undefined);
}
