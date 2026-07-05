// Dependency-free Sentry reporter for the Vercel Edge runtime. The official SDK
// isn't edge-friendly, so we POST a minimal event envelope directly. No-ops
// unless SENTRY_DSN is set, and never throws or blocks the response.

export function reportServerError(err: unknown, context: Record<string, unknown> = {}): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // DSN shape: https://<publicKey>@<host>/<projectId>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, publicKey, host, projectId] = m;

    const error = err instanceof Error ? err : new Error(String(err));
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      environment: process.env.VERCEL_ENV || "production",
      server_name: "canflow-api",
      exception: { values: [{ type: error.name || "Error", value: error.message || String(err), stacktrace: framesFrom(error) }] },
      tags: { runtime: "edge" },
      extra: context,
    };

    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");

    // Fire-and-forget: telemetry must never delay or fail the request.
    fetch(`https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    }).catch(() => {});
  } catch {
    /* never throw from telemetry */
  }
}

function framesFrom(error: Error): { frames: { function: string }[] } | undefined {
  const lines = (error.stack || "").split("\n").slice(1, 30);
  // Sentry expects frames oldest-first.
  const frames = lines.map((l) => ({ function: l.trim() })).filter((f) => f.function).reverse();
  return frames.length ? { frames } : undefined;
}
