import React, { useId, useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { SUPPORTED_CURRENCIES, useI18n, type Currency } from '../i18n';
import type { Theme } from '../hooks/useTheme';
import { useCurrencyNames } from '../hooks/useCurrencyNames';
import { apiFetch, describeError, TOKEN_KEY } from '../api';
import { analyticsAvailable, setAnalyticsConsent, useAnalyticsConsent } from '../analytics';
import LanguageSwitcher from './LanguageSwitcher';
import { Button, FieldsetLabel, Modal, SegmentedControl, SelectField, TextField, toast } from './ui';

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  displayName: string;
  email: string | null;
  /** False when the server profile couldn't be loaded (name editing disabled). */
  profileAvailable: boolean;
  onSaveDisplayName: (name: string) => Promise<unknown>;
}

/** Profile (display name) and preferences: language, display currency and theme (synced to the account). */
export default function PreferencesModal({ open, onClose, theme, onThemeChange, displayName, email, profileAvailable, onSaveDisplayName }: PreferencesModalProps) {
  const { t, currency, setCurrency, formatCurrency } = useI18n();
  const langLabelId = useId();
  const themeLabelId = useId();
  const analyticsLabelId = useId();
  const analyticsConsent = useAnalyticsConsent();
  const [name, setName] = useState(displayName);
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const signOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      const { token } = (await apiFetch('/users/me/sign-out-others', { method: 'POST' })) as { token: string };
      localStorage.setItem(TOKEN_KEY, token); // keep this device signed in
      toast.success(t('prefs.signOutOthersDone'));
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSigningOutOthers(false);
    }
  };

  // Reset the name field from the latest value each time the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(displayName);
      setNameError(undefined);
    }
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('auth.displayNameRequired'));
      return;
    }
    if (trimmed === displayName) return;
    setSavingName(true);
    setNameError(undefined);
    try {
      await onSaveDisplayName(trimmed);
      setName(trimmed);
      toast.success(t('profile.nameSaved'));
    } catch (err) {
      setNameError(describeError(err));
    } finally {
      setSavingName(false);
    }
  };

  const currencyNames = useCurrencyNames();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('prefs.title')}
      description={t('prefs.description')}
      size="md"
      footer={
        <Button onClick={onClose} data-autofocus>
          {t('common.done')}
        </Button>
      }
    >
      <div className="space-y-6 pb-2">
        <form onSubmit={saveName} noValidate className="space-y-3 pb-6 border-b border-line">
          <p className="text-sm font-semibold text-fg">{t('profile.title')}</p>
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <TextField
              containerClassName="flex-1"
              label={t('profile.displayName')}
              hint={email ? t('profile.signedInAs', { email }) : undefined}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              autoComplete="name"
              maxLength={100}
              required
              error={nameError}
              disabled={!profileAvailable}
            />
            <Button type="submit" variant="secondary" loading={savingName} disabled={!profileAvailable || name.trim() === displayName} className="sm:mt-7">
              {t('profile.saveName')}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-1.5">
          <FieldsetLabel id={langLabelId}>{t('prefs.language')}</FieldsetLabel>
          <LanguageSwitcher long labelledBy={langLabelId} />
        </div>

        <SelectField
          label={t('prefs.currency')}
          hint={t('prefs.currencyHint', { example: formatCurrency(1234.5) })}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {currencyNames[c]}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col gap-1.5">
          <FieldsetLabel id={themeLabelId}>{t('prefs.theme')}</FieldsetLabel>
          <SegmentedControl<Theme>
            fullWidth
            label={t('prefs.theme')}
            labelledBy={themeLabelId}
            value={theme}
            onChange={onThemeChange}
            options={[
              { value: 'light', label: t('prefs.light'), icon: <Sun /> },
              { value: 'dark', label: t('prefs.dark'), icon: <Moon /> },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldsetLabel>{t('prefs.security')}</FieldsetLabel>
          <div>
            <Button variant="secondary" onClick={signOutOthers} loading={signingOutOthers} leftIcon={<LogOut />}>
              {t('prefs.signOutOthers')}
            </Button>
          </div>
          <p className="text-xs text-fg-muted">{t('prefs.signOutOthersHint')}</p>
        </div>

        {analyticsAvailable && (
          <div className="flex flex-col gap-1.5">
            <FieldsetLabel id={analyticsLabelId}>{t('prefs.analytics')}</FieldsetLabel>
            <SegmentedControl<'granted' | 'denied'>
              fullWidth
              label={t('prefs.analytics')}
              labelledBy={analyticsLabelId}
              value={analyticsConsent === 'granted' ? 'granted' : 'denied'}
              onChange={setAnalyticsConsent}
              options={[
                { value: 'granted', label: t('prefs.analyticsOn') },
                { value: 'denied', label: t('prefs.analyticsOff') },
              ]}
            />
            <p className="text-xs text-fg-muted">{t('prefs.analyticsHint')}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
