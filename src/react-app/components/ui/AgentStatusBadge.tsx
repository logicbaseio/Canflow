import { ClaudeCodeLogo, CodexLogo } from './AgentLogos';

const AGENT_NAME: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' };

// status → { label, connector, colour token }
const STATUS: Record<string, { verb: string; by: string; tone: string }> = {
  confirmed: { verb: 'Confirmed', by: 'by', tone: 'var(--text-muted)' },
  fixing:    { verb: 'Fixing',    by: 'by', tone: 'var(--blue)' },
  fixed:     { verb: 'Fixed',     by: 'by', tone: 'var(--success)' },
  blocked:   { verb: 'Needs help', by: '·', tone: 'var(--danger)' },
  not_a_bug: { verb: 'Not a bug', by: '·', tone: 'var(--text-muted)' },
};

/** A pill on a card showing which coding agent worked it and its status. */
export function AgentStatusBadge({ agent, status, className }: { agent?: string | null; status?: string | null; className?: string }) {
  if (agent !== 'claude' && agent !== 'codex') return null;
  const name = AGENT_NAME[agent] ?? agent;
  const s = STATUS[status ?? ''] ?? { verb: 'Updated', by: 'by', tone: 'var(--text-muted)' };
  const Logo = agent === 'codex' ? CodexLogo : ClaudeCodeLogo;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium ${className ?? ''}`}
      style={{ color: s.tone }}
      title={`${s.verb} ${s.by} ${name}`}
    >
      <Logo className="h-3.5 w-3.5 shrink-0" />
      {s.verb} {s.by} {name}
    </span>
  );
}
