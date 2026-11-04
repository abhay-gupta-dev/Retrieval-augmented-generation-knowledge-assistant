import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function ProfileMenu({ align = "left" }: { align?: "left" | "right" }) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  const initial = user.name.charAt(0).toUpperCase();

  const isGuest = user.provider === "guest";
  return <div className="relative"><button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className="flex items-center gap-2 rounded-full p-1 text-left text-slate-700 hover:bg-slate-100 dark:text-[#d8e7df] dark:hover:bg-white/10">{user.profile_picture ? <img src={user.profile_picture} alt="" className="size-9 rounded-full" referrerPolicy="no-referrer" /> : <span className="grid size-9 place-items-center rounded-full bg-teal-300 font-semibold text-[#102522]">{initial}</span>}<span className="hidden text-sm font-medium sm:block">{user.name}</span></button>{isOpen && <div className={`absolute z-40 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white ${align === "right" ? "right-0 top-full mt-2" : "bottom-12 left-0"}`}><div className="border-b border-slate-100 px-2 pb-3 dark:border-slate-800"><p className="font-medium">{user.name}</p><p className="truncate text-sm text-slate-500">{isGuest ? "Temporary browser workspace" : user.email}</p></div>{isGuest && <button type="button" onClick={() => { setIsOpen(false); navigate("/account"); }} className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-slate-100 dark:text-teal-300 dark:hover:bg-slate-800">Sign in or create account</button>}<button type="button" onClick={() => { setIsOpen(false); navigate("/settings"); }} className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Profile settings</button><button type="button" onClick={async () => { await logout(); navigate("/login", { replace: true }); }} className="w-full rounded-lg px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Log out</button></div>}</div>;
}
