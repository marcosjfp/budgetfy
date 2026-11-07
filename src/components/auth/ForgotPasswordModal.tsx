import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { authFetch, describeError } from '../../api';
import { useI18n } from '../../i18n';
import { Button, Modal, TextField } from '../ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the email typed on the sign-in form. */
  initialEmail: string;
}

/** "Forgot password?": asks for the email and sends a reset link (same answer whether or not it exists). */
export function ForgotPasswordModal({ open, onClose, initialEmail }: ForgotPasswordModalProps) {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(open);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setEmail(initialEmail);
      setError(undefined);
      setSentTo(null);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t('validation.emailInvalid'));
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      await authFetch('/auth/forgot-password', { email: value, lang });
      setSentTo(value);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('forgot.title')}
      description={sentTo ? undefined : t('forgot.description')}
      size="sm"
      footer={
        sentTo ? (
          <Button onClick={onClose} data-autofocus>
            {t('common.done')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="forgot-password-form" loading={sending}>
              {t('forgot.send')}
            </Button>
          </>
        )
      }
    >
      {sentTo ? (
        <div className="flex gap-3 rounded-card bg-surface-2 p-4" role="status">
          <MailCheck className="size-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <p className="text-sm text-fg">{t('forgot.sent', { email: sentTo })}</p>
        </div>
      ) : (
        <form id="forgot-password-form" onSubmit={submit} noValidate>
          <TextField
            type="email"
            label={t('auth.email')}
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
            error={error}
            required
            data-autofocus
          />
        </form>
      )}
    </Modal>
  );
}
