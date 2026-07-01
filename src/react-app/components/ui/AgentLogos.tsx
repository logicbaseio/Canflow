// Brand marks recreated as inline SVG for the Developer / connect UI.

/** Claude Code — orange pixel creature. */
export function ClaudeCodeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 26" className={className} aria-hidden shapeRendering="crispEdges">
      <g fill="#cd7b5b">
        {/* body */}
        <rect x="6" y="3" width="20" height="13" />
        {/* side nubs */}
        <rect x="2" y="8" width="4" height="4" />
        <rect x="26" y="8" width="4" height="4" />
        {/* legs */}
        <rect x="9" y="16" width="2.5" height="3.5" />
        <rect x="13" y="16" width="2.5" height="3.5" />
        <rect x="18.5" y="16" width="2.5" height="3.5" />
        <rect x="22.5" y="16" width="2.5" height="3.5" />
      </g>
      {/* eyes */}
      <rect x="11.5" y="6" width="2" height="4.5" fill="#fff" />
      <rect x="18.5" y="6" width="2" height="4.5" fill="#fff" />
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
        <circle cx="12" cy="12.6" r="8" />
        <circle cx="7.4" cy="9.6" r="4.2" />
        <circle cx="13" cy="7.1" r="4.7" />
        <circle cx="16.9" cy="9" r="4.4" />
        <circle cx="17.1" cy="13.6" r="4.2" />
        <circle cx="7.9" cy="15.6" r="4.2" />
        <circle cx="12.6" cy="16.6" r="4.4" />
      </g>
      {/* terminal >_ */}
      <path d="M8.1 9.1 L11.3 12 L8.1 14.9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="12.4" y="13.3" width="4" height="1.8" rx="0.9" fill="#fff" />
    </svg>
  );
}
