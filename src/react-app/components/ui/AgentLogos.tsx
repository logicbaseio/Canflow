// Small brand marks recreated as inline SVG for the Developer / connect UI.

export function ClaudeCodeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="canflow-cc-grad" gradientUnits="userSpaceOnUse" x1="12" y1="2" x2="12" y2="22">
          <stop offset="0" stopColor="#9a8cf6" />
          <stop offset="1" stopColor="#4b5ff0" />
        </linearGradient>
      </defs>
      {/* puffy cloud (overlapping circles share one userSpace gradient → seamless) */}
      <g fill="url(#canflow-cc-grad)">
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

export function CodexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden shapeRendering="crispEdges">
      <g fill="#cd7b5b">
        {/* body */}
        <rect x="3.3" y="5" width="17.4" height="12.3" />
        {/* side bumps */}
        <rect x="0" y="11.3" width="3.3" height="3.2" />
        <rect x="20.7" y="11.3" width="3.3" height="3.2" />
        {/* legs */}
        <rect x="4.4" y="17.3" width="1.5" height="3" />
        <rect x="6.9" y="17.3" width="1.4" height="3" />
        <rect x="15.7" y="17.3" width="1.4" height="3" />
        <rect x="18.1" y="17.3" width="1.5" height="3" />
      </g>
      {/* eyes */}
      <rect x="6" y="7.9" width="1.3" height="3.6" fill="#fff" />
      <rect x="16.7" y="7.9" width="1.3" height="3.6" fill="#fff" />
    </svg>
  );
}
