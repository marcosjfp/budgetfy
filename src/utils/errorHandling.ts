import { describeError } from '../api';
import { toast } from '../components/ui/Toast';
import { t } from '../i18n/core';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/** Log an API failure and show a translated error toast. Returns the message shown. */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  const message = describeError(error);
  console.error(`Operation ${operationType} on ${path} failed:`, error);
  toast.error(t('toast.actionFailed'), message);
  return message;
}

/** Preferred name going forward. */
export const reportError = handleFirestoreError;
