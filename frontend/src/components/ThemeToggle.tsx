import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Light" : "Dark";
  return <button onClick={toggleTheme} aria-label={`Switch to ${label.toLowerCase()} mode`} title={`Switch to ${label.toLowerCase()} mode`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 sm:px-3 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span className="hidden sm:inline">{label}</span></button>;
}
