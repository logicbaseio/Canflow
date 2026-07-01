import { useEffect, useState } from 'react';
import { X, User as UserIcon, Building2, Users, Loader2, Shield, Mail, Check } from 'lucide-react';
import { authClient, useSession, authedFetch } from '@/react-app/lib/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'organization' | 'members';

interface InviteRow {
  id: number;
  email: string;
  status: string;
  board_title: string;
  created_at: string;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <UserIcon size={15} /> },
  { id: 'organization', label: 'Organization', icon: <Building2 size={15} /> },
  { id: 'members', label: 'Members', icon: <Users size={15} /> },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data } = useSession();
  const user = data?.user;
  const [tab, setTab] = useState<Tab>('profile');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedOrg, setSavedOrg] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab('profile');
    setName(user?.name || '');
    setSavedProfile(false);
    setSavedOrg(false);
    authedFetch('/api/settings').then((r) => r.json()).then((s) => setOrgName(s?.org_name || '')).catch(() => {});
    setLoadingInvites(true);
    authedFetch('/api/invitations')
      .then((r) => r.json())
      .then((d) => setInvites(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingInvites(false));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    setSavingProfile(true);
    setSavedProfile(false);
    try {
      await authClient.updateUser({ name: name.trim() });
      setSavedProfile(true);
    } catch (e) {
      console.error('Failed to update profile:', e);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOrg = async () => {
    setSavingOrg(true);
    setSavedOrg(false);
    try {
      await authedFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_name: orgName.trim() }),
      });
      setSavedOrg(true);
    } catch (e) {
      console.error('Failed to save organization:', e);
    } finally {
      setSavingOrg(false);
    }
  };

  if (!isOpen) return null;

  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }} onMouseDown={onClose}>
      <div className="card w-full max-w-lg shadow-pop flex flex-col max-h-[85vh]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <h2 className="text-[14px] font-semibold text-ink">Settings</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t.id ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === 'profile' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center text-[16px] font-semibold text-ink">{initial}</span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink truncate">{user?.name || 'Your account'}</p>
                  <p className="text-[12px] text-ink-subtle truncate">{user?.email}</p>
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Display name</span>
                <input value={name} onChange={(e) => { setName(e.target.value); setSavedProfile(false); }} className="field" placeholder="Your name" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Email</span>
                <input value={user?.email || ''} disabled className="field opacity-70 cursor-not-allowed" />
              </label>
              <div className="flex justify-end">
                <button onClick={saveProfile} disabled={savingProfile || !name.trim()} className="btn btn-primary h-9 px-4">
                  {savingProfile ? <Loader2 size={15} className="animate-spin" /> : savedProfile ? <><Check size={15} /> Saved</> : 'Save changes'}
                </button>
              </div>
            </div>
          )}

          {tab === 'organization' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">Organization name</span>
                <input value={orgName} onChange={(e) => { setOrgName(e.target.value); setSavedOrg(false); }} className="field" placeholder="e.g. Acme Inc." />
                <span className="mt-1.5 block text-[11.5px] text-ink-subtle">Shown across your workspace.</span>
              </label>
              <div className="flex justify-end">
                <button onClick={saveOrg} disabled={savingOrg} className="btn btn-primary h-9 px-4">
                  {savingOrg ? <Loader2 size={15} className="animate-spin" /> : savedOrg ? <><Check size={15} /> Saved</> : 'Save'}
                </button>
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Admin</p>
                <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <span className="h-8 w-8 rounded-full bg-accent-soft flex items-center justify-center text-[12px] font-semibold text-ink">{initial}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink truncate">{user?.name || 'You'}</p>
                    <p className="text-[11.5px] text-ink-subtle truncate">{user?.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                    <Shield size={12} /> Owner
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                  Invited testers {invites.length > 0 && <span className="text-ink-subtle">· {invites.length}</span>}
                </p>
                {loadingInvites ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-ink-muted py-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                ) : invites.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted py-1">
                    No testers invited yet. Open a beta-testing board → <span className="text-ink">Invite testers</span>.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <span className="h-7 w-7 rounded-full bg-surface-2 flex items-center justify-center text-ink-subtle shrink-0"><Mail size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink truncate">{inv.email}</p>
                          <p className="text-[11px] text-ink-subtle truncate">{inv.board_title}</p>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || 'pending').toLowerCase();
  const color = s === 'accepted' ? 'var(--success)' : s === 'declined' ? 'var(--danger)' : 'var(--warning)';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium capitalize text-ink-muted shrink-0">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {s}
    </span>
  );
}
