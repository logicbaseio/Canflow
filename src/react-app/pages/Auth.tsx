import { useState } from "react";
import { ArrowRight, Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authClient } from "@/react-app/lib/auth";

type Mode = "sign-in" | "sign-up" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot";

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  // Send the verification code, then hand off to the dedicated /verify page
  // (survives the auth-gate re-render that happens right after sign-up).
  const goVerify = async (addr: string) => {
    try { await authClient.sendVerificationEmail({ email: addr, callbackURL: window.location.origin }); } catch { /* best effort */ }
    window.location.assign(`/verify?email=${encodeURIComponent(addr)}`);
  };

  const googleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: window.location.origin });
      // browser redirects to Google
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isForgot) {
        const res: any = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/reset-password` });
        if (res?.error) throw new Error(res.error.message);
        setNotice({ title: "Check your inbox", body: `If an account exists for ${email.trim()}, we've sent a link to reset your password.` });
        setLoading(false);
        return;
      }
      const res: any = isSignUp
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (res?.error) {
        // Sign-in blocked because the email isn't verified → send a code and go verify.
        if (!isSignUp && /verif/i.test(res.error.message || "")) { await goVerify(email.trim()); return; }
        setError(res.error.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      // Sign-up requires email verification → send the code and go to the verify page.
      if (isSignUp) { await goVerify(email.trim()); return; }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-app text-ink px-5 py-10">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          }}
        />
        <div
          className="absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-3xl opacity-[0.10]"
          style={{ background: "var(--accent)" }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Logo className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">Canflow</span>
        </div>

        <div className="card shadow-pop p-7 sm:p-8">
          {notice ? (
            <div className="text-center py-2">
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <CheckCircle2 size={22} className="text-success" />
              </span>
              <h1 className="text-[19px] font-semibold tracking-tight">{notice.title}</h1>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">{notice.body}</p>
              <button onClick={() => switchMode("sign-in")} className="btn btn-outline h-9 px-4 mt-5">Back to sign in</button>
            </div>
          ) : (
            <>
              <h1 className="text-[21px] font-semibold tracking-tight text-center">
                {isForgot ? "Reset your password" : isSignUp ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-1.5 text-[13px] text-ink-muted text-center">
                {isForgot ? "We'll email you a link to set a new password." : isSignUp ? "Start organizing your work in minutes." : "Sign in to continue to your boards."}
              </p>

              {!isForgot && (
                <>
                  <button type="button" onClick={googleSignIn} disabled={googleLoading} className="btn btn-outline h-10 w-full mt-6 gap-2.5">
                    {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-line" />
                    <span className="text-[11.5px] text-ink-subtle">or</span>
                    <div className="h-px flex-1 bg-line" />
                  </div>

                  {/* Segmented toggle */}
                  <div className="flex gap-1 p-1 rounded-xl bg-surface-2">
                    {(["sign-in", "sign-up"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => switchMode(m)}
                        className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors ${
                          mode === m ? "bg-surface text-ink shadow-subtle" : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {m === "sign-in" ? "Sign in" : "Sign up"}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <form onSubmit={submit} className="mt-5 space-y-3">
                {isSignUp && (
                  <IconField icon={<User size={15} />}>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="field pl-9" placeholder="Full name" autoComplete="name" />
                  </IconField>
                )}
                <IconField icon={<Mail size={15} />}>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field pl-9" placeholder="Email address" autoComplete="email" required autoFocus />
                </IconField>
                {!isForgot && (
                  <IconField icon={<Lock size={15} />}>
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field pl-9 pr-9"
                      placeholder={isSignUp ? "Create a password (8+ chars)" : "Password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      required
                      minLength={8}
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink" aria-label={showPw ? "Hide password" : "Show password"}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </IconField>
                )}

                {!isSignUp && !isForgot && (
                  <div className="text-right -mt-1">
                    <button type="button" onClick={() => switchMode("forgot")} className="text-[12px] text-ink-muted hover:text-ink">Forgot password?</button>
                  </div>
                )}

                {error && (
                  <p className="rounded-lg px-3 py-2 text-[12.5px] text-danger" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary h-10 w-full mt-1">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : (
                    <>{isForgot ? "Send reset link" : isSignUp ? "Create account" : "Sign in"}<ArrowRight size={15} /></>
                  )}
                </button>

                {isForgot && (
                  <button type="button" onClick={() => switchMode("sign-in")} className="btn btn-ghost h-9 w-full text-[12.5px] text-ink-muted">Back to sign in</button>
                )}
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11.5px] text-ink-subtle">Secured by Neon Auth</p>
      </div>
    </div>
  );
}

function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">{icon}</span>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden>
      <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.75v2.98A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6V7.12H1.75a12 12 0 0 0 0 10.76L5.6 14.7Z" />
      <path fill="#EA4335" d="M12 4.75c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.7 1.19 15.1 0 12 0A12 12 0 0 0 1.75 7.12L5.6 10.1C6.5 7.39 9.02 4.75 12 4.75Z" />
    </svg>
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
