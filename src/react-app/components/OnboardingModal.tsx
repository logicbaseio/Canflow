import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, Building2, LayoutGrid, Map, FlaskConical, Check } from 'lucide-react';
import { authClient, useSession, authedFetch } from '@/react-app/lib/auth';
import AvatarUpload from '@/react-app/components/ui/AvatarUpload';

/**
 * First-run onboarding for brand-new accounts. Shows only when /api/plan reports
 * onboarded=false. Walks through profile + workspace, then marks onboarding done.
 */
export default function OnboardingModal({ onDone }: { onDone?: () => void }) {
  const { data: session } = useSession();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgImage, setOrgImage] = useState<string | null>(null);

  useEffect(() => {
    authedFetch('/api/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p && p.onboarded === false) {
          setShow(true);
          // Pre-fill name + photo from the session (populated from Google on social sign-up).
          setName(session?.user?.name || '');
          if (session?.user?.image) setImage(session.user.image);
        }
      })
      .catch(() => {});
  }, [session?.user?.name, session?.user?.image]);

  if (!show) return null;

  const finish = async () => {
    setSaving(true);
    try {
      if (name.trim() || image) await authClient.updateUser({ name: name.trim() || undefined, image: image ?? undefined });
      if (orgName.trim() || orgImage) {
        await authedFetch('/api/settings', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_name: orgName.trim(), org_image: orgImage }),
        });
      }
      await authedFetch('/api/onboarding/complete', { method: 'POST' });
    } catch (e) {
      console.error('onboarding save failed', e);
    }
    setShow(false);
    onDone?.();
  };

  const next = () => setStep((s) => s + 1);
  const steps = ['welcome', 'profile', 'workspace'] as const;
  const cur = steps[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'var(--overlay)' }}>
      <div className="card w-full max-w-md shadow-pop overflow-hidden">
        {/* progress */}
        <div className="flex gap-1 px-5 pt-5">
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-3)' }} />
          ))}
        </div>

        <div className="p-6">
          {cur === 'welcome' && (
            <div className="text-center">
              <CanflowMark className="mx-auto mb-4 h-12 w-12" />
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">Welcome to Canflow 👋</h2>
              <p className="mt-2 text-[13.5px] text-ink-muted leading-relaxed">
                Plan tasks, ship roadmaps, and run beta tests - and let Claude Code / Codex triage and fix your bugs automatically. Let's set up your workspace in 30 seconds.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-[11.5px] text-ink-muted">
                <div className="card p-3"><LayoutGrid size={16} className="mx-auto mb-1.5 text-ink-subtle" />Kanban</div>
                <div className="card p-3"><Map size={16} className="mx-auto mb-1.5 text-ink-subtle" />Roadmaps</div>
                <div className="card p-3"><FlaskConical size={16} className="mx-auto mb-1.5 text-ink-subtle" />Beta tests</div>
              </div>
              <button onClick={next} className="btn btn-primary h-10 w-full mt-6">Get started <ArrowRight size={15} /></button>
            </div>
          )}

          {cur === 'profile' && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">Your profile</h2>
              <p className="mt-1 mb-5 text-[13px] text-ink-muted">How you'll show up across your boards.</p>
              <div className="mb-4">
                <AvatarUpload src={image} onChange={setImage} size={60} shape="circle" label="Upload a photo"
                  fallback={<span className="text-[18px] font-semibold text-ink">{(name || session?.user?.email || '?').charAt(0).toUpperCase()}</span>} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Display name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Your name" autoFocus />
              </label>
              <div className="mt-6 flex gap-2">
                <button onClick={next} className="btn btn-ghost h-10 px-4 text-ink-muted">Skip</button>
                <button onClick={next} className="btn btn-primary h-10 flex-1">Continue <ArrowRight size={15} /></button>
              </div>
            </div>
          )}

          {cur === 'workspace' && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">Your workspace</h2>
              <p className="mt-1 mb-5 text-[13px] text-ink-muted">Add your org name and logo - they'll brand your public roadmaps.</p>
              <div className="mb-4">
                <AvatarUpload src={orgImage} onChange={setOrgImage} size={60} shape="square" label="Upload a logo"
                  fallback={<Building2 size={22} className="text-ink-subtle" />} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Organization name</span>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="field" placeholder="e.g. Acme Inc." autoFocus />
              </label>
              <div className="mt-6 flex gap-2">
                <button onClick={finish} disabled={saving} className="btn btn-ghost h-10 px-4 text-ink-muted">Skip</button>
                <button onClick={finish} disabled={saving} className="btn btn-primary h-10 flex-1">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={15} /> Finish setup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CanflowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="22" fill="var(--accent)" />
      <rect x="24" y="24" width="16" height="52" rx="4" fill="var(--accent-fg)" />
      <rect x="46" y="24" width="16" height="34" rx="4" fill="var(--accent-fg)" />
      <rect x="68" y="24" width="8" height="24" rx="3" fill="var(--accent-fg)" />
    </svg>
  );
}
