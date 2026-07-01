import { useState } from "react";
import { ArrowRight, Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/react-app/lib/auth";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "sign-up";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = isSignUp
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (res?.error) {
        setError(res.error.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
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
          <h1 className="text-[21px] font-semibold tracking-tight text-center">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-muted text-center">
            {isSignUp ? "Start organizing your work in minutes." : "Sign in to continue to your boards."}
          </p>

          {/* Segmented toggle */}
          <div className="mt-6 flex gap-1 p-1 rounded-xl bg-surface-2">
            {(["sign-in", "sign-up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-colors ${
                  mode === m ? "bg-surface text-ink shadow-subtle" : "text-ink-muted hover:text-ink"
                }`}
              >
                {m === "sign-in" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {isSignUp && (
              <IconField icon={<User size={15} />}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field pl-9"
                  placeholder="Full name"
                  autoComplete="name"
                />
              </IconField>
            )}
            <IconField icon={<Mail size={15} />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field pl-9"
                placeholder="Email address"
                autoComplete="email"
                required
                autoFocus
              />
            </IconField>
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
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </IconField>

            {error && (
              <p className="rounded-lg px-3 py-2 text-[12.5px] text-danger" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary h-10 w-full mt-1">
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create account" : "Sign in"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
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
