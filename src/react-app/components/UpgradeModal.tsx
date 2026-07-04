import { useEffect, useState } from 'react';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';

const PRO_FEATURES = [
  'Unlimited boards',
  'Unlimited beta testers',
  'Unlimited autonomous agent actions',
  'GitHub bridge — open & sync issues',
  'Full activity history (no 14-day limit)',
  'Custom organization branding',
];

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;          // e.g. "Free plan is limited to 2 boards."
  price?: number;           // monthly, defaults to 7
}

export default function UpgradeModal({ isOpen, onClose, reason, price = 7 }: UpgradeModalProps) {
  const [pending, setPending] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => { if (isOpen) { setPending(false); setNotified(false); } }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Payments are wired up separately (Stripe). For now, register interest.
  const upgrade = () => {
    setPending(true);
    setTimeout(() => { setPending(false); setNotified(true); }, 600);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }} onMouseDown={onClose}>
      <div className="card w-full max-w-md shadow-pop overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[14px] font-semibold text-ink flex items-center gap-2"><Sparkles size={16} className="text-brand" /> Upgrade to Pro</h2>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0 text-ink-subtle"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {reason && (
            <div className="rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-ink-muted">{reason}</div>
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-[30px] font-semibold tracking-tight text-ink">${price}</span>
            <span className="text-[13px] text-ink-subtle">/ month</span>
          </div>

          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[13px] text-ink">
                <span className="h-4 w-4 rounded-full bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                  <Check size={11} className="text-success" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {notified ? (
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-muted flex items-center gap-2">
              <Check size={15} className="text-success shrink-0" />
              Thanks! Card payments launch shortly — we'll email you the moment Pro is live.
            </div>
          ) : (
            <button onClick={upgrade} disabled={pending} className="btn btn-primary w-full h-10">
              {pending ? <Loader2 size={16} className="animate-spin" /> : `Upgrade to Pro — $${price}/mo`}
            </button>
          )}
          <p className="text-center text-[11px] text-ink-subtle">Cancel anytime. Your data stays yours.</p>
        </div>
      </div>
    </div>
  );
}
