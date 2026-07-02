import { useEffect, useState } from 'react';
import { X, Copy, Check, Github, ExternalLink, Loader2 } from 'lucide-react';
import { ClaudeCodeLogo, CodexLogo } from '@/react-app/components/ui/AgentLogos';
import { authedFetch } from '@/react-app/lib/auth';
import type { Task } from '@/shared/types';

interface FixWithModalProps {
  task: Task | null;
  boardTitle?: string;
  githubRepo?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function buildPrompt(task: Task, boardTitle?: string): string {
  const sev = task.intensity ? `Severity: ${task.intensity}/10` : task.priority ? `Priority: ${task.priority}` : '';
  return [
    `Fix this issue reported in our Canflow board${boardTitle ? ` "${boardTitle}"` : ''}.`,
    '',
    `Title: ${task.title}`,
    sev,
    task.category ? `Category: ${task.category}` : '',
    task.description ? `\nDescription:\n${task.description}` : '',
    task.image_url ? `\n(A screenshot is attached to Canflow card #${task.id}.)` : '',
    '',
    `Please investigate the root cause in this codebase, implement a fix, and summarize what you changed.`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** Wrap text as a single-quoted shell argument. */
function shArg(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export default function FixWithModal({ task, boardTitle, githubRepo, isOpen, onClose }: FixWithModalProps) {
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [ghState, setGhState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ghUrl, setGhUrl] = useState<string | null>(null);
  const [ghError, setGhError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) setPrompt(buildPrompt(task, boardTitle));
    setCopied(null);
    setGhState(task?.github_url ? 'done' : 'idle');
    setGhUrl(task?.github_url ?? null);
    setGhError(null);
  }, [isOpen, task, boardTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };

  const createGithubIssue = async () => {
    if (!task) return;
    setGhState('loading');
    setGhError(null);
    try {
      const res = await authedFetch(`/api/issues/${task.id}/github`, { method: 'POST' }).then((r) => r.json());
      if (res.url) { setGhUrl(res.url); setGhState('done'); }
      else { setGhError(res.error || 'Failed to create issue'); setGhState('error'); }
    } catch {
      setGhError('Failed to create issue');
      setGhState('error');
    }
  };

  const claudeCmd = `claude -p ${shArg(prompt)}`;
  const codexCmd = `codex exec ${shArg(prompt)}`;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }} onMouseDown={onClose}>
      <div className="card w-full max-w-lg shadow-pop flex flex-col max-h-[88vh]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <h2 className="text-[14px] font-semibold text-ink">Fix with an agent</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-[12.5px] text-ink-muted leading-relaxed">
            A prompt was generated from <span className="text-ink font-medium">"{task.title}"</span>. Edit it if you like, then copy it into Claude Code or Codex.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={9}
            className="field resize-none font-mono text-[12px] leading-relaxed"
          />

          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => copy(prompt, 'prompt')} className="btn btn-outline h-9 justify-center">
              {copied === 'prompt' ? <><Check size={15} /> Copied prompt</> : <><Copy size={15} /> Copy prompt</>}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copy(claudeCmd, 'claude')} className="btn btn-outline h-9 justify-center gap-2">
                <ClaudeCodeLogo className="h-4 w-4" />
                {copied === 'claude' ? 'Copied' : 'Claude Code'}
              </button>
              <button onClick={() => copy(codexCmd, 'codex')} className="btn btn-outline h-9 justify-center gap-2">
                <CodexLogo className="h-4 w-4" />
                {copied === 'codex' ? 'Copied' : 'Codex'}
              </button>
            </div>
          </div>

          {githubRepo && (
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink flex items-center gap-1.5"><Github size={14} /> GitHub</p>
                  <p className="text-[11.5px] text-ink-subtle truncate">Open an issue in <span className="font-mono">{githubRepo}</span> for your agent's GitHub App.</p>
                </div>
                {ghState === 'done' && ghUrl ? (
                  <a href={ghUrl} target="_blank" rel="noreferrer" className="btn btn-outline h-8 px-3 gap-1.5 text-[12.5px] shrink-0"><ExternalLink size={14} /> View issue</a>
                ) : (
                  <button onClick={createGithubIssue} disabled={ghState === 'loading'} className="btn btn-outline h-8 px-3 gap-1.5 text-[12.5px] shrink-0">
                    {ghState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />} Create issue
                  </button>
                )}
              </div>
              {ghError && <p className="mt-1.5 text-[12px] text-danger">{ghError}</p>}
            </div>
          )}

          <p className="text-[11.5px] text-ink-subtle leading-relaxed">
            The Claude Code / Codex buttons copy a ready-to-run <code className="font-mono">-p</code> / <code className="font-mono">exec</code> command. Or, if you've connected the Canflow MCP (<span className="text-ink">Settings → Developer</span>), just tell your agent: <span className="italic">"Fix Canflow issue #{task.id}"</span> and it'll pull the details and update the card itself.
          </p>
        </div>
      </div>
    </div>
  );
}
