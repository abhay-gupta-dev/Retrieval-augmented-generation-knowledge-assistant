import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  const initial = user.name.charAt(0).toUpperCase();

  return <div className="relative"><button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className="flex items-center gap-2 rounded-full p-1 text-left text-[#d8e7df] hover:bg-white/10">{user.profile_picture ? <img src={user.profile_picture} alt="" className="size-9 rounded-full" referrerPolicy="no-referrer" /> : <span className="grid size-9 place-items-center rounded-full bg-teal-300 font-semibold text-[#102522]">{initial}</span>}<span className="hidden text-sm font-medium sm:block">{user.name}</span></button>{isOpen && <div className="absolute bottom-12 left-0 z-40 w-72 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"><div className="border-b border-slate-100 px-2 pb-3 dark:border-slate-800"><p className="font-medium">{user.name}</p><p className="truncate text-sm text-slate-500">{user.email}</p></div><button type="button" onClick={() => { setIsOpen(false); navigate("/settings"); }} className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Profile settings</button><button type="button" onClick={async () => { await logout(); navigate("/login", { replace: true }); }} className="w-full rounded-lg px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">Log out</button></div>}</div>;
}
