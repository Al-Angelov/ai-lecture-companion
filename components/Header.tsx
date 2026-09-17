"use client";

import type { Theme } from "@/lib/types";
import { ThemeController } from "./ThemeController";

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

/**
 * Header with the fixed application title and the theme toggle.
 * (Requirements 1.1, 2.7)
 */
export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="theme-transition flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
        AI Lecture Companion
      </h1>
      <ThemeController theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
