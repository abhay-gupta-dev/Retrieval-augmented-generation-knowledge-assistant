import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ChatPage, DashboardPage, DocumentsPage, ProfilePage, SettingsPage, SharedChatPage } from "./pages/DashboardPages";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/chat" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/account" element={<LoginPage allowAuthenticated />} />
    <Route path="/shared" element={<SharedChatPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/chat" replace />} />
  </Routes>;
}
