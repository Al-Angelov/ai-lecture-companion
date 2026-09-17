"use client";

import { ProcessingState } from "@/lib/types";
import { statusText } from "@/lib/ui-logic";

interface StatusIndicatorProps {
  state: ProcessingState;
  errorMessage?: string | null;
}

/**
 * Displays the current processing state text (Requirements 1.5, 6.1-6.5, 6.7).
 */
export function StatusIndicator({ state, errorMessage }: StatusIndicatorProps) {
  const text = statusText(state, errorMessage);
  const isError = state === ProcessingState.Error;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "theme-transition text-sm font-medium",
        isError
          ? "text-red-600 dark:text-red-400"
          : "text-gray-700 dark:text-gray-300",
      ].join(" ")}
      data-testid="status-indicator"
    >
      {text}
    </div>
  );
}
