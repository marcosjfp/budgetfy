/**
 * Lazy Amplitude loader.
 *
 * `@amplitude/unified` (with session replay) is a large chunk, so it is no longer part of the
 * initial bundle: `initAnalytics()` dynamically imports it once the browser is idle after the
 * first render. The init options are unchanged (EU zone, autocapture, session replay 100%).
 * `track()` calls made before the SDK is ready are queued and replayed, in order, after init.
 */
type AmplitudeModule = typeof import('@amplitude/unified');

let sdk: Promise<AmplitudeModule> | null = null;

export function initAnalytics(): Promise<AmplitudeModule> {
  if (!sdk) {
    sdk = import('@amplitude/unified').then((amplitude) => {
      const amplitudeKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
      if (!amplitudeKey) {
        console.error('[amplitude] VITE_AMPLITUDE_API_KEY is not set — no events will be sent');
      } else {
        amplitude.initAll(amplitudeKey, {
          serverZone: 'EU',
          analytics: { autocapture: true },
          sessionReplay: { sampleRate: 1 },
        });
      }
      return amplitude;
    });
  }
  return sdk;
}

/** Start loading analytics once the page is idle (falls back to a short timeout). */
export function initAnalyticsWhenIdle() {
  const start = () => {
    initAnalytics().catch((err) => console.error('[amplitude] failed to load', err));
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 4000 });
  else window.setTimeout(start, 1500);
}

/** Same signature as Amplitude's `track`; safe to call before the SDK has loaded. */
export function track(...args: Parameters<AmplitudeModule['track']>): void {
  initAnalytics()
    .then((amplitude) => amplitude.track(...args))
    .catch(() => undefined);
}
