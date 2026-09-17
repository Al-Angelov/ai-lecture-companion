// Forward-only processing reducer for the Dashboard.
// Centralizes the Requirement 6.6 guarantee: transitions never decrease the
// STATE_ORDER index and never skip a stage, except a failure event may move to
// the terminal Error state from any active stage.

import { ProcessingState, STATE_ORDER } from "./types";

export interface ProcessingReducerState {
  processingState: ProcessingState;
  studyGuide: string | null;
  errorMessage: string | null;
}

export type ProcessingAction =
  | { type: "START_UPLOAD" }
  | { type: "ADVANCE_TRANSCRIBING" }
  | { type: "ADVANCE_SYNTHESIZING" }
  | { type: "COMPLETE"; studyGuide: string }
  | { type: "ERROR"; message: string };

export const initialProcessingState: ProcessingReducerState = {
  processingState: ProcessingState.Idle,
  studyGuide: null,
  errorMessage: null,
};

function ordinal(state: ProcessingState): number {
  return STATE_ORDER.indexOf(state);
}

/**
 * Returns true when moving to `target` from `current` is a legal forward-only
 * step: target must be the immediate next stage in STATE_ORDER (monotonic, no
 * going backward, and no skipping intermediate stages). Error is handled
 * separately and is not part of this check.
 */
function canAdvance(
  current: ProcessingState,
  target: ProcessingState,
): boolean {
  const from = ordinal(current);
  const to = ordinal(target);
  // Both must be in the linear order, and target is exactly one step forward.
  return from >= 0 && to >= 0 && to - from === 1;
}

export function processingReducer(
  state: ProcessingReducerState,
  action: ProcessingAction,
): ProcessingReducerState {
  switch (action.type) {
    case "START_UPLOAD": {
      // A new submission may only begin from a terminal/idle state, and always
      // resets the guide/error. Starting resets ordering to Uploading.
      if (
        state.processingState === ProcessingState.Idle ||
        state.processingState === ProcessingState.Complete ||
        state.processingState === ProcessingState.Error
      ) {
        return {
          processingState: ProcessingState.Uploading,
          studyGuide: null,
          errorMessage: null,
        };
      }
      // Already mid-submission: ignore (no backward/duplicate start).
      return state;
    }

    case "ADVANCE_TRANSCRIBING": {
      if (canAdvance(state.processingState, ProcessingState.TranscribingAudio)) {
        return { ...state, processingState: ProcessingState.TranscribingAudio };
      }
      return state;
    }

    case "ADVANCE_SYNTHESIZING": {
      if (canAdvance(state.processingState, ProcessingState.SynthesizingSlides)) {
        return {
          ...state,
          processingState: ProcessingState.SynthesizingSlides,
        };
      }
      return state;
    }

    case "COMPLETE": {
      // Because stages can be skipped dynamically (audio-only or pdf-only
      // submissions bypass a stage), COMPLETE may arrive from any active
      // in-flight stage, not just SynthesizingSlides. This still moves strictly
      // forward in STATE_ORDER (never backward), preserving the forward-only
      // guarantee; it just does not force every intermediate stage to be
      // visited when there is no work for that stage.
      const current = ordinal(state.processingState);
      const target = ordinal(ProcessingState.Complete);
      const isActiveStage =
        state.processingState === ProcessingState.Uploading ||
        state.processingState === ProcessingState.TranscribingAudio ||
        state.processingState === ProcessingState.SynthesizingSlides;
      if (isActiveStage && current >= 0 && target > current) {
        return {
          processingState: ProcessingState.Complete,
          studyGuide: action.studyGuide,
          errorMessage: null,
        };
      }
      return state;
    }

    case "ERROR": {
      // Failure escape hatch: reachable from any active stage. It preserves
      // files (this reducer does not own them) and sets the error message.
      // Do not transition to Error from a terminal Complete state.
      if (state.processingState === ProcessingState.Complete) {
        return state;
      }
      return {
        ...state,
        processingState: ProcessingState.Error,
        errorMessage: action.message,
      };
    }

    default:
      return state;
  }
}
