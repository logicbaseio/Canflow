import { BrowserRouter as Router, Routes, Route } from "react-router";
import { lazy, Suspense, type ReactNode } from "react";
import { AppProvider } from "@/react-app/context/AppContext";
import { DarkModeProvider } from "@/react-app/components/DarkModeProvider";
import { DialogProvider } from "@/react-app/components/ui/Dialog";
import { useSession } from "@/react-app/lib/auth";
import HomePage from "@/react-app/pages/Home";
import AuthPage from "@/react-app/pages/Auth";

// Secondary routes reached via direct links — lazy-loaded so they stay out of
// the main app bundle.
const PublicBoardPage = lazy(() => import("@/react-app/pages/PublicBoard"));
const InvitedUserPage = lazy(() => import("@/react-app/pages/InvitedUser"));
const ResetPasswordPage = lazy(() => import("@/react-app/pages/ResetPassword"));
const VerifyEmailPage = lazy(() => import("@/react-app/pages/VerifyEmail"));

const Spinner = () => (
  <div className="h-screen flex items-center justify-center bg-app">
    <span className="h-5 w-5 rounded-full border-2 border-line border-t-ink animate-spin" />
  </div>
);

/** Gate protected routes behind Neon Auth. Public/invite links stay open. */
function Gate({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <span className="h-5 w-5 rounded-full border-2 border-line border-t-ink animate-spin" />
      </div>
    );
  }
  if (!data) return <AuthPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <DarkModeProvider>
      <DialogProvider>
        <AppProvider>
          <Router>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<Gate><HomePage /></Gate>} />
                <Route path="/public/:publicKey" element={<PublicBoardPage />} />
                <Route path="/invited/:token" element={<InvitedUserPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify" element={<VerifyEmailPage />} />
              </Routes>
            </Suspense>
          </Router>
        </AppProvider>
      </DialogProvider>
    </DarkModeProvider>
  );
}
