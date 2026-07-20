import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, Send, Trash2 } from 'lucide-react';
import { authedFetch } from '@/react-app/lib/auth';
import { useDialog } from '@/react-app/components/ui/Dialog';
import type { Invitation } from '@/shared/types';

interface InviteListProps {
  boardId: number;
  columns: { id: number; title: string }[];
  /** Bump to reload the list (e.g. after sending a new invite). */
  refreshKey?: number;
}

// Status list of every invite sent for a board: who was invited, to which
// phase, whether they've opened their link, with copy/resend/revoke actions.
export default function InviteList({ boardId, columns, refreshKey = 0 }: InviteListProps) {
  const { toast, confirm } = useDialog();
  const [invites, setInvites] = useState<Invitation[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await authedFetch(`/api/invitations/${boardId}`);
      if (r.ok) setInvites(await r.json());
    } catch {
      /* list is best-effort */
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const copyLink = async (inv: Invitation) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invited/${inv.token}`);
      toast('Invite link copied');
    } catch {
      toast('Could not copy the link');
    }
  };

  const resend = async (inv: Invitation) => {
    setBusyId(inv.id);
    try {
      const r = await authedFetch(`/api/invitations/${inv.id}/resend`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) toast(d.error || 'Failed to resend invite');
      else if (d.emailSent) toast(`Invite re-emailed to ${inv.email}`);
      else {
        await navigator.clipboard.writeText(d.inviteUrl).catch(() => {});
        toast('Email not configured - link copied instead');
      }
    } catch {
      toast('Failed to resend invite');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (inv: Invitation) => {
    if (!(await confirm({
      title: 'Revoke invite',
      message: `${inv.email} will immediately lose access via their invite link.`,
      confirmText: 'Revoke',
      danger: true,
    }))) return;
    setBusyId(inv.id);
    try {
      const r = await authedFetch(`/api/invitations/${inv.id}`, { method: 'DELETE' });
      if (r.ok) {
        toast('Invite revoked');
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        toast(d.error || 'Failed to revoke invite');
      }
    } catch {
      toast('Failed to revoke invite');
    } finally {
      setBusyId(null);
    }
  };

  if (!invites || invites.length === 0) return null;

  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-[12px] font-medium text-ink-muted">Sent invites</p>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-line divide-y divide-line">
        {invites.map((inv) => {
          const phase = columns.find((col) => col.id === inv.column_id)?.title;
          const accepted = inv.status === 'accepted';
          return (
            <div key={inv.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-ink">{inv.email}</p>
                <p className="truncate text-[11px] text-ink-subtle">
                  {phase ? `${phase} · ` : ''}
                  {new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                  accepted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}
              >
                {accepted ? <Check size={11} /> : <Clock size={11} />}
                {accepted ? 'Accepted' : 'Pending'}
              </span>
              <div className="flex shrink-0 items-center">
                <button onClick={() => copyLink(inv)} title="Copy invite link" className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle">
                  <Copy size={13} />
                </button>
                <button onClick={() => resend(inv)} disabled={busyId === inv.id} title="Resend email" className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle">
                  <Send size={13} />
                </button>
                <button onClick={() => revoke(inv)} disabled={busyId === inv.id} title="Revoke invite" className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
