// Brand marks recreated as inline SVG. Both use a square 24×24 viewBox so they
// never distort when rendered in a square container.

/** Claude Code — orange pixel creature. */
export function ClaudeCodeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden shapeRendering="crispEdges">
      <g fill="#cd7b5b">
        {/* body */}
        <rect x="4" y="6" width="16" height="8" />
        {/* side nubs */}
        <rect x="1.5" y="9" width="2.5" height="3" />
        <rect x="20" y="9" width="2.5" height="3" />
        {/* legs (two pairs) */}
        <rect x="6" y="14" width="2" height="2.8" />
        <rect x="9.2" y="14" width="2" height="2.8" />
        <rect x="12.8" y="14" width="2" height="2.8" />
        <rect x="16" y="14" width="2" height="2.8" />
      </g>
      {/* eyes */}
      <rect x="8" y="8" width="1.6" height="3.4" fill="#fff" />
      <rect x="14.4" y="8" width="1.6" height="3.4" fill="#fff" />
    </svg>
  );
}

/** Codex — purple gradient cloud with a terminal >_. */
export function CodexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="canflow-codex-grad" gradientUnits="userSpaceOnUse" x1="12" y1="2" x2="12" y2="22">
          <stop offset="0" stopColor="#9a8cf6" />
          <stop offset="1" stopColor="#4b5ff0" />
        </linearGradient>
      </defs>
      {/* puffy cloud (overlapping circles share one userSpace gradient → seamless) */}
      <g fill="url(#canflow-codex-grad)">
        <circle cx="12" cy="12.6" r="7.6" />
        <circle cx="7.6" cy="9.8" r="4" />
        <circle cx="13" cy="7.4" r="4.5" />
        <circle cx="16.7" cy="9.2" r="4.2" />
        <circle cx="16.8" cy="13.4" r="4" />
        <circle cx="8.1" cy="15.2" r="4" />
        <circle cx="12.5" cy="16.2" r="4.2" />
      </g>
      {/* terminal >_ */}
      <path d="M8.3 9.4 L11.2 12 L8.3 14.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="12.3" y="13.1" width="3.8" height="1.7" rx="0.85" fill="#fff" />
    </svg>
  );
}
