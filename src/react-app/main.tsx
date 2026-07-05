import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import { initMonitoring, Sentry } from "@/react-app/lib/monitoring";

initMonitoring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrash />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

/** Minimal, on-brand fallback if the whole app tree throws. */
function AppCrash() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--app, #f6f6f7)", color: "var(--text, #1d1d1f)", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 340 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Something went wrong</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted, #6b6b70)", lineHeight: 1.6, margin: "0 0 18px" }}>
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button onClick={() => window.location.reload()} style={{ height: 38, padding: "0 18px", borderRadius: 5, border: "none", background: "#1d1d1f", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Reload
        </button>
      </div>
    </div>
  );
}
