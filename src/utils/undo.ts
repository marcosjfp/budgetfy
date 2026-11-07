import { toast } from '../components/ui/Toast';
import { t } from '../i18n/core';

/** How long the "Undo" toast stays up before the delete is sent (paused while hovered/focused). */
export const UNDO_WINDOW_MS = 5000;

const pending = new Set<(undo: boolean) => void>();

interface DeferredDelete {
  /** Toast title, e.g. "Expense deleted". */
  title: string;
  description?: string;
  /** Sends the delete to the server. Runs once the toast closes without "Undo". */
  commit: () => Promise<unknown>;
  /** Restore the optimistic UI state. */
  onUndo: () => void;
  /** Called if `commit` fails (restore the UI and report). */
  onError: (error: unknown) => void;
  /** Called after a successful commit (e.g. refresh lists). */
  onCommitted?: () => void;
}

/**
 * Optimistic delete with an "Undo" toast. The caller hides the item right away; the request is
 * only sent when the toast closes (timeout or close button). Clicking "Undo" cancels it.
 * The deferral lives outside React, so navigating away still commits the delete.
 */
export function deleteWithUndo({ title, description, commit, onUndo, onError, onCommitted }: DeferredDelete) {
  let settled = false;
  const finalize = (undo: boolean) => {
    if (settled) return;
    settled = true;
    pending.delete(finalize);
    if (undo) {
      onUndo();
      return;
    }
    commit().then(() => onCommitted?.(), onError);
  };
  pending.add(finalize);

  toast.show({
    tone: 'success',
    title,
    description,
    duration: UNDO_WINDOW_MS,
    action: { label: t('toast.undo'), onClick: () => finalize(true) },
    onClose: (reason) => {
      if (reason !== 'action') finalize(false);
    },
  });
}

/** Send every deferred delete now (best effort, e.g. when the page is being hidden/closed). */
export function flushPendingDeletes() {
  [...pending].forEach((finalize) => finalize(false));
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingDeletes);
}
