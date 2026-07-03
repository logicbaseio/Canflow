import { useEffect, useState } from 'react';
import { X, User as UserIcon, Building2, Users, Loader2, Shield, Mail, Check, Terminal, Copy, Plus, Trash2, Key, RefreshCw, Github } from 'lucide-react';
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
  token?: string | null;
  created_at: string;
  last_used_at: string | null;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode; title: string; subtitle: string }[] = [
  { id: 'profile', label: 'Profile', icon: <UserIcon size={16} />, title: 'Profile', subtitle: 'Your account details.' },
  { id: 'organization', label: 'Organization', icon: <Building2 size={16} />, title: 'Organization', subtitle: 'Name your workspace.' },
  { id: 'members', label: 'Members', icon: <Users size={16} />, title: 'Members', subtitle: 'People with access and invited testers.' },
  { id: 'developer', label: 'Developer', icon: <Terminal size={16} />, title: 'Developer', subtitle: 'Connect Claude Code or Codex to work your issues over MCP.' },
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
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [savingGithub, setSavingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

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
    setGithubToken('');
    setGithubError(null);
    authedFetch('/api/github').then((r) => r.json()).then((d) => setGithubConnected(!!d?.connected)).catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectGithub = async () => {
    setSavingGithub(true);
    setGithubError(null);
    try {
      const res = await authedFetch('/api/github', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken.trim() }),
      }).then((r) => r.json());
      if (res.error) setGithubError(res.error);
      else { setGithubConnected(!!res.connected); setGithubToken(''); }
    } catch {
      setGithubError('Failed to connect');
    } finally {
      setSavingGithub(false);
    }
  };

  const disconnectGithub = async () => {
    try {
      await authedFetch('/api/github', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: '' }) });
      setGithubConnected(false);
    } catch (e) {
      console.error('Failed to disconnect GitHub:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
        setTokens((t) => [{ id: res.id, name: res.name, token_prefix: res.token_prefix, token: res.token, created_at: res.created_at, last_used_at: null }, ...t]);
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

  // Legacy tokens (created before key storage) can't be revealed — recreate a fresh, copyable one.
  const recreateToken = async (old: TokenRow) => {
    try {
      const res = await authedFetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: old.name || 'Token' }),
      }).then((r) => r.json());
      if (res.token) {
        await authedFetch(`/api/tokens/${old.id}`, { method: 'DELETE' }).catch(() => {});
        setCreatedToken(res.token);
        setTokens((t) => [
          { id: res.id, name: res.name, token_prefix: res.token_prefix, token: res.token, created_at: res.created_at, last_used_at: null },
          ...t.filter((x) => x.id !== old.id),
        ]);
      }
    } catch (e) {
      console.error('Failed to recreate token:', e);
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
  const active = TABS.find((t) => t.id === tab)!;
  const tok = createdToken || tokens.find((t) => t.token)?.token || '<YOUR_TOKEN>';
  const claudeCmd = `claude mcp add canflow --env CANFLOW_TOKEN=${tok} -- npx -y canflow-mcp`;
  const codexCfg = `[mcp_servers.canflow]\ncommand = "npx"\nargs = ["-y", "canflow-mcp"]\nenv = { CANFLOW_TOKEN = "${tok}" }`;
  const loopCmd = `CANFLOW_TOKEN=${tok} npx -y canflow-agent --agent claude --yes`;

  return (
    <div className="fixed inset-0 z-50 bg-app text-ink flex flex-col animate-fade-in">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b border-line flex items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-md bg-surface-2 flex items-center justify-center text-ink-muted"><Terminal size={14} /></span>
          <h1 className="text-[15px] font-semibold tracking-tight">Settings</h1>
        </div>
        <button onClick={onClose} className="btn btn-ghost h-8 px-2.5 text-ink-muted gap-1.5 text-[13px]">
          <X size={16} /> Close
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left nav */}
        <nav className="w-60 shrink-0 border-r border-line p-3 overflow-y-auto hidden sm:block">
          <div className="space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-left transition-colors ${
                  tab === t.id ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile tab bar */}
        <div className="sm:hidden absolute top-14 left-0 right-0 z-10 flex gap-1 overflow-x-auto border-b border-line bg-app px-3 py-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t.id ? 'bg-accent-soft text-ink' : 'text-ink-muted'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-14 sm:pt-0">
          <div className="max-w-2xl px-8 sm:px-14 py-9">
            <div className="mb-7">
              <h2 className="text-[20px] font-semibold tracking-tight">{active.title}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">{active.subtitle}</p>
            </div>

            {tab === 'profile' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3.5">
                  <span className="h-14 w-14 rounded-full bg-accent-soft flex items-center justify-center text-[18px] font-semibold text-ink">{initial}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate">{user?.name || 'Your account'}</p>
                    <p className="text-[12.5px] text-ink-subtle truncate">{user?.email}</p>
                  </div>
                </div>
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Display name</span>
                  <input value={name} onChange={(e) => { setName(e.target.value); setSavedProfile(false); }} className="field" placeholder="Your name" />
                </label>
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Email</span>
                  <input value={user?.email || ''} disabled className="field opacity-70 cursor-not-allowed" />
                </label>
                <div className="pt-1">
                  <button onClick={saveProfile} disabled={savingProfile || !name.trim()} className="btn btn-primary h-9 px-4">
                    {savingProfile ? <Loader2 size={15} className="animate-spin" /> : savedProfile ? <><Check size={15} /> Saved</> : 'Save changes'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'organization' && (
              <div className="space-y-5">
                <label className="block max-w-md">
                  <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Organization name</span>
                  <input value={orgName} onChange={(e) => { setOrgName(e.target.value); setSavedOrg(false); }} className="field" placeholder="e.g. Acme Inc." />
                  <span className="mt-1.5 block text-[11.5px] text-ink-subtle">Shown across your workspace.</span>
                </label>
                <div className="pt-1">
                  <button onClick={saveOrg} disabled={savingOrg} className="btn btn-primary h-9 px-4">
                    {savingOrg ? <Loader2 size={15} className="animate-spin" /> : savedOrg ? <><Check size={15} /> Saved</> : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'members' && (
              <div className="space-y-6">
                <div>
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Admin</p>
                  <div className="flex items-center gap-3 card p-3">
                    <span className="h-9 w-9 rounded-full bg-accent-soft flex items-center justify-center text-[13px] font-semibold text-ink">{initial}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink truncate">{user?.name || 'You'}</p>
                      <p className="text-[12px] text-ink-subtle truncate">{user?.email}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      <Shield size={12} /> Owner
                    </span>
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                    Invited testers {invites.length > 0 && <span>· {invites.length}</span>}
                  </p>
                  {loadingInvites ? (
                    <div className="flex items-center gap-2 text-[12.5px] text-ink-muted py-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                  ) : invites.length === 0 ? (
                    <p className="text-[12.5px] text-ink-muted">
                      No testers invited yet. Open a beta-testing board → <span className="text-ink font-medium">Invite testers</span>.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {invites.map((inv) => (
                        <div key={inv.id} className="flex items-center gap-3 card p-2.5">
                          <span className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-subtle shrink-0"><Mail size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink truncate">{inv.email}</p>
                            <p className="text-[11.5px] text-ink-subtle truncate">{inv.board_title}</p>
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
              <div className="space-y-7">
                <div>
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Access tokens</p>
                  <div className="flex gap-2 max-w-lg">
                    <input value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} className="field" placeholder="Token name (e.g. My laptop)" />
                    <button onClick={createToken} disabled={creatingToken} className="btn btn-primary h-9 px-3 shrink-0">
                      {creatingToken ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> New token</>}
                    </button>
                  </div>

                  {createdToken && (
                    <div className="mt-3 max-w-lg rounded-xl border border-line p-3.5" style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)' }}>
                      <p className="text-[12.5px] font-medium text-ink mb-2">Copy your token now — it won't be shown again.</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-lg bg-surface px-3 py-2 text-[12px] font-mono text-ink border border-line">{createdToken}</code>
                        <button onClick={() => copy(createdToken, 'tok')} className="btn btn-outline h-9 px-3">{copied === 'tok' ? <Check size={15} /> : <Copy size={15} />}</button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5 max-w-lg">
                    {tokens.length === 0 ? (
                      <p className="text-[12.5px] text-ink-subtle">No tokens yet.</p>
                    ) : (
                      tokens.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 card p-2.5">
                          <span className="h-8 w-8 rounded-lg bg-surface-2 flex items-center justify-center text-ink-subtle shrink-0"><Key size={15} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink truncate">{t.name || 'Token'}</p>
                            <p className="text-[11.5px] text-ink-subtle truncate font-mono">
                              {t.token_prefix} · {t.last_used_at ? 'used' : 'never used'}
                            </p>
                          </div>
                          {t.token ? (
                            <button onClick={() => copy(t.token!, `row-${t.id}`)} className="btn btn-ghost h-8 px-2.5 text-ink-muted gap-1.5 text-[12px]" title="Copy token">
                              {copied === `row-${t.id}` ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy key</>}
                            </button>
                          ) : (
                            <button onClick={() => recreateToken(t)} className="btn btn-ghost h-8 px-2.5 text-ink-muted gap-1.5 text-[12px]" title="This token predates key storage — recreate a copyable one">
                              <RefreshCw size={14} /> Recreate
                            </button>
                          )}
                          <button onClick={() => revokeToken(t.id)} className="btn btn-ghost h-8 w-8 p-0 text-danger" title="Revoke"><Trash2 size={15} /></button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Connect your agent</p>

                  <div className="space-y-3">
                    <AgentCard
                      logo={<ClaudeCodeLogo className="h-8 w-8" />}
                      name="Claude Code"
                      hint="Run once in your terminal"
                      code={claudeCmd}
                      onCopy={() => copy(claudeCmd, 'claude')}
                      copied={copied === 'claude'}
                    />
                    <AgentCard
                      logo={<CodexLogo className="h-8 w-8" />}
                      name="Codex"
                      hint="Add to ~/.codex/config.toml"
                      code={codexCfg}
                      onCopy={() => copy(codexCfg, 'codex')}
                      copied={copied === 'codex'}
                    />
                  </div>

                  <p className="mt-3.5 text-[11.5px] text-ink-subtle leading-relaxed">
                    <code className="font-mono">canflow-mcp</code> is published on npm. Create a token above and it's filled into these commands automatically — just copy and run. Then prompt your agent: <span className="text-ink-muted italic">"Pull the bugs from my Canflow 'Issues Identified' phase, fix them, and move each to Fixing then Verified."</span>
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">Autonomous QA loop</p>
                  <p className="mb-3 text-[11.5px] text-ink-subtle leading-relaxed max-w-xl">
                    Run this from your app's repo. Canflow keeps watch and hands each report to your agent:
                    it <span className="text-ink-muted">verifies</span> whether a bug in <span className="font-mono">Testing</span> is real
                    (→ <span className="font-mono">Issues Identified</span>), then <span className="text-ink-muted">fixes</span> it
                    (→ <span className="font-mono">Fixing</span> → <span className="font-mono">Verified</span>), writing a note on each card.
                    You confirm from <span className="font-mono">Verified</span> → <span className="font-mono">Shipped</span>.
                  </p>
                  <AgentCard
                    logo={<ClaudeCodeLogo className="h-8 w-8" />}
                    name="canflow-agent"
                    hint="Run in your repo — verifies, fixes & moves cards"
                    code={loopCmd}
                    onCopy={() => copy(loopCmd, 'loop')}
                    copied={copied === 'loop'}
                  />
                  <p className="mt-2.5 text-[11.5px] text-ink-subtle leading-relaxed">
                    Add <code className="font-mono">--board &lt;id&gt;</code> to scope it to one board, <code className="font-mono">--agent codex</code> to use Codex, or <code className="font-mono">--once</code> for a single pass. Leave it running to keep the loop live.
                  </p>
                </div>

                <div>
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">GitHub</p>
                  {githubConnected ? (
                    <div className="flex items-center gap-3 card p-3 max-w-lg">
                      <Github size={18} className="text-ink-muted shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">Connected</p>
                        <p className="text-[11.5px] text-ink-subtle">Set a repo on a board (its Edit menu) to open GitHub issues from cards.</p>
                      </div>
                      <button onClick={disconnectGithub} className="btn btn-ghost h-8 px-3 text-[12.5px] text-danger shrink-0">Disconnect</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 max-w-lg">
                        <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} className="field font-mono text-[12.5px]" placeholder="GitHub personal access token" />
                        <button onClick={connectGithub} disabled={savingGithub || !githubToken.trim()} className="btn btn-primary h-9 px-3 shrink-0">
                          {savingGithub ? <Loader2 size={15} className="animate-spin" /> : 'Connect'}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-ink-subtle leading-relaxed">
                        Create a token at <span className="font-mono">github.com/settings/tokens</span> with <span className="font-mono">repo</span> scope. Then a card's <span className="text-ink">Fix with agent</span> menu can open a GitHub issue, and PRs sync the card's phase.
                      </p>
                      {githubError && <p className="mt-1.5 text-[12px] text-danger">{githubError}</p>}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ logo, name, hint, code, onCopy, copied }: {
  logo: React.ReactNode; name: string; hint: string; code: string; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <span className="shrink-0">{logo}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink leading-tight">{name}</p>
          <p className="text-[11.5px] text-ink-subtle truncate">{hint}</p>
        </div>
        <button onClick={onCopy} className="btn btn-outline h-8 px-3 gap-1.5 text-[12.5px] shrink-0">
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[12px] font-mono leading-relaxed text-ink whitespace-pre-wrap break-all bg-surface-2">{code}</pre>
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
