import { BarChart3 } from 'lucide-react';
import { analyticsAvailable, setAnalyticsConsent, useAnalyticsConsent } from '../analytics';
import { useI18n } from '../i18n';
import { Button } from './ui';

/** Asks once whether usage analytics may run. Nothing is loaded or sent before "Accept". */
export default function ConsentBanner() {
  const { t } = useI18n();
  const consent = useAnalyticsConsent();
  if (!analyticsAvailable || consent !== null) return null;

  return (
    <section
      role="region"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-safe sm:left-4 sm:right-auto sm:bottom-4 sm:max-w-md sm:p-0"
    >
      <div className="rounded-card border border-line bg-surface p-4 shadow-overlay">
        <div className="flex gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <div className="space-y-1">
            <h2 id="consent-title" className="text-sm font-semibold text-fg">
              {t('consent.title')}
            </h2>
            <p className="text-sm text-fg-muted">{t('consent.body')}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAnalyticsConsent('denied')}>
            {t('consent.decline')}
          </Button>
          <Button size="sm" onClick={() => setAnalyticsConsent('granted')}>
            {t('consent.accept')}
          </Button>
        </div>
      </div>
    </section>
  );
}
