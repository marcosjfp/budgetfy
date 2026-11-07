import { useEffect, useRef } from 'react';
import { LayoutDashboard, Calendar as CalendarIcon, Plus, LogOut, Settings2, Wallet, X, Sun, Moon } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Group } from '../types';
import type { Theme } from '../hooks/useTheme';
import { GroupDot } from './CategoryIcon';
import { Avatar, IconButton, Skeleton, cn } from './ui';

export type MainView = 'dashboard' | 'calendar';

interface SidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  groups: Group[];
  groupsLoading: boolean;
  selectedGroupId: string | null;
  currentView: MainView;
  overdueCount: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (view: MainView) => void;
  onSelectGroup: (id: string) => void;
  onCreateGroup: () => void;
  onOpenPreferences: () => void;
  onSignOut: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const navItem = (active: boolean) =>
  cn(
    'w-full flex items-center gap-3 px-3 min-h-11 rounded-control text-sm font-medium transition-colors duration-150',
    active ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  );

export default function Sidebar({
  user,
  groups,
  groupsLoading,
  selectedGroupId,
  currentView,
  overdueCount,
  open,
  onClose,
  onNavigate,
  onSelectGroup,
  onCreateGroup,
  onOpenPreferences,
  onSignOut,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Mobile drawer: Esc closes, focus moves into the drawer when it opens.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isDashboard = !selectedGroupId && currentView === 'dashboard';
  const isCalendar = !selectedGroupId && currentView === 'calendar';

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label={t('nav.sidebar')}
        className={cn(
          'fixed lg:sticky top-0 inset-y-0 left-0 z-50 lg:z-10 h-dvh w-[18rem] max-w-[85vw] shrink-0',
          'flex flex-col bg-surface border-r border-line',
          'duration-200 ease-out',
          // Visibility flips instantly on open (so focus can move in) and after the slide on close.
          open ? 'translate-x-0 visible shadow-overlay transition-transform' : '-translate-x-full invisible lg:visible lg:translate-x-0 transition-[transform,visibility]',
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-fg font-display">{t('app.name')}</span>
          </div>
          <IconButton ref={closeRef} className="lg:hidden" label={t('nav.closeMenu')} icon={<X className="size-5" />} onClick={onClose} />
        </div>

        <nav aria-label={t('nav.main')} className="px-3 pt-2">
          <ul className="space-y-1">
            <li>
              <button type="button" onClick={() => onNavigate('dashboard')} aria-current={isDashboard ? 'page' : undefined} className={navItem(isDashboard)}>
                <LayoutDashboard className="size-5 shrink-0" aria-hidden="true" />
                {t('nav.dashboard')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('calendar')} aria-current={isCalendar ? 'page' : undefined} className={navItem(isCalendar)}>
                <CalendarIcon className="size-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{t('nav.calendar')}</span>
                {overdueCount > 0 && (
                  <span className="min-w-6 h-6 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold tabular">
                    {overdueCount}
                    <span className="sr-only"> — {t('nav.overdueCount', { count: overdueCount })}</span>
                  </span>
                )}
              </button>
            </li>
          </ul>
        </nav>

        <div className="mt-6 flex-1 min-h-0 flex flex-col px-3">
          <div className="flex items-center justify-between pl-3 pr-1 mb-1">
            <h2 id="sidebar-groups" className="eyebrow">
              {t('nav.yourGroups')}
            </h2>
            <IconButton size="sm" label={t('nav.createGroup')} icon={<Plus className="size-4" />} onClick={onCreateGroup} />
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-2">
            {groupsLoading ? (
              <div className="space-y-2 px-3 py-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-5 w-3/4" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="mx-1 mt-2 rounded-control border border-dashed border-line-strong p-4 text-center">
                <p className="text-sm text-fg-subtle">{t('nav.noGroups')}</p>
                <button type="button" onClick={onCreateGroup} className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline underline-offset-4 min-h-11 px-2">
                  {t('nav.createFirstGroup')}
                </button>
              </div>
            ) : (
              <ul aria-labelledby="sidebar-groups" className="space-y-0.5">
                {groups.map((group) => {
                  const active = selectedGroupId === group.id;
                  return (
                    <li key={group.id}>
                      <button type="button" onClick={() => onSelectGroup(group.id)} aria-current={active ? 'page' : undefined} className={navItem(active)}>
                        <GroupDot type={group.type} color={group.themeColor} />
                        <span className="truncate text-left flex-1">{group.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line p-3 pb-safe lg:pb-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.displayName || user.email} src={user.photoURL} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{user.displayName}</p>
              <p className="text-xs text-fg-subtle truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 min-w-0 inline-flex items-center gap-2 px-3 min-h-11 rounded-control text-sm font-medium text-fg-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300 transition-colors"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('nav.signOut')}</span>
            </button>
            <IconButton
              label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              icon={theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
              onClick={onToggleTheme}
            />
            <IconButton label={t('prefs.open')} icon={<Settings2 className="size-5" />} onClick={onOpenPreferences} />
          </div>
        </div>
      </aside>
    </>
  );
}
