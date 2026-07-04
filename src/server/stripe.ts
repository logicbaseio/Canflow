// Minimal, edge-runtime-safe Stripe client: direct REST calls + manual webhook
// signature verification (SubtleCrypto). Avoids the Node-only Stripe SDK so it
// runs on Vercel Edge without bundle/runtime issues.

const API = "https://api.stripe.com/v1";

/** POST form-encoded params to the Stripe API. `params` keys may be bracketed (e.g. "line_items[0][price]"). */
export async function stripeFetch(secret: string, path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const body = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  return data;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Verify a Stripe webhook signature (t=…,v1=…) and return the parsed event. Throws if invalid. */
export async function verifyStripeEvent(rawBody: string, sigHeader: string, secret: string): Promise<any> {
  if (!secret) throw new Error("Webhook secret not configured");
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k === "t") parts.t = v;
    if (k === "v1") parts.v1 = v; // last v1 wins; fine for a single signature
  }
  if (!parts.t || !parts.v1) throw new Error("Malformed signature header");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${rawBody}`)));
  // constant-time-ish compare
  if (expected.length !== parts.v1.length) throw new Error("Signature mismatch");
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  if (diff !== 0) throw new Error("Signature mismatch");
  return JSON.parse(rawBody);
}
