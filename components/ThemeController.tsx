"use client";

import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/types";

interface ThemeControllerProps {
  theme: Theme;
  onToggle: () => void;
}

/**
 * Toggle control that flips between light and dark. The actual class/storage
 * side effects are owned by the Dashboard (via lib/theme helpers) so this
 * component stays presentational. (Requirements 2.1, 2.3, 2.7)
 */
export function ThemeController({ theme, onToggle }: ThemeControllerProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-transition inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
