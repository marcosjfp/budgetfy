import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, SearchX, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Expense, Group, GroupMember, Settlement } from '../../types';
import { apiFetch } from '../../api';
import { useI18n, CurrencyScope } from '../../i18n';
import type { Theme } from '../../hooks/useTheme';
import { handleFirestoreError, OperationType } from '../../utils/errorHandling';
import { groupCurrency, normalizeExpense, normalizeSettlement } from '../../utils/budget';
import { deleteWithUndo } from '../../utils/undo';
import { Button, Card, ConfirmDialog, EmptyState, LoadingRegion, Skeleton, toast } from '../ui';
import { PageSkeleton } from '../PageSkeleton';
import { GroupHeader } from './GroupHeader';
import { GroupStats } from './GroupStats';
import { ExpenseList } from './ExpenseList';
import { MembersPanel } from './MembersPanel';
import { ExpenseFormModal, type ExpenseSubmit } from './ExpenseFormModal';
import { ExpenseDetailsModal } from './ExpenseDetailsModal';
import { DeleteExpenseDialog } from './DeleteExpenseDialog';
import { GroupSettingsModal, type GroupSettingsValues } from './GroupSettingsModal';
import { InviteMemberModal } from './InviteMemberModal';
import { SeriesManagerModal } from './SeriesManagerModal';
import { SettleUpPanel } from './SettleUpPanel';
import { RecordPaymentModal, type PaymentDraft, type PaymentPayload } from './RecordPaymentModal';
import { computeGroupStats, upcomingBills, type ScopeChoice } from './groupMath';
import { computeNetBalances, fromCents } from '../../utils/settle';

// Recharts is only needed here; load it after the rest of the page.
const GroupCharts = lazy(() => import('./GroupCharts'));

interface GroupViewProps {
  groupId: string;
  user: User;
  theme: Theme;
  onBack: () => void;
  /** Group data changed (name, budget, expenses…) — refresh app-level lists. */
  onChanged: () => void;
  onDeleted: () => void;
}

const MAX_OCCURRENCES = 50;

export default function GroupView({ groupId, user, theme, onBack, onChanged, onDeleted }: GroupViewProps) {
  const { t, formatDate, formatDateRange, currency: preferredCurrency } = useI18n();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payment, setPayment] = useState<{ key: number; open: boolean; draft: PaymentDraft | null }>({ key: 0, open: false, draft: null });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Dialog state
  const [form, setForm] = useState<{ key: number; open: boolean; expense: Expense | null; scope: ScopeChoice }>({ key: 0, open: false, expense: null, scope: 'this' });
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<{ expense: Expense; scope: ScopeChoice } | null>(null);
  const [managingSeries, setManagingSeries] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const load = useCallback(async () => {
    try {
      const [groupData, expensesData, membersData, settlementsData] = await Promise.all([
        apiFetch(`/groups/${groupId}`),
        apiFetch(`/groups/${groupId}/expenses`),
        apiFetch(`/groups/${groupId}/members`),
        // Settle-up data is optional: don't break the page if it can't be loaded (e.g. DB not migrated yet).
        apiFetch(`/groups/${groupId}/settlements`).catch((err) => {
          console.warn('Could not load settlements:', err);
          return [];
        }),
      ]);
      setGroup(groupData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setExpenses((expensesData ?? []).map((e: any) => normalizeExpense(e)));
      setMembers(membersData ?? []);
      setSettlements((settlementsData ?? []).map(normalizeSettlement));
      setStatus('ready');
    } catch (err) {
      console.error('Error fetching group view data:', err);
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [groupId]);

  useEffect(() => {
    setStatus('loading');
    load();
  }, [load]);

  // The member list stores a copy of each name: reload it after the user renames themself.
  const displayName = user.displayName;
  const loadedName = useRef(displayName);
  useEffect(() => {
    if (loadedName.current === displayName) return;
    loadedName.current = displayName;
    load();
  }, [displayName, load]);

  /** Re-fetch this group and tell the app shell. */
  const refresh = useCallback(async () => {
    await load();
    onChanged();
  }, [load, onChanged]);

  const stats = useMemo(() => (group ? computeGroupStats(group, expenses, members, user.uid) : null), [group, expenses, members, user.uid]);
  const upcoming = useMemo(() => upcomingBills(expenses), [expenses]);
  // Same number as the Settle up panel, so recording a payment updates the balance tile too.
  const settleBalance = useMemo(() => {
    const ids = members.length ? members.map((m) => m.uid) : group?.memberIds ?? [];
    return fromCents(computeNetBalances(expenses, settlements, ids).get(user.uid) ?? 0);
  }, [expenses, settlements, members, group?.memberIds, user.uid]);
  const userIsAdmin = members.find((m) => m.uid === user.uid)?.role === 'admin' || group?.createdBy === user.uid;
  const userIsOwner = group?.createdBy === user.uid;

  const periodLabel = useMemo(() => {
    const now = new Date();
    const type = group?.budgetType || 'total';
    if (type === 'monthly') return formatDate(now, { month: 'long', year: 'numeric' });
    if (type === 'weekly') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return formatDateRange(start, end, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return t('group.allTime');
  }, [group?.budgetType, formatDate, formatDateRange, t]);

  // ---- actions ------------------------------------------------------------

  const openForm = (expense: Expense | null, scope: ScopeChoice = 'this') => setForm((f) => ({ key: f.key + 1, open: true, expense, scope }));
  const closeForm = () => setForm((f) => ({ ...f, open: false }));

  const saveExpense = async ({ data, recurrence, scope }: ExpenseSubmit) => {
    const editing = form.expense;
    try {
      if (editing) {
        if (editing.isRecurring && scope !== 'this' && editing.recurrenceId) {
          await apiFetch(`/groups/${groupId}/expenses/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({
              recurrenceId: editing.recurrenceId,
              fromDate: scope === 'future' ? editing.date.toDate().toISOString() : undefined,
              updates: data,
            }),
          });
        } else {
          await apiFetch(`/groups/${groupId}/expenses/${editing.id}`, { method: 'PATCH', body: JSON.stringify(data) });
        }
      } else if (recurrence) {
        const start = new Date(data.date);
        const recurrenceId = crypto.randomUUID();
        const dueOffset = data.dueDate ? new Date(data.dueDate).getTime() - start.getTime() : null;
        const bulk = [];
        const current = new Date(start);
        while (current <= recurrence.endDate && bulk.length < MAX_OCCURRENCES) {
          bulk.push({
            ...data,
            date: current.toISOString(),
            dueDate: dueOffset !== null ? new Date(current.getTime() + dueOffset).toISOString() : data.dueDate,
            isRecurring: true,
            recurrenceId,
          });
          if (recurrence.frequency === 'daily') current.setDate(current.getDate() + 1);
          else if (recurrence.frequency === 'weekly') current.setDate(current.getDate() + 7);
          else if (recurrence.frequency === 'monthly') current.setMonth(current.getMonth() + 1);
          else current.setFullYear(current.getFullYear() + 1);
        }
        await apiFetch(`/groups/${groupId}/expenses`, { method: 'POST', body: JSON.stringify(bulk) });
      } else {
        await apiFetch(`/groups/${groupId}/expenses`, { method: 'POST', body: JSON.stringify(data) });
      }
      closeForm();
      toast.success(editing ? t('toast.expenseUpdated') : recurrence ? t('toast.seriesCreated') : t('toast.expenseAdded'), editing ? undefined : data.description);
      await refresh();
    } catch (error) {
      handleFirestoreError(error, editing ? OperationType.UPDATE : OperationType.CREATE, `groups/${groupId}/expenses`);
      throw error;
    }
  };

  /** Optimistic delete with a 5 s "Undo" window before the request is sent. */
  const deleteExpense = (expense: Expense, scope: ScopeChoice) => {
    const matches = (e: Expense) => {
      if (scope === 'this' || !expense.recurrenceId) return e.id === expense.id;
      if (e.recurrenceId !== expense.recurrenceId) return false;
      return scope === 'future' ? e.date.toMillis() >= expense.date.toMillis() : true;
    };
    const removed = expenses.filter(matches);
    const restore = () =>
      setExpenses((list) => {
        const ids = new Set(list.map((e) => e.id));
        return [...list, ...removed.filter((e) => !ids.has(e.id))].sort((a, b) => b.date.toMillis() - a.date.toMillis());
      });

    setToDelete(null);
    setExpenses((list) => list.filter((e) => !matches(e)));
    deleteWithUndo({
      title: removed.length > 1 ? t('toast.expensesDeleted', { count: removed.length }) : t('toast.expenseDeleted'),
      description: expense.description,
      commit: () =>
        scope !== 'this' && expense.recurrenceId
          ? apiFetch(`/groups/${groupId}/expenses/bulk`, {
              method: 'DELETE',
              body: JSON.stringify({
                recurrenceId: expense.recurrenceId,
                fromDate: scope === 'future' ? expense.date.toDate().toISOString() : undefined,
              }),
            })
          : apiFetch(`/groups/${groupId}/expenses/${expense.id}`, { method: 'DELETE' }),
      onUndo: restore,
      onError: (error) => {
        restore();
        handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/expenses/${expense.id}`);
      },
      onCommitted: () => {
        refresh();
      },
    });
  };

  const openPayment = (draft: PaymentDraft | null) => setPayment((p) => ({ key: p.key + 1, open: true, draft }));

  const recordPayment = async (payload: PaymentPayload) => {
    try {
      const created = await apiFetch(`/groups/${groupId}/settlements`, { method: 'POST', body: JSON.stringify(payload) });
      setSettlements((list) => [normalizeSettlement(created), ...list].sort((a, b) => b.date.toMillis() - a.date.toMillis()));
      setPayment((p) => ({ ...p, open: false }));
      toast.success(t('toast.paymentRecorded'));
      onChanged();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/settlements`);
      throw error;
    }
  };

  const deleteSettlement = async (settlement: Settlement) => {
    try {
      await apiFetch(`/groups/${groupId}/settlements/${settlement.id}`, { method: 'DELETE' });
      setSettlements((list) => list.filter((x) => x.id !== settlement.id));
      toast.success(t('toast.paymentDeleted'));
      onChanged();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/settlements/${settlement.id}`);
      throw error;
    }
  };

  const saveSettings = async (values: GroupSettingsValues) => {
    try {
      await apiFetch(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(values) });
      setSettingsOpen(false);
      toast.success(t('toast.groupUpdated'));
      await refresh();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const deleteGroup = async () => {
    setDeletingGroup(true);
    try {
      await apiFetch(`/groups/${groupId}`, { method: 'DELETE' });
      setDeleteGroupOpen(false);
      toast.success(t('toast.groupDeleted', { name: group?.name ?? '' }));
      onDeleted();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}`);
    } finally {
      setDeletingGroup(false);
    }
  };

  const changeRole = async (member: GroupMember, role: 'admin' | 'member') => {
    try {
      await apiFetch(`/groups/${groupId}/members/${member.uid}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setMembers((list) => list.map((m) => (m.uid === member.uid ? { ...m, role } : m)));
      toast.success(t('toast.roleUpdated', { name: member.displayName ?? '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}/members/${member.uid}`);
    }
  };

  const removeMember = async (member: GroupMember) => {
    try {
      await apiFetch(`/groups/${groupId}/members/${member.uid}`, { method: 'DELETE' });
      setMembers((list) => list.filter((m) => m.uid !== member.uid));
      toast.success(t('toast.memberRemoved', { name: member.displayName ?? '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/members/${member.uid}`);
      throw error;
    }
  };

  // ---- render ---------------------------------------------------------------

  if (status === 'loading') {
    return (
      <LoadingRegion label={t('common.loading')}>
        <PageSkeleton />
      </LoadingRegion>
    );
  }

  if (status === 'error' || !group || !stats) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<SearchX />}
          title={t('group.loadFailed')}
          description={t('group.loadFailedHint')}
          action={
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={onBack}>
                {t('group.back')}
              </Button>
              <Button
                onClick={() => {
                  setStatus('loading');
                  load();
                }}
              >
                {t('common.retry')}
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <CurrencyScope currency={groupCurrency(group, preferredCurrency)}>
      <GroupHeader
        group={group}
        periodLabel={periodLabel}
        isAdmin={userIsAdmin}
        upcoming={upcoming}
        onBack={onBack}
        onOpenSettings={() => setSettingsOpen(true)}
        onInvite={() => setInviteOpen(true)}
        onAddExpense={() => openForm(null)}
        onViewExpense={setViewing}
      />

      <GroupStats group={group} totalSpent={stats.totalSpent} userShare={stats.userShare} balance={settleBalance} paidPct={stats.paidPct} />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-card" />
            ))}
          </div>
        }
      >
        <GroupCharts group={group} expenses={expenses} periodExpenses={stats.currentPeriodExpenses} theme={theme} />
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        <div className="xl:col-span-2 min-w-0">
          <ExpenseList
            groupName={group.name}
            expenses={expenses}
            members={members}
            currentUserId={user.uid}
            isAdmin={userIsAdmin}
            onView={setViewing}
            onEdit={(e) => openForm(e)}
            onDelete={(e) => setToDelete({ expense: e, scope: 'this' })}
            onManageSeries={setManagingSeries}
            onAdd={() => openForm(null)}
          />
        </div>
        <div className="space-y-8 min-w-0">
          <SettleUpPanel
            group={group}
            members={members}
            expenses={expenses}
            settlements={settlements}
            currentUserId={user.uid}
            isAdmin={userIsAdmin}
            onRecord={openPayment}
            onDeleteSettlement={deleteSettlement}
          />
          <MembersPanel
            group={group}
            members={members}
            currentUserId={user.uid}
            isAdmin={userIsAdmin}
            periodExpenses={stats.currentPeriodExpenses}
            onChangeRole={changeRole}
            onRemove={removeMember}
          />
        </div>
      </div>

      {/* Mobile floating action button */}
      <div className="lg:hidden fixed right-4 bottom-4 z-30 mb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => openForm(null)}
          aria-label={t('group.addExpense')}
          className="flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-overlay hover:bg-brand-700 active:bg-brand-800 transition-colors"
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
      </div>

      <ExpenseFormModal
        key={form.key}
        open={form.open}
        onClose={closeForm}
        expense={form.expense}
        initialScope={form.scope}
        members={members}
        currentUserId={user.uid}
        onSubmit={saveExpense}
      />

      <ExpenseDetailsModal
        expense={viewing}
        members={members}
        canEdit={!!viewing && (viewing.paidBy === user.uid || userIsAdmin)}
        onClose={() => setViewing(null)}
        onEdit={(e) => {
          setViewing(null);
          openForm(e);
        }}
        onDelete={(e) => {
          setViewing(null);
          setToDelete({ expense: e, scope: 'this' });
        }}
      />

      <DeleteExpenseDialog
        expense={toDelete?.expense ?? null}
        initialScope={toDelete?.scope}
        loading={false}
        onClose={() => setToDelete(null)}
        onConfirm={deleteExpense}
      />

      <SeriesManagerModal
        recurrenceId={managingSeries}
        expenses={expenses}
        onClose={() => setManagingSeries(null)}
        onEditSeries={(first) => {
          setManagingSeries(null);
          openForm(first, 'series');
        }}
        onDeleteSeries={(first) => {
          setManagingSeries(null);
          setToDelete({ expense: first, scope: 'series' });
        }}
        onViewInstance={(e) => {
          setManagingSeries(null);
          setViewing(e);
        }}
        onEditInstance={(e) => {
          setManagingSeries(null);
          openForm(e, 'this');
        }}
      />

      {settingsOpen && (
        <GroupSettingsModal
          open={settingsOpen}
          group={group}
          canDelete={userIsOwner}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onRequestDelete={() => {
            setSettingsOpen(false);
            setDeleteGroupOpen(true);
          }}
        />
      )}

      <InviteMemberModal
        open={inviteOpen}
        groupId={groupId}
        onClose={() => setInviteOpen(false)}
        onAdded={(member) => {
          if (member) setMembers((list) => (list.some((m) => m.uid === member.uid) ? list : [...list, member]));
          refresh();
        }}
      />

      <RecordPaymentModal
        key={payment.key}
        open={payment.open}
        draft={payment.draft}
        members={members}
        currentUserId={user.uid}
        isAdmin={userIsAdmin}
        onClose={() => setPayment((p) => ({ ...p, open: false }))}
        onSubmit={recordPayment}
      />

      <ConfirmDialog
        open={deleteGroupOpen}
        onClose={() => setDeleteGroupOpen(false)}
        onConfirm={deleteGroup}
        loading={deletingGroup}
        title={t('deleteGroup.title')}
        description={t('deleteGroup.desc', { name: group.name })}
        confirmLabel={t('settings.deleteGroup')}
        icon={<Trash2 className="size-5" />}
      />
    </CurrencyScope>
  );
}
