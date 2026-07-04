import { useState } from "react";
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { authClient } from "@/react-app/lib/auth";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res: any = await authClient.resetPassword({ newPassword: password, token });
      if (res?.error) throw new Error(res.error.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password. The link may have expired.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Logo className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">Canflow</span>
        </div>
        <div className="card shadow-pop p-7 sm:p-8">
          {done ? (
            <div className="text-center py-2">
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <CheckCircle2 size={22} className="text-success" />
              </span>
              <h1 className="text-[19px] font-semibold tracking-tight">Password updated</h1>
              <p className="mt-2 text-[13px] text-ink-muted">You can now sign in with your new password.</p>
              <a href="/" className="btn btn-primary h-9 px-4 mt-5 inline-flex">Go to sign in <ArrowRight size={15} /></a>
            </div>
          ) : !token ? (
            <div className="text-center py-2">
              <h1 className="text-[19px] font-semibold tracking-tight">Invalid link</h1>
              <p className="mt-2 text-[13px] text-ink-muted">This password reset link is missing or malformed. Request a new one from the sign-in page.</p>
              <a href="/" className="btn btn-outline h-9 px-4 mt-5 inline-flex">Back to sign in</a>
            </div>
          ) : (
            <>
              <h1 className="text-[21px] font-semibold tracking-tight text-center">Set a new password</h1>
              <p className="mt-1.5 text-[13px] text-ink-muted text-center">Choose a strong password for your account.</p>
              <form onSubmit={submit} className="mt-6 space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"><Lock size={15} /></span>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field pl-9 pr-9"
                    placeholder="New password (8+ chars)"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {error && (
                  <p className="rounded-lg px-3 py-2 text-[12.5px] text-danger" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>{error}</p>
                )}
                <button type="submit" disabled={loading} className="btn btn-primary h-10 w-full">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="22" fill="var(--accent)" />
      <rect x="24" y="24" width="16" height="52" rx="4" fill="var(--accent-fg)" />
      <rect x="46" y="24" width="16" height="34" rx="4" fill="var(--accent-fg)" />
      <rect x="68" y="24" width="8" height="24" rx="3" fill="var(--accent-fg)" />
    </svg>
  );
}
