import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-300">Restoring your secure session…</main>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}
