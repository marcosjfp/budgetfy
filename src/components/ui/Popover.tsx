import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './cn';

interface TriggerProps {
  ref: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog' | 'menu';
}

interface PopoverProps {
  trigger: (props: TriggerProps) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  /** Accessible name for the panel. */
  label: string;
  kind?: 'dialog' | 'menu';
  panelClassName?: string;
}

/** Lightweight anchored panel: closes on Esc / outside click and returns focus to the trigger. */
export function Popover({ trigger, children, align = 'right', label, kind = 'dialog', panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    const first = panelRef.current?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-controls': id,
        'aria-haspopup': kind,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={id}
            role={kind === 'menu' ? 'menu' : 'dialog'}
            aria-label={label}
            tabIndex={-1}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full mt-2 z-50 rounded-card border border-line bg-surface shadow-overlay focus:outline-none',
              'max-w-[calc(100vw-2rem)]',
              align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
              panelClassName,
            )}
          >
            {children(() => close())}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
