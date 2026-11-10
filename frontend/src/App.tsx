import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ChatPage, DashboardPage, DocumentsPage, ProfilePage, SettingsPage, SharedChatPage } from "./pages/DashboardPages";
import { LoginPage } from "./pages/LoginPage";
import { BillingPage } from "./pages/BillingPage";
import { LandingPage } from "./pages/LandingPage";
import { useAuth } from "./context/AuthContext";

function HomeRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] text-slate-500 dark:bg-[#0b0d12] dark:text-slate-300">Restoring your secure session…</main>;
  if (user) return <Navigate to="/chat" replace />;
  const hasPreviousSession = ["knowledge-platform:explicit-logout", "knowledge-platform:account-session", "knowledge-platform:guest-session"]
    .some((key) => window.localStorage.getItem(key) === "true");
  return hasPreviousSession ? <Navigate to="/login" replace /> : <LandingPage />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/account" element={<LoginPage allowAuthenticated />} />
    <Route path="/shared" element={<SharedChatPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/chat" replace />} />
  </Routes>;
}
