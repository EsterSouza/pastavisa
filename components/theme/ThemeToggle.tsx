"use client";

import { nextTheme, THEME_STORAGE_KEY } from "@/components/theme/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggleTheme() {
    const root = document.documentElement;
    const theme = nextTheme(root.dataset.theme);
    root.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar entre modo claro e escuro"
      title="Alternar entre modo claro e escuro"
      className={`theme-toggle inline-flex min-h-11 items-center gap-2 rounded-md border border-shell-border px-3 text-sm font-semibold text-shell-text hover:bg-shell-hover ${className}`}
    >
      <svg className="theme-icon-light h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42M7.06 16.94l-1.42 1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <svg className="theme-icon-dark hidden h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 15.1A8.5 8.5 0 0 1 8.9 4a8.5 8.5 0 1 0 11.1 11.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span>Tema</span>
    </button>
  );
}
