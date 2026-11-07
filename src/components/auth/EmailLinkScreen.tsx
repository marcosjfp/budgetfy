import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, XCircle } from 'lucide-react';
import { authFetch, clearLocalSession, describeError } from '../../api';
import { useI18n, type TranslationKey } from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';
import { Button, IconButton, TextField } from '../ui';

/** Paths opened from email links. */
export type EmailLinkKind = 'verify' | 'reset';

export function emailLinkFromLocation(): { kind: EmailLinkKind; token: string } | null {
  const path = window.location.pathname.replace(/\/+$/, '');
  const kind: EmailLinkKind | null = path === '/verify-email' ? 'verify' : path === '/reset-password' ? 'reset' : null;
  const token = new URLSearchParams(window.location.search).get('token');
  return kind && token ? { kind, token } : null;
}

/** Back to the app's home (drops the token from the address bar). */
function goHome() {
  window.location.replace('/');
}

/** Mirrors server/validation.ts passwordSchema. */
function passwordProblem(p: string): TranslationKey | null {
  if (p.length < 8) return 'serverError.password.tooShort';
  if (new TextEncoder().encode(p).length > 72) return 'serverError.password.tooLong';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'serverError.password.letterAndNumber';
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-dialog border border-line bg-surface p-6 sm:p-8 shadow-card">{children}</div>
      </main>
    </div>
  );
}

function Result({ ok, title, body, action, onAction }: { ok: boolean; title: string; body: string; action: string; onAction: () => void }) {
  return (
    <div className="text-center space-y-4" role="status">
      {ok ? (
        <CheckCircle2 className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <XCircle className="mx-auto size-10 text-red-600 dark:text-red-400" aria-hidden="true" />
      )}
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="text-sm text-fg-muted">{body}</p>
      <Button onClick={onAction} fullWidth data-autofocus>
        {action}
      </Button>
    </div>
  );
}

function VerifyEmail({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<'working' | 'ok' | { error: string }>('working');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the token is single-use
    started.current = true;
    authFetch('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((err) => setState({ error: describeError(err) }));
  }, [token]);

  if (state === 'working') {
    return (
      <div className="flex items-center justify-center gap-3 py-6 text-fg-muted" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        {t('verify.working')}
      </div>
    );
  }
  return state === 'ok' ? (
    <Result ok title={t('verify.doneTitle')} body={t('verify.doneBody')} action={t('verify.continue')} onAction={goHome} />
  ) : (
    <Result ok={false} title={t('verify.failedTitle')} body={state.error} action={t('verify.continue')} onAction={goHome} />
  );
}

function ResetPassword({ token }: { token: string }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    const next = {
      password: problem ? t(problem) : undefined,
      confirm: !problem && confirm !== password ? t('reset.mismatch') : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setSaving(true);
    try {
      await authFetch('/auth/reset-password', { token, password });
      clearLocalSession(); // every session was signed out on the server
      setDone(true);
    } catch (err) {
      setErrors({ form: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return <Result ok title={t('reset.doneTitle')} body={t('reset.doneBody')} action={t('reset.signIn')} onAction={goHome} />;
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-2">
        <KeyRound className="size-8 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-fg">{t('reset.title')}</h1>
        <p className="text-sm text-fg-muted">{t('reset.description')}</p>
      </div>
      {errors.form && (
        <p className="rounded-control bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {errors.form}
        </p>
      )}
      <TextField
        type={show ? 'text' : 'password'}
        label={t('reset.newPassword')}
        autoComplete="new-password"
        value={password}
        hint={t('auth.passwordHint')}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((p) => ({ ...p, password: undefined }));
        }}
        required
        data-autofocus
        suffix={
          <IconButton
            size="sm"
            label={show ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={show}
            icon={show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            onClick={() => setShow((v) => !v)}
          />
        }
      />
      <TextField
        type={show ? 'text' : 'password'}
        label={t('reset.confirmPassword')}
        autoComplete="new-password"
        value={confirm}
        error={errors.confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setErrors((p) => ({ ...p, confirm: undefined }));
        }}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={saving}>
        {t('reset.save')}
      </Button>
      <Button type="button" variant="ghost" fullWidth onClick={goHome}>
        {t('common.cancel')}
      </Button>
    </form>
  );
}

/** Full-page screen for links opened from emails: confirm address, or choose a new password. */
export default function EmailLinkScreen({ kind, token }: { kind: EmailLinkKind; token: string }) {
  return <Shell>{kind === 'verify' ? <VerifyEmail token={token} /> : <ResetPassword token={token} />}</Shell>;
}
