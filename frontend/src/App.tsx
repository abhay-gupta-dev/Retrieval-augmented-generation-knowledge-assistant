import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ChatPage, DashboardPage, DocumentsPage, ProfilePage, SettingsPage, SharedChatPage } from "./pages/DashboardPages";
import { LoginPage } from "./pages/LoginPage";
import { BillingPage } from "./pages/BillingPage";
import { LandingPage } from "./pages/LandingPage";

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
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
