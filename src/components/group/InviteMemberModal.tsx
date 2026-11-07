import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { GroupMember } from '../../types';
import { apiFetch, describeError } from '../../api';
import { useI18n } from '../../i18n';
import { Button, Modal, TextField, toast } from '../ui';

interface InviteMemberModalProps {
  open: boolean;
  groupId: string;
  onClose: () => void;
  /** `member` is null if the server didn't return it (the caller reloads the list anyway). */
  onAdded: (member: GroupMember | null) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add an existing Budgetfy user to the group by email (admins only; enforced by the API). */
export function InviteMemberModal({ open, groupId, onClose, onAdded }: InviteMemberModalProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setEmail('');
    setError(undefined);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError(t('invite.invalidEmail'));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const res = (await apiFetch(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ email: value }) })) as {
        member?: GroupMember;
      } | null;
      const member = res?.member ?? null;
      toast.success(t('invite.successNamed', { name: member?.displayName || member?.email || value }));
      onAdded(member);
      setEmail('');
      onClose();
    } catch (err) {
      // USER_NOT_FOUND / ALREADY_MEMBER / ADMIN_REQUIRED / RATE_LIMITED… are translated by code.
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!saving}
      icon={<UserPlus className="size-5" />}
      title={t('invite.title')}
      description={t('invite.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="invite-member-form" loading={saving}>
            {t('invite.submit')}
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={submit} noValidate className="space-y-4 pb-2">
        <TextField
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          label={t('invite.email')}
          placeholder={t('invite.emailPlaceholder')}
          hint={t('invite.hint')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          error={error}
          required
          maxLength={254}
          data-autofocus
        />
      </form>
    </Modal>
  );
}
