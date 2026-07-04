import { useState } from "react";
import { Loader2, MailCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { authClient } from "@/react-app/lib/auth";

export default function VerifyEmailPage() {
  const email = (new URLSearchParams(window.location.search).get("email") || "").trim();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res: any = await authClient.emailOtp.verifyEmail({ email, otp: otp.trim() });
      if (res?.error) throw new Error(res.error.message || "That code is invalid or expired.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is invalid or expired.");
    }
    setLoading(false);
  };

  const resend = async () => {
    setResent(false);
    setError(null);
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: window.location.origin });
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch { setError("Couldn't resend. Try again in a moment."); }
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
              <h1 className="text-[20px] font-semibold tracking-tight">Email verified 🎉</h1>
              <p className="mt-2 text-[13px] text-ink-muted">Your account is active. Log in to get started.</p>
              <a href="/" className="btn btn-primary h-10 px-5 mt-5 inline-flex">Log in <ArrowRight size={15} /></a>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                  <MailCheck size={22} className="text-brand" />
                </span>
                <h1 className="text-[20px] font-semibold tracking-tight">Check your email</h1>
                <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                  {email
                    ? <>We sent a 6-digit verification code to <span className="font-medium text-ink">{email}</span>. Enter it below to verify your account.</>
                    : "Enter the 6-digit verification code we emailed you."}
                </p>
              </div>
              <form onSubmit={verify} className="mt-6 space-y-3">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="field text-center text-[22px] font-semibold tracking-[10px]"
                  autoFocus
                />
                {error && (
                  <p className="rounded-lg px-3 py-2 text-[12.5px] text-danger" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>{error}</p>
                )}
                {resent && <p className="text-[12.5px] text-success text-center">A new code is on its way.</p>}
                <button type="submit" disabled={loading || otp.length < 6} className="btn btn-primary h-10 w-full">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <>Verify &amp; continue <ArrowRight size={15} /></>}
                </button>
              </form>
              <div className="mt-4 flex items-center justify-between text-[12px]">
                <button type="button" onClick={resend} className="text-ink-muted hover:text-ink">Resend code</button>
                <a href="/" className="text-ink-muted hover:text-ink">Log in</a>
              </div>
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
