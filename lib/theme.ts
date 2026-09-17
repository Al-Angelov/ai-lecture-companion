// Theme persistence helpers (Requirement 2). Kept framework-light so the
// storage/DOM effects are easy to reason about and the fixed key is shared.

import type { Theme } from "./types";

export const THEME_STORAGE_KEY = "ai-lecture-companion:theme";

/**
 * Reads the stored theme. Returns "light" when absent, unreadable, or invalid
 * (Requirements 2.2, 2.6).
 */
export function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Persists the theme, ignoring storage failures (Requirement 2.4). */
export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore write failures; persistence is best-effort.
  }
}

/** Applies the theme by toggling the `dark` class on the document root. */
export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
