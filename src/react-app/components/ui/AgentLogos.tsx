import { Bot } from 'lucide-react';
import claudeCodeSrc from '@/react-app/assets/claudecode-color.png';
import codexSrc from '@/react-app/assets/codex.webp';

export function ClaudeCodeLogo({ className }: { className?: string }) {
  return <img src={claudeCodeSrc} alt="Claude Code" className={`${className ?? ''} object-contain`} />;
}

export function CodexLogo({ className }: { className?: string }) {
  return <img src={codexSrc} alt="Codex" className={`${className ?? ''} object-contain`} />;
}

export function GenericAgentLogo({ className }: { className?: string }) {
  return <Bot className={`${className ?? ''} text-ink-muted`} strokeWidth={2} />;
}

type AgentLogo = (props: { className?: string }) => React.ReactNode;

/**
 * Resolve an agent slug to a display name + logo.
 * Known agents get their real logo; unknown slugs fall back to a generic robot
 * icon and the raw slug, so any future agent still renders sensibly.
 */
export function agentIdentity(slug?: string | null): { name: string; Logo: AgentLogo } {
  const s = (slug ?? '').trim().toLowerCase();
  if (!s) return { name: 'Agent', Logo: GenericAgentLogo };
  if (s.includes('claude')) return { name: 'Claude Code', Logo: ClaudeCodeLogo };
  if (s.includes('codex') || s.includes('openai') || s.includes('gpt')) return { name: 'Codex', Logo: CodexLogo };
  return { name: slug!.trim(), Logo: GenericAgentLogo };
}
