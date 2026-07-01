import claudeCodeSrc from '@/react-app/assets/claudecode-color.png';
import codexSrc from '@/react-app/assets/codex.webp';

export function ClaudeCodeLogo({ className }: { className?: string }) {
  return <img src={claudeCodeSrc} alt="Claude Code" className={`${className ?? ''} object-contain`} />;
}

export function CodexLogo({ className }: { className?: string }) {
  return <img src={codexSrc} alt="Codex" className={`${className ?? ''} object-contain`} />;
}
