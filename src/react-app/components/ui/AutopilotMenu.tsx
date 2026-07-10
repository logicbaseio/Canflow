import { useState } from 'react';
import { Zap, Check } from 'lucide-react';
import { ClaudeCodeLogo, CodexLogo } from './AgentLogos';

const CONDITIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any priority' },
  { value: 'high', label: 'High priority only' },
  { value: 'medium', label: 'Medium priority only' },
  { value: 'low', label: 'Low priority only' },
];

/**
 * Board-level autopilot: auto-assign every new card (optionally of a given
 * priority) to a coding agent, so work queues itself the moment it's created.
 */
export default function AutopilotMenu({ agent, priority, onChange }: {
  agent: string | null;
  priority: string | null;
  onChange: (agent: 'claude' | 'codex' | null, priority: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const on = agent === 'claude' || agent === 'codex';
  const name = agent === 'codex' ? 'Codex' : agent === 'claude' ? 'Claude Code' : '';

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`btn h-8 px-3 ${on ? 'btn-primary' : 'btn-outline'}`} title="Autopilot">
        <Zap size={14} /> {on ? `Autopilot: ${name}` : 'Autopilot'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="menu absolute right-0 top-10 z-20 w-64 py-2">
            <div className="px-3 pb-2">
              <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5"><Zap size={13} /> Autopilot</div>
              <p className="mt-0.5 text-[11.5px] text-ink-muted leading-snug">Auto-assign new cards to an agent so they queue for pickup the moment they're created.</p>
            </div>
            <div className="my-1 h-px bg-line" />
            <div className="px-3 pt-1 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-subtle">Assign new cards to</div>
            <button className="menu-item justify-between" onClick={() => onChange(null, priority || '')}>
              <span>Off</span>{!on && <Check size={14} />}
            </button>
            <button className="menu-item justify-between" onClick={() => onChange('claude', priority || '')}>
              <span className="inline-flex items-center gap-2"><ClaudeCodeLogo className="h-3.5 w-3.5" /> Claude Code</span>{agent === 'claude' && <Check size={14} />}
            </button>
            <button className="menu-item justify-between" onClick={() => onChange('codex', priority || '')}>
              <span className="inline-flex items-center gap-2"><CodexLogo className="h-3.5 w-3.5" /> Codex</span>{agent === 'codex' && <Check size={14} />}
            </button>

            {on && (
              <>
                <div className="my-1 h-px bg-line" />
                <div className="px-3 pt-1 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-subtle">Condition</div>
                {CONDITIONS.map((pr) => (
                  <button key={pr.value} className="menu-item justify-between" onClick={() => onChange(agent as 'claude' | 'codex', pr.value)}>
                    <span>{pr.label}</span>{(priority || '') === pr.value && <Check size={14} />}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
