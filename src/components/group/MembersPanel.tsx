import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Crown, UserMinus, Users } from 'lucide-react';
import type { Expense, Group, GroupMember } from '../../types';
import { useI18n, ROLE_KEYS } from '../../i18n';
import { Avatar, Badge, Card, ConfirmDialog, IconButton, SectionHeading } from '../ui';
import { sumBy } from './groupMath';

interface MembersPanelProps {
  group: Group;
  members: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  periodExpenses: Expense[];
  onChangeRole: (member: GroupMember, role: 'admin' | 'member') => Promise<void>;
  onRemove: (member: GroupMember) => Promise<void>;
}

export function MembersPanel({ group, members, currentUserId, isAdmin, periodExpenses, onChangeRole, onRemove }: MembersPanelProps) {
  const { t, label, formatCurrency } = useI18n();
  const [toRemove, setToRemove] = useState<GroupMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  return (
    <section aria-labelledby="members-title">
      <SectionHeading id="members-title" title={t('group.members')} icon={<Users className="size-5" />} action={<Badge>{members.length}</Badge>} />
      <Card padding="none">
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const isOwner = member.uid === group.createdBy;
            const paid = sumBy(
              periodExpenses.filter((e) => e.paidBy === member.uid),
              (e) => e.amount,
            );
            const canManage = isAdmin && member.uid !== currentUserId && !isOwner;
            const promote = member.role !== 'admin';
            return (
              <li key={member.uid} className="flex items-center gap-3 p-3 sm:p-4">
                <Avatar name={member.displayName || member.email} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">
                    {member.displayName}
                    {member.uid === currentUserId && <span className="font-normal text-fg-subtle"> ({t('group.you')})</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {isOwner ? (
                      <Badge tone="brand" icon={<Crown />}>
                        {t('group.ownerLabel')}
                      </Badge>
                    ) : (
                      <Badge tone={member.role === 'admin' ? 'brand' : 'neutral'}>{label(ROLE_KEYS, member.role)}</Badge>
                    )}
                    <span className="text-xs text-fg-subtle tabular">{t('group.memberPaid', { amount: formatCurrency(paid) })}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center shrink-0">
                    <IconButton
                      size="sm"
                      disabled={busyUid === member.uid}
                      label={promote ? t('group.promoteNamed', { name: member.displayName ?? '' }) : t('group.demoteNamed', { name: member.displayName ?? '' })}
                      icon={promote ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
                      onClick={async () => {
                        setBusyUid(member.uid);
                        try {
                          await onChangeRole(member, promote ? 'admin' : 'member');
                        } finally {
                          setBusyUid(null);
                        }
                      }}
                    />
                    <IconButton
                      size="sm"
                      variant="danger"
                      label={t('group.removeNamed', { name: member.displayName ?? '' })}
                      icon={<UserMinus className="size-4" />}
                      onClick={() => setToRemove(member)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        loading={removing}
        title={t('group.removeMember')}
        description={t('group.confirmRemoveMember', { name: toRemove?.displayName ?? '' })}
        confirmLabel={t('group.removeConfirm')}
        icon={<UserMinus className="size-5" />}
        onConfirm={async () => {
          if (!toRemove) return;
          setRemoving(true);
          try {
            await onRemove(toRemove);
            setToRemove(null);
          } catch {
            // reported by caller
          } finally {
            setRemoving(false);
          }
        }}
      />
    </section>
  );
}
