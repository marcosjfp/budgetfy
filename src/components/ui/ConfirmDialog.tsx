import React, { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from './cn';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  icon?: React.ReactNode;
  /** Extra content between description and actions (e.g. scope choices). */
  children?: React.ReactNode;
}

/** Accessible replacement for window.confirm(). Focuses Cancel first for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading,
  icon,
  children,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      size="sm"
      title={title}
      description={description}
      dismissible={!loading}
      initialFocusRef={tone === 'danger' ? cancelRef : undefined}
      icon={
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            tone === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
          )}
        >
          {icon ?? <AlertTriangle className="size-5" />}
        </span>
      }
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus={tone !== 'danger' || undefined}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
