import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "@/react-app/lib/auth";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      // Session is now active — reload into the gated app.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-app text-ink">
      {/* Brand panel */}
      <div
        className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="text-[16px] font-semibold tracking-tight">Canflow</span>
        </div>

        <div className="max-w-sm">
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-tight">
            Plan tasks, ship roadmaps, run beta tests.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed opacity-70">
            A minimal workspace for your boards — organized, private to you, and shareable when you want.
          </p>
          <div className="mt-8 space-y-2.5 text-[13px] opacity-80">
            <Feature>Kanban, Roadmap & Beta-testing boards</Feature>
            <Feature>Drag-and-drop, priorities, due dates</Feature>
            <Feature>Public share links & tester invites</Feature>
          </div>
        </div>

        <p className="text-[12px] opacity-50">Secured by Neon Auth</p>

        {/* subtle decorative grid */}
        <div
          className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full opacity-[0.06]"
          style={{ background: "var(--accent-fg)" }}
        />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <Logo className="h-7 w-7" />
            <span className="text-[16px] font-semibold tracking-tight">Canflow</span>
          </div>

          <h2 className="text-[22px] font-semibold tracking-tight">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {isSignUp ? "Start organizing your work in minutes." : "Sign in to continue to your boards."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            {isSignUp && (
              <Field label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={8}
              />
            </Field>

            {error && (
              <p className="text-[12.5px] text-danger bg-[color:var(--danger)]/10 rounded-lg px-3 py-2">{error}</p>
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

          <p className="mt-6 text-center text-[13px] text-ink-muted">
            {isSignUp ? "Already have an account?" : "New to Canflow?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignUp ? "sign-in" : "sign-up");
                setError(null);
              }}
              className="font-medium text-ink hover:underline"
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-fg)", opacity: 0.6 }} />
      {children}
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="22" fill="var(--accent-fg)" />
      <rect x="24" y="24" width="16" height="52" rx="4" fill="var(--accent)" />
      <rect x="46" y="24" width="16" height="34" rx="4" fill="var(--accent)" />
      <rect x="68" y="24" width="8" height="24" rx="3" fill="var(--accent)" />
    </svg>
  );
}
