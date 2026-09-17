"use client";

import type { ProcessingState } from "@/lib/types";
import { isProcessButtonDisabled } from "@/lib/ui-logic";

interface ProcessButtonProps {
  audioSelected: boolean;
  slidesSelected: boolean;
  processingState: ProcessingState;
  onClick: () => void;
}

/**
 * The "Process Lecture" action control (Requirements 5.1-5.4). Disabled iff a
 * file is missing or a stage is in flight (Property 4).
 */
export function ProcessButton({
  audioSelected,
  slidesSelected,
  processingState,
  onClick,
}: ProcessButtonProps) {
  const disabled = isProcessButtonDisabled(
    audioSelected,
    slidesSelected,
    processingState,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="theme-transition inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    >
      Process Lecture
    </button>
  );
}
