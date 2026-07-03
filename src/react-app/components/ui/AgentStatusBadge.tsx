import { agentIdentity } from './AgentLogos';

// status → { label, connector, colour token }. Covers both the autonomous runner's
// vocabulary and the manual update_issue_agent set; unknown values fall back gracefully.
const STATUS: Record<string, { verb: string; by: string; tone: string }> = {
  confirmed:      { verb: 'Confirmed', by: 'by', tone: 'var(--text-muted)' },
  working:        { verb: 'Working',   by: 'by', tone: 'var(--warning)' },
  fixing:         { verb: 'Fixing',    by: 'by', tone: 'var(--blue)' },
  fixed:          { verb: 'Fixed',     by: 'by', tone: 'var(--blue)' },
  verified:       { verb: 'Verified',  by: 'by', tone: 'var(--success)' },
  'needs-review': { verb: 'Needs review', by: '·', tone: 'var(--warning)' },
  needs_review:   { verb: 'Needs review', by: '·', tone: 'var(--warning)' },
  blocked:        { verb: 'Needs help', by: '·', tone: 'var(--danger)' },
  not_a_bug:      { verb: 'Not a bug', by: '·', tone: 'var(--text-muted)' },
};

/** A pill on a card showing which coding agent worked it and its status. */
export function AgentStatusBadge({ agent, status, className }: { agent?: string | null; status?: string | null; className?: string }) {
  if (!agent) return null;
  const { name, Logo } = agentIdentity(agent);
  const s = STATUS[(status ?? '').toLowerCase()] ?? { verb: 'Updated', by: 'by', tone: 'var(--text-muted)' };
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
