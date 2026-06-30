import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AppProvider } from "@/react-app/context/AppContext";
import { DarkModeProvider } from "@/react-app/components/DarkModeProvider";
import { DialogProvider } from "@/react-app/components/ui/Dialog";
import HomePage from "@/react-app/pages/Home";
import PublicBoardPage from "@/react-app/pages/PublicBoard";
import InvitedUserPage from "@/react-app/pages/InvitedUser";

export default function App() {
  return (
    <DarkModeProvider>
      <DialogProvider>
        <AppProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/public/:publicKey" element={<PublicBoardPage />} />
              <Route path="/invited/:token" element={<InvitedUserPage />} />
            </Routes>
          </Router>
        </AppProvider>
      </DialogProvider>
    </DarkModeProvider>
  );
}
