import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from './cn';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Stack of open modals so Esc / focus trap only act on the top-most one.
const modalStack: string[] = [];

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional decorative icon shown before the title. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  /** Sticky footer (actions). */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  role?: 'dialog' | 'alertdialog';
  /** Element to focus when opened. Defaults to `[data-autofocus]`, then the first field, then the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** When false, backdrop clicks and Esc don't close (e.g. while saving). */
  dismissible?: boolean;
  hideCloseButton?: boolean;
  /** Centered header (used by confirmations). */
  centered?: boolean;
  className?: string;
}

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' };

/**
 * Accessible modal dialog: portal, focus trap, Esc to close, focus returned
 * to the trigger, scroll lock, bottom sheet on small screens.
 */
export function Modal(props: ModalProps) {
  return createPortal(<AnimatePresence>{props.open && <ModalPanel {...props} />}</AnimatePresence>, document.body);
}

function ModalPanel({
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  initialFocusRef,
  dismissible = true,
  hideCloseButton,
  centered,
  className,
}: ModalProps) {
  const { t } = useI18n();
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalStack.push(id);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select, textarea') ??
      panel;
    // Wait a frame so the enter animation has mounted the content.
    const raf = requestAnimationFrame(() => target?.focus({ preventScroll: true }));

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id || !panelRef.current) return;
      if (e.key === 'Escape') {
        if (dismissibleRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusable(panelRef.current);
        if (items.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      const idx = modalStack.lastIndexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
      if (modalStack.length === 0) document.body.style.overflow = prevOverflow;
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className={cn(
          'relative w-full flex flex-col bg-surface text-fg shadow-overlay border border-line',
          'rounded-t-dialog sm:rounded-dialog max-h-[92dvh] sm:max-h-[88dvh] focus:outline-none',
          SIZES[size],
          className,
        )}
      >
        <div className={cn('flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6 pb-3', centered && 'flex-col items-center text-center')}>
          {icon && (
            <div className={cn('shrink-0', centered ? 'mb-1' : 'mt-0.5')} aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg sm:text-xl font-semibold tracking-tight font-display text-fg">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-sm text-fg-muted leading-relaxed">
                {description}
              </div>
            )}
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.closeModal')}
              title={t('common.close')}
              className={cn(
                'shrink-0 -mr-2 -mt-1 inline-flex size-11 items-center justify-center rounded-control text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors',
                centered && 'absolute right-4 top-4',
              )}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {children !== undefined && children !== null && (
          <div className={cn('flex-1 overflow-y-auto px-5 sm:px-6 py-2', !footer && 'pb-safe sm:pb-6')}>{children}</div>
        )}
        {footer && (
          <div className="px-5 sm:px-6 pt-3 pb-safe sm:pb-6 border-t border-line mt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}
