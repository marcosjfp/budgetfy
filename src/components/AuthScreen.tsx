import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, Eye, EyeOff, SplitSquareHorizontal, PiggyBank, BellRing, Info, Sun, Moon, AlertCircle } from 'lucide-react';
import { exchangeFirebaseSession, firebaseEnabled, signIn, type AppSession } from '../firebase';
import { ApiError, authFetch, describeError, TOKEN_KEY, USER_KEY } from '../api';
import { useI18n, type TranslationKey } from '../i18n';
import type { Theme } from '../hooks/useTheme';
import LanguageSwitcher from './LanguageSwitcher';
import { Button, IconButton, TextField } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AuthScreenProps {
  onAuthenticated: (user: any) => void;
  sessionExpired?: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

type FieldErrors = Partial<Record<'displayName' | 'email' | 'password', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors server/validation.ts passwordSchema. */
function passwordProblem(p: string): TranslationKey | null {
  if (p.length < 8) return 'serverError.password.tooShort';
  if (new TextEncoder().encode(p).length > 72) return 'serverError.password.tooLong';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'serverError.password.letterAndNumber';
  return null;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function AuthScreen({ onAuthenticated, sessionExpired, theme, onToggleTheme }: AuthScreenProps) {
  const { t } = useI18n();
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (isSignUp && !displayName.trim()) next.displayName = t('auth.displayNameRequired');
    if (!email.trim()) next.email = t('validation.emailRequired');
    else if (!EMAIL_RE.test(email.trim())) next.email = t('validation.emailInvalid');
    if (!password) next.password = t('validation.passwordRequired');
    else if (isSignUp) {
      const problem = passwordProblem(password);
      if (problem) next.password = t(problem);
    }
    return next;
  };

  const focusFirstError = (errs: FieldErrors) => {
    if (errs.displayName) nameRef.current?.focus();
    else if (errs.email) emailRef.current?.focus();
    else if (errs.password) passwordRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }

    setSubmitting(true);
    try {
      const data = isSignUp
        ? await authFetch<{ token: string; user: any }>('/auth/register', { email: email.trim(), password, displayName: displayName.trim() })
        : await authFetch<{ token: string; user: any }>('/auth/login', { email: email.trim(), password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (error) {
      console.error('Auth error:', error);
      const message = describeError(error);
      if (error instanceof ApiError) {
        const detail = Array.isArray(error.details) ? (error.details[0] as { path?: string } | undefined) : undefined;
        if (error.code === 'EMAIL_IN_USE') {
          setErrors({ email: message });
          emailRef.current?.focus();
          return;
        }
        if ((error.code === 'VALIDATION_ERROR' || error.code === 'WEAK_PASSWORD') && detail?.path) {
          const field = detail.path as keyof FieldErrors;
          if (field === 'password' || field === 'email' || field === 'displayName') {
            setErrors({ [field]: message });
            focusFirstError({ [field]: message });
            return;
          }
        }
      }
      setFormError(message || t(isSignUp ? 'auth.registrationFailed' : 'auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const credential = await signIn();
      const data = await exchangeFirebaseSession(credential.user, (endpoint, body) => authFetch<AppSession>(endpoint, body));
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (error: any) {
      if (error instanceof ApiError) {
        setFormError(describeError(error));
        return;
      }
      const code = error?.code as string | undefined;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in error:', error);
        setFormError(t('auth.googleFailed'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp((v) => !v);
    setErrors({});
    setFormError(null);
  };

  const features = [
    { icon: SplitSquareHorizontal, key: 'auth.feature.split' as const },
    { icon: PiggyBank, key: 'auth.feature.budgets' as const },
    { icon: BellRing, key: 'auth.feature.reminders' as const },
  ];

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-canvas">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 bg-brand-700 text-white">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-brand-500/50 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-[24rem] rounded-full bg-fuchsia-500/30 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold font-display tracking-tight">{t('app.name')}</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-4xl font-semibold font-display tracking-tight leading-tight">{t('auth.heroTitle')}</p>
          <p className="mt-4 text-brand-100 text-lg leading-relaxed">{t('app.tagline')}</p>
          <ul className="mt-10 space-y-4">
            {features.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 text-white">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="font-medium">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-100">© {new Date().getFullYear()} {t('app.name')}</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 lg:invisible">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold font-display text-fg">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <IconButton
              size="sm"
              label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              icon={theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              onClick={onToggleTheme}
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-display text-fg">
              {isSignUp ? t('auth.createTitle') : t('auth.welcomeTitle')}
            </h1>
            <p className="mt-2 text-fg-muted">{isSignUp ? t('auth.createSubtitle') : t('auth.welcomeSubtitle')}</p>

            {sessionExpired && !formError && (
              <div role="status" className="mt-6 flex items-start gap-2.5 rounded-control border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                <Info className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t('auth.sessionExpired')}</span>
              </div>
            )}
            {formError && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <AlertCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              {isSignUp && (
                <TextField
                  ref={nameRef}
                  label={t('auth.displayName')}
                  autoComplete="name"
                  required
                  value={displayName}
                  error={errors.displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined }));
                  }}
                />
              )}
              <TextField
                ref={emailRef}
                type="email"
                label={t('auth.email')}
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                error={errors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
              />
              <TextField
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={isSignUp ? 8 : undefined}
                maxLength={isSignUp ? 72 : undefined}
                value={password}
                hint={isSignUp ? t('auth.passwordHint') : undefined}
                error={errors.password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                suffix={
                  <IconButton
                    size="sm"
                    label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                    icon={showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    onClick={() => setShowPassword((v) => !v)}
                  />
                }
              />

              <Button type="submit" size="lg" fullWidth loading={submitting} disabled={googleLoading}>
                {submitting ? t('auth.pleaseWait') : isSignUp ? t('auth.createAccount') : t('auth.signIn')}
              </Button>
            </form>

            {firebaseEnabled && (
              <>
            <div className="relative my-6" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-canvas text-sm text-fg-subtle">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <Button variant="secondary" size="lg" fullWidth onClick={handleGoogle} loading={googleLoading} disabled={submitting} leftIcon={<GoogleLogo />}>
              {t('auth.continueWithGoogle')}
            </Button>
              </>
            )}

            <p className="mt-8 text-center text-sm text-fg-muted">
              {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
              <button type="button" onClick={switchMode} className="font-semibold text-brand-700 dark:text-brand-300 hover:underline underline-offset-4 py-2">
                {isSignUp ? t('auth.signIn') : t('auth.signUp')}
              </button>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
