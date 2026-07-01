import { useEffect, useState } from 'react';
import { X, User as UserIcon, Building2, Users, Loader2, Shield, Mail, Check, Terminal, Copy, Plus, Trash2, Key } from 'lucide-react';
import { authClient, useSession, authedFetch } from '@/react-app/lib/auth';
import { ClaudeCodeLogo, CodexLogo } from '@/react-app/components/ui/AgentLogos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'organization' | 'members' | 'developer';

interface InviteRow {
  id: number;
  email: string;
  status: string;
  board_title: string;
  created_at: string;
}

interface TokenRow {
  id: number;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <UserIcon size={15} /> },
  { id: 'organization', label: 'Organization', icon: <Building2 size={15} /> },
  { id: 'members', label: 'Members', icon: <Users size={15} /> },
  { id: 'developer', label: 'Developer', icon: <Terminal size={15} /> },
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
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab('profile');
    setName(user?.name || '');
    setSavedProfile(false);
    setSavedOrg(false);
    setCreatedToken(null);
    authedFetch('/api/settings').then((r) => r.json()).then((s) => setOrgName(s?.org_name || '')).catch(() => {});
    setLoadingInvites(true);
    authedFetch('/api/invitations')
      .then((r) => r.json())
      .then((d) => setInvites(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingInvites(false));
    authedFetch('/api/tokens').then((r) => r.json()).then((d) => setTokens(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const createToken = async () => {
    setCreatingToken(true);
    try {
      const res = await authedFetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() || 'Agent token' }),
      }).then((r) => r.json());
      if (res.token) {
        setCreatedToken(res.token);
        setNewTokenName('');
        setTokens((t) => [{ id: res.id, name: res.name, token_prefix: res.token_prefix, created_at: res.created_at, last_used_at: null }, ...t]);
      }
    } catch (e) {
      console.error('Failed to create token:', e);
    } finally {
      setCreatingToken(false);
    }
  };

  const revokeToken = async (id: number) => {
    try {
      await authedFetch(`/api/tokens/${id}`, { method: 'DELETE' });
      setTokens((t) => t.filter((x) => x.id !== id));
    } catch (e) {
      console.error('Failed to revoke token:', e);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };

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
  const tok = createdToken || '<YOUR_TOKEN>';
  const claudeCmd = `claude mcp add canflow --env CANFLOW_TOKEN=${tok} -- npx -y canflow-mcp`;
  const codexCfg = `[mcp_servers.canflow]\ncommand = "npx"\nargs = ["-y", "canflow-mcp"]\nenv = { CANFLOW_TOKEN = "${tok}" }`;

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

          {tab === 'developer' && (
            <div className="space-y-5">
              <p className="text-[12.5px] text-ink-muted leading-relaxed">
                Connect Claude Code or Codex to Canflow over MCP. Create a token, add the Canflow MCP server to your agent, and it can pull issues from your beta boards and move cards as it fixes them.
              </p>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Access tokens</p>
                <div className="flex gap-2">
                  <input value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} className="field" placeholder="Token name (e.g. My laptop)" />
                  <button onClick={createToken} disabled={creatingToken} className="btn btn-primary h-9 px-3 shrink-0">
                    {creatingToken ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> New token</>}
                  </button>
                </div>

                {createdToken && (
                  <div className="mt-3 rounded-lg border border-line p-3" style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)' }}>
                    <p className="text-[12px] font-medium text-ink mb-1.5">Copy your token now — it won't be shown again.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-surface px-2.5 py-1.5 text-[11.5px] font-mono text-ink border border-line">{createdToken}</code>
                      <button onClick={() => copy(createdToken, 'tok')} className="btn btn-outline h-8 px-2.5">{copied === 'tok' ? <Check size={14} /> : <Copy size={14} />}</button>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 space-y-1.5">
                  {tokens.length === 0 ? (
                    <p className="text-[12px] text-ink-subtle">No tokens yet.</p>
                  ) : (
                    tokens.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <Key size={14} className="text-ink-subtle shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink truncate">{t.name || 'Token'}</p>
                          <p className="text-[11px] text-ink-subtle truncate font-mono">
                            {t.token_prefix}{t.last_used_at ? ' · used' : ' · never used'}
                          </p>
                        </div>
                        <button onClick={() => revokeToken(t.id)} className="btn btn-ghost h-7 w-7 p-0 text-danger" title="Revoke"><Trash2 size={14} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Connect your agent</p>

                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <ClaudeCodeLogo className="h-4 w-4" /> Claude Code
                </div>
                <CodeBlock text={claudeCmd} onCopy={() => copy(claudeCmd, 'claude')} copied={copied === 'claude'} />

                <div className="mt-3.5 mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <CodexLogo className="h-4 w-4" /> Codex
                  <span className="font-normal text-ink-muted">— add to <code className="font-mono text-[11.5px]">~/.codex/config.toml</code></span>
                </div>
                <CodeBlock text={codexCfg} onCopy={() => copy(codexCfg, 'codex')} copied={copied === 'codex'} />

                <p className="mt-2.5 text-[11px] text-ink-subtle leading-relaxed">
                  <code className="font-mono">canflow-mcp</code> is published on npm, so these commands run as-is. Create or paste a token above to fill in <code className="font-mono">CANFLOW_TOKEN</code>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ text, onCopy, copied }: { text: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative rounded-lg border border-line bg-surface-2">
      <pre className="overflow-x-auto p-3 pr-10 text-[11.5px] font-mono leading-relaxed text-ink whitespace-pre-wrap break-all">{text}</pre>
      <button onClick={onCopy} className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface hover:text-ink" title="Copy">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
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
