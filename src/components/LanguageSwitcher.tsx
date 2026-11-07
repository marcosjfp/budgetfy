import { LANGS, useI18n, type Lang } from '../i18n';
import { SegmentedControl } from './ui';

interface LanguageSwitcherProps {
  className?: string;
  /** Show full language names instead of EN/PT codes. */
  long?: boolean;
  labelledBy?: string;
}

export default function LanguageSwitcher({ className = '', long, labelledBy }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();
  return (
    <SegmentedControl<Lang>
      className={className}
      size={long ? 'md' : 'sm'}
      fullWidth={long}
      label={t('language.label')}
      labelledBy={labelledBy}
      value={lang}
      onChange={setLang}
      options={LANGS.map((l) => ({
        value: l,
        lang: l === 'en' ? 'en' : 'pt-BR',
        label: long ? t(l === 'en' ? 'language.en' : 'language.pt') : l.toUpperCase(),
        ariaLabel: long ? undefined : t(l === 'en' ? 'language.en' : 'language.pt'),
      }))}
    />
  );
}
