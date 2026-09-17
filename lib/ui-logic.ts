// Pure UI-decision helpers shared by components and their property tests.

import { ProcessingState } from "./types";

/**
 * Status text mapping (Requirements 6.1-6.5, 6.7). Total over ProcessingState:
 * every state maps to a defined, non-empty string. For Error, the caller may
 * supply a specific error message; otherwise a generic fallback is used.
 */
export function statusText(
  state: ProcessingState,
  errorMessage?: string | null,
): string {
  switch (state) {
    case ProcessingState.Idle:
      return "Ready";
    case ProcessingState.Uploading:
      return "Uploading...";
    case ProcessingState.TranscribingAudio:
      return "Transcribing Audio...";
    case ProcessingState.SynthesizingSlides:
      return "Synthesizing Slides...";
    case ProcessingState.Complete:
      return "Complete!";
    case ProcessingState.Error:
      return errorMessage && errorMessage.trim().length > 0
        ? errorMessage
        : "Processing failed. Please try again.";
    default: {
      // Exhaustiveness guard: if a new state is added, this forces an update.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/**
 * Process button disabled predicate (Requirements 5.2, 5.3 — Property 4):
 * disabled iff either file is unselected OR the processing state is one of the
 * active in-flight stages.
 */
export function isProcessButtonDisabled(
  audioSelected: boolean,
  slidesSelected: boolean,
  state: ProcessingState,
): boolean {
  const inFlight =
    state === ProcessingState.Uploading ||
    state === ProcessingState.TranscribingAudio ||
    state === ProcessingState.SynthesizingSlides;
  return !audioSelected || !slidesSelected || inFlight;
}

/**
 * Output rendering decision (Requirements 9.1, 9.3, 9.4 — Property 12):
 *  - "placeholder": studyGuide is null (none received yet).
 *  - "empty":       studyGuide is present but has no non-whitespace character.
 *  - "render":      studyGuide has at least one non-whitespace character.
 */
export type OutputMode = "placeholder" | "empty" | "render";

export function outputMode(studyGuide: string | null): OutputMode {
  if (studyGuide === null) return "placeholder";
  if (studyGuide.trim().length === 0) return "empty";
  return "render";
}
