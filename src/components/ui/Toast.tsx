import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from './cn';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** ms; 0 = sticky. Defaults: 4s, errors 7s. */
  duration?: number;
  /** Optional inline action, e.g. "Undo". Clicking it closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Called exactly once when the toast goes away (timer, close button, action, or pushed out). */
  onClose?: (reason: ToastCloseReason) => void;
}

export type ToastCloseReason = 'timeout' | 'dismiss' | 'action' | 'evicted';

interface ToastItem extends Required<Pick<ToastOptions, 'tone' | 'title' | 'duration'>> {
  id: number;
  description?: string;
  action?: ToastOptions['action'];
  onClose?: ToastOptions['onClose'];
}

type Listener = (item: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

function emit(opts: ToastOptions) {
  const item: ToastItem = {
    id: nextId++,
    tone: opts.tone ?? 'info',
    title: opts.title,
    description: opts.description,
    duration: opts.duration ?? (opts.tone === 'error' ? 7000 : 4000),
    action: opts.action,
    onClose: opts.onClose,
  };
  if (listeners.size === 0) {
    // No <Toaster/> mounted: nothing can be shown, so close right away (callers relying on
    // onClose — e.g. deferred deletes — still complete).
    queueMicrotask(() => item.onClose?.('timeout'));
    return item.id;
  }
  listeners.forEach((l) => l(item));
  return item.id;
}

/** Imperative toast API; usable from anywhere (React or not). Requires <Toaster/> mounted once. */
export const toast = {
  show: emit,
  success: (title: string, description?: string) => emit({ tone: 'success', title, description }),
  error: (title: string, description?: string) => emit({ tone: 'error', title, description }),
  info: (title: string, description?: string) => emit({ tone: 'info', title, description }),
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const ICON_COLORS = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-brand-600 dark:text-brand-300',
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const itemsRef = useRef<ToastItem[]>([]);

  const update = useCallback((next: ToastItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    const listener: Listener = (item) => {
      const current = itemsRef.current;
      // Keep at most 4 visible; the oldest ones are pushed out (and told so).
      const evicted = current.slice(0, Math.max(0, current.length - 3));
      update([...current.slice(-3), item]);
      evicted.forEach((e) => e.onClose?.('evicted'));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [update]);

  const dismiss = (id: number, reason: ToastCloseReason) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    update(itemsRef.current.filter((i) => i.id !== id));
    item.onClose?.(reason);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 pb-safe sm:items-end sm:right-0 sm:left-auto sm:w-[400px]"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={(reason) => dismiss(item.id, reason)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (reason: ToastCloseReason) => void }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(Date.now());
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (item.duration === 0 || paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismissRef.current('timeout'), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.duration]);

  const Icon = ICONS[item.tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto w-full max-w-[400px] flex items-start gap-3 rounded-card border border-line bg-surface p-4 pr-2 shadow-overlay',
      )}
    >
      <Icon className={cn('size-5 shrink-0 mt-0.5', ICON_COLORS[item.tone])} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-fg-muted break-words">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss('action');
          }}
          className="-my-1 inline-flex min-h-9 pointer-coarse:min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss('dismiss')}
        aria-label={t('toast.dismiss')}
        className="-my-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-fg-subtle hover:text-fg hover:bg-surface-2"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
