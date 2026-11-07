/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Menu, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, exchangeFirebaseSession, logOut, type AppSession } from './firebase';
import { apiFetch, authFetch, clearLocalSession, SESSION_EXPIRED_EVENT, TOKEN_KEY, USER_KEY } from './api';
import type { Group, Settlement } from './types';
import { useI18n } from './i18n';
import { useTheme } from './hooks/useTheme';
import { useProfileSync } from './hooks/useProfileSync';
import { normalizeExpense, normalizeGroup, normalizeSettlement, isOverdue, type GroupExpense } from './utils/budget';
import { flushPendingDeletes } from './utils/undo';

import AuthScreen from './components/AuthScreen';
import Sidebar, { type MainView } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CreateGroupModal from './components/CreateGroupModal';
import PreferencesModal from './components/PreferencesModal';
import { IconButton, LoadingRegion, Skeleton, toast } from './components/ui';
import { PageSkeleton } from './components/PageSkeleton';

// Heavy views are code-split (GroupView pulls in Recharts).
const GroupView = lazy(() => import('./components/group/GroupView'));
const CalendarView = lazy(() => import('./components/CalendarView'));

function readLocalUser() {
  try {
    const localUser = localStorage.getItem(USER_KEY);
    const localToken = localStorage.getItem(TOKEN_KEY);
    return localUser && localToken ? JSON.parse(localUser) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { t } = useI18n();
  const { theme, setTheme, toggleTheme } = useTheme();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<User | any | null>(readLocalUser);
  const [authLoading, setAuthLoading] = useState(() => readLocalUser() === null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [allExpenses, setAllExpenses] = useState<GroupExpense[]>([]);
  const [allSettlements, setAllSettlements] = useState<Settlement[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<MainView>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Server profile (display name) + language/currency/theme synced across devices.
  const { profile, updateDisplayName } = useProfileSync(user?.uid ?? null, theme, setTheme);
  /** Plain user object for the UI, with the name edited in Budgetfy taking precedence. */
  const viewUser = useMemo(
    () =>
      user
        ? ({
            uid: user.uid,
            email: profile?.email ?? user.email ?? null,
            displayName: profile?.displayName ?? user.displayName ?? null,
            photoURL: user.photoURL ?? profile?.photoURL ?? null,
          } as User)
        : null,
    [user, profile],
  );

  // Session expiry (401 INVALID_TOKEN/UNAUTHORIZED from apiFetch).
  useEffect(() => {
    const onExpired = () => {
      setSessionExpired(true);
      setUser(null);
      setSelectedGroupId(null);
      logOut().catch(() => undefined);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Sessions are always Budgetfy tokens. A Google login left over from an older version
  // (Firebase session, no Budgetfy token) is converted once at startup.
  useEffect(() => {
    if (!auth || localStorage.getItem(TOKEN_KEY)) {
      setAuthLoading(false);
      return;
    }
    const firebaseAuth = auth;
    let cancelled = false;
    (async () => {
      try {
        await firebaseAuth.authStateReady();
        const leftover = firebaseAuth.currentUser;
        if (leftover && !localStorage.getItem(TOKEN_KEY)) {
          const data = await exchangeFirebaseSession(leftover, (endpoint, body) => authFetch<AppSession>(endpoint, body));
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          if (!cancelled) setUser(data.user);
        }
      } catch (error) {
        console.error('Could not restore Google session:', error);
        await logOut().catch(() => undefined);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGroups = useCallback(async () => {
    try {
      const data = await apiFetch('/groups');
      setGroups((data ?? []).map(normalizeGroup));
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const refreshExpenses = useCallback(async (list: Group[]) => {
    if (list.length === 0) {
      setAllExpenses([]);
      setAllSettlements([]);
      setExpensesLoading(false);
      return;
    }
    try {
      const [results, settlementResults] = await Promise.all([
        Promise.all(
          list.map((g) =>
            apiFetch(`/groups/${g.id}/expenses`).then((exps) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (exps ?? []).map((e: any) => normalizeExpense({ ...e, groupId: g.id }) as GroupExpense),
            ),
          ),
        ),
        // Settlements only feed the dashboard balances; a failure must not hide expenses.
        Promise.all(
          list.map((g) =>
            apiFetch(`/groups/${g.id}/settlements`)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((rows) => (rows ?? []).map((r: any) => normalizeSettlement({ ...r, groupId: g.id })))
              .catch(() => [] as Settlement[]),
          ),
        ),
      ]);
      const combined = results.flat();
      combined.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setAllExpenses(combined);
      setAllSettlements(settlementResults.flat());
    } catch (err) {
      console.error('Error fetching all expenses:', err);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroupsLoading(true);
      setExpensesLoading(true);
      return;
    }
    refreshGroups();
  }, [user, refreshGroups]);

  useEffect(() => {
    if (!user || groupsLoading) return;
    refreshExpenses(groups);
  }, [groups, groupsLoading, user, refreshExpenses]);

  const overdueCount = useMemo(() => allExpenses.filter((e) => isOverdue(e)).length, [allExpenses]);

  useEffect(() => {
    if (selectedGroupId && !groupsLoading && !groups.find((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, groupsLoading, selectedGroupId]);

  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const goTo = (view: MainView) => {
    setSelectedGroupId(null);
    setCurrentView(view);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  };

  const openGroup = (id: string) => {
    setSelectedGroupId(id);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const handleSignOut = () => {
    // Send any deletes still in their undo window while the session token is valid.
    flushPendingDeletes();
    logOut().catch(() => undefined);
    clearLocalSession();
    setSessionExpired(false);
    setSelectedGroupId(null);
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh bg-canvas">
        <div className="hidden lg:block w-[18rem] border-r border-line bg-surface p-5 space-y-4" aria-hidden="true">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <LoadingRegion label={t('common.loading')}>
            <PageSkeleton />
          </LoadingRegion>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        sessionExpired={sessionExpired}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={(u) => {
          setSessionExpired(false);
          setUser(u);
        }}
      />
    );
  }

  const viewKey = selectedGroupId ?? currentView;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:shadow-overlay focus:text-fg"
      >
        {t('nav.skipToContent')}
      </a>

      <Sidebar
        user={viewUser}
        groups={groups}
        groupsLoading={groupsLoading}
        selectedGroupId={selectedGroupId}
        currentView={currentView}
        overdueCount={overdueCount}
        open={isSidebarOpen}
        onClose={closeSidebar}
        onNavigate={goTo}
        onSelectGroup={openGroup}
        onCreateGroup={() => {
          setIsSidebarOpen(false);
          setIsCreateModalOpen(true);
        }}
        onOpenPreferences={() => {
          setIsSidebarOpen(false);
          setIsPrefsOpen(true);
        }}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 min-w-0 flex flex-col" inert={isSidebarOpen || undefined}>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 h-14 px-2 pl-4 bg-surface/90 backdrop-blur border-b border-line">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
            <span className="font-semibold font-display text-fg">{t('app.name')}</span>
          </div>
          <IconButton label={t('nav.openMenu')} icon={<Menu className="size-6" />} onClick={() => setIsSidebarOpen(true)} aria-expanded={isSidebarOpen} />
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 focus:outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10 pb-24"
            >
              <Suspense
                fallback={
                  <LoadingRegion label={t('common.loading')}>
                    <PageSkeleton />
                  </LoadingRegion>
                }
              >
                {selectedGroupId ? (
                  <GroupView
                    groupId={selectedGroupId}
                    user={viewUser!}
                    theme={theme}
                    onBack={() => goTo(currentView)}
                    onChanged={refreshGroups}
                    onDeleted={() => {
                      setSelectedGroupId(null);
                      refreshGroups();
                    }}
                  />
                ) : currentView === 'dashboard' ? (
                  <Dashboard
                    user={viewUser!}
                    groups={groups}
                    expenses={allExpenses}
                    settlements={allSettlements}
                    loading={groupsLoading || expensesLoading}
                    onSelectGroup={openGroup}
                    onCreateGroup={() => setIsCreateModalOpen(true)}
                    onChanged={() => refreshExpenses(groups)}
                  />
                ) : (
                  <CalendarView expenses={allExpenses} groups={groups} loading={groupsLoading || expensesLoading} onSelectGroup={openGroup} />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={async (group) => {
          setIsCreateModalOpen(false);
          toast.success(t('toast.groupCreated', { name: group.name }));
          await refreshGroups();
          if (group.id) openGroup(group.id);
        }}
      />
      <PreferencesModal
        open={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        displayName={viewUser?.displayName ?? ''}
        email={viewUser?.email ?? null}
        profileAvailable={!!profile}
        onSaveDisplayName={updateDisplayName}
      />
    </div>
  );
}

