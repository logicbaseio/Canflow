// Branded HTML emails for Neon Auth events (send.otp / send.magic_link),
// delivered through Resend so verification & password-reset emails are on-brand.

type EventData = {
  otp_code?: string;
  otp_type?: string;   // 'sign-in' | 'email-verification' | 'forget-password'
  link_url?: string;
  link_type?: string;  // 'sign-in' | 'email-verification' | 'forget-password'
  expires_at?: string;
};
type NeonAuthEvent = {
  event_type?: string; // Neon uses "event_type" (e.g. "send.otp" / "send.magic_link")
  type?: string;       // fallback
  user?: { email?: string; name?: string };
  event_data?: EventData;
  data?: EventData;    // fallback
};

function expiresIn(iso?: string): string {
  if (!iso) return "soon";
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return "soon";
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs} hour${hrs === 1 ? "" : "s"}`;
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

function shell(inner: string): string {
  return `<!doctype html><html><head><meta name="color-scheme" content="light"></head>
  <body style="margin:0;background:#f6f6f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #ececec;border-radius:14px;overflow:hidden">
      <div style="padding:30px 32px 0;text-align:center">
        <span style="display:inline-block;width:32px;height:32px;background:#1d1d1f;border-radius:9px;vertical-align:middle"></span>
        <span style="font-size:17px;font-weight:600;color:#1d1d1f;margin-left:9px;vertical-align:middle;letter-spacing:-.2px">Canflow</span>
      </div>
      <div style="padding:22px 32px 34px">${inner}</div>
    </div>
    <p style="max-width:440px;margin:16px auto 0;text-align:center;color:#9a9aa0;font-size:11px">Canflow · <a href="https://boards.canflow.app" style="color:#9a9aa0;text-decoration:none">boards.canflow.app</a></p>
  </body></html>`;
}

const h1 = (t: string) => `<h1 style="font-size:19px;font-weight:600;color:#1d1d1f;margin:0 0 6px;text-align:center;letter-spacing:-.3px">${t}</h1>`;
const sub = (t: string) => `<p style="font-size:13.5px;color:#6b6b70;margin:0 0 20px;text-align:center;line-height:1.55">${t}</p>`;
const foot = (iso?: string) => `<p style="font-size:12px;color:#9a9aa0;margin:18px 0 0;text-align:center;line-height:1.5">This ${iso ? "expires " + expiresIn(iso) : "was requested just now"}. If you didn't request it, you can safely ignore this email.</p>`;

function codeBlock(code: string) {
  return `<div style="font-size:30px;font-weight:700;letter-spacing:9px;color:#1d1d1f;text-align:center;background:#f1f1f2;border-radius:10px;padding:17px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${esc(code)}</div>`;
}
function button(url: string, label: string) {
  return `<div style="text-align:center;margin:6px 0 2px"><a href="${esc(url)}" style="display:inline-block;background:#1d1d1f;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:9px;font-size:14px;font-weight:500">${label}</a></div>
  <p style="font-size:12px;color:#9a9aa0;margin:20px 0 0;text-align:center;line-height:1.5">Or paste this link into your browser:<br><span style="word-break:break-all;color:#6b6b70">${esc(url)}</span></p>`;
}

const COPY: Record<string, { title: string; sub: string; cta: string; subject: string }> = {
  "email-verification": { title: "Verify your email", sub: "Confirm your email to finish setting up your Canflow account.", cta: "Verify email", subject: "Verify your email · Canflow" },
  "forget-password":   { title: "Reset your password", sub: "We received a request to reset your Canflow password.", cta: "Reset password", subject: "Reset your Canflow password" },
  "sign-in":           { title: "Sign in to Canflow", sub: "Use the code below to finish signing in.", cta: "Sign in", subject: "Your Canflow sign-in code" },
};

export function buildAuthEmail(evt: NeonAuthEvent): { to: string; subject: string; html: string } | null {
  const to = evt.user?.email;
  const type = evt.event_type || evt.type;
  const d = evt.event_data || evt.data || {};
  if (!to) return null;

  if (type === "send.otp" && d.otp_code) {
    const c = COPY[d.otp_type || "sign-in"] || COPY["sign-in"];
    const subLine = d.otp_type === "email-verification"
      ? "Enter this code to confirm your email and finish setting up Canflow."
      : d.otp_type === "forget-password"
      ? "Enter this code to reset your password."
      : c.sub;
    return { to, subject: c.subject, html: shell(h1(c.title) + sub(subLine) + codeBlock(d.otp_code) + foot(d.expires_at)) };
  }

  if (type === "send.magic_link" && d.link_url) {
    const c = COPY[d.link_type || "sign-in"] || COPY["sign-in"];
    return { to, subject: c.subject, html: shell(h1(c.title) + sub(c.sub) + button(d.link_url, c.cta) + foot(d.expires_at)) };
  }

  return null;
}
