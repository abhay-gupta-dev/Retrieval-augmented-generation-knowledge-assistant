import type { PropsWithChildren } from "react";

export function AppLayout({ children }: PropsWithChildren) {
  return <main className="min-h-screen bg-slate-50 px-6 py-20 sm:px-12">{children}</main>;
}
