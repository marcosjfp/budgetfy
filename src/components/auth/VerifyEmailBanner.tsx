import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { apiFetch, describeError } from '../../api';
import { useI18n } from '../../i18n';
import { Button, toast } from '../ui';

/** Shown to signed-in users whose email isn't confirmed yet, with a "send again" button. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const { t, lang } = useI18n();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      await apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ lang }) });
      toast.success(t('verifyBanner.sent'), email);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div role="status" className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-card border border-amber-300/60 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10 p-4">
      <MailWarning className="size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p className="flex-1 text-sm text-amber-900 dark:text-amber-100">{t('verifyBanner.text', { email })}</p>
      <Button size="sm" variant="secondary" onClick={resend} loading={sending} className="shrink-0">
        {t('verifyBanner.resend')}
      </Button>
    </div>
  );
}
