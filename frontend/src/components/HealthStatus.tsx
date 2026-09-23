import { useEffect, useState } from "react";

import { getHealth, type HealthResponse } from "../services/api";

type RequestState = "loading" | "healthy" | "error";

export function HealthStatus() {
  const [state, setState] = useState<RequestState>("loading");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((response) => {
        if (active) { setHealth(response); setState("healthy"); }
      })
      .catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  const presentation = {
    loading: { label: "Checking backend…", className: "bg-slate-100 text-slate-700" },
    healthy: { label: `Backend: ${health?.status ?? "healthy"}`, className: "bg-emerald-100 text-emerald-800" },
    error: { label: "Backend unavailable — start FastAPI on port 8000", className: "bg-amber-100 text-amber-900" },
  }[state];

  return <div className={`inline-flex rounded-full px-4 py-2 text-sm font-medium ${presentation.className}`}>{presentation.label}</div>;
}
