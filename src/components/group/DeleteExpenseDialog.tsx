import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { Expense } from '../../types';
import { ConfirmDialog } from '../ui';
import { ScopeChoice } from './ScopeChoice';
import type { ScopeChoice as Scope } from './groupMath';

interface DeleteExpenseDialogProps {
  expense: Expense | null;
  initialScope?: Scope;
  loading: boolean;
  onClose: () => void;
  onConfirm: (expense: Expense, scope: Scope) => void;
}

export function DeleteExpenseDialog({ expense, initialScope = 'this', loading, onClose, onConfirm }: DeleteExpenseDialogProps) {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [forId, setForId] = useState<string | null>(null);
  if (expense && expense.id !== forId) {
    setForId(expense.id);
    setScope(initialScope);
  }
  const recurring = !!expense?.isRecurring;
  return (
    <ConfirmDialog
      open={!!expense}
      onClose={onClose}
      loading={loading}
      onConfirm={() => expense && onConfirm(expense, recurring ? scope : 'this')}
      title={t('deleteExpense.title')}
      description={recurring ? t('deleteExpense.recurringDesc') : t('deleteExpense.desc')}
      confirmLabel={t('common.delete')}
      icon={<Trash2 className="size-5" />}
    >
      {recurring && <ScopeChoice mode="delete" value={scope} onChange={setScope} />}
    </ConfirmDialog>
  );
}
