import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  processingReducer,
  initialProcessingState,
  type ProcessingAction,
  type ProcessingReducerState,
} from "./reducer";
import { ProcessingState, STATE_ORDER } from "./types";

const NUM_RUNS = 100;

function ordinal(s: ProcessingState): number {
  return STATE_ORDER.indexOf(s);
}

const actionArb: fc.Arbitrary<ProcessingAction> = fc.oneof(
  fc.constant<ProcessingAction>({ type: "START_UPLOAD" }),
  fc.constant<ProcessingAction>({ type: "ADVANCE_TRANSCRIBING" }),
  fc.constant<ProcessingAction>({ type: "ADVANCE_SYNTHESIZING" }),
  fc.record({
    type: fc.constant<"COMPLETE">("COMPLETE"),
    studyGuide: fc.string(),
  }),
  fc.record({
    type: fc.constant<"ERROR">("ERROR"),
    message: fc.string(),
  }),
);

describe("processingReducer forward-only guarantee", () => {
  // Feature: ai-lecture-companion, Property 5: State transitions are forward-only within a submission
  it("Property 5: ordinal never decreases and never skips a stage, except Error escape", () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 1, maxLength: 30 }),
        (actions) => {
          let state: ProcessingReducerState = initialProcessingState;

          for (const action of actions) {
            const prev = state;
            const next = processingReducer(prev, action);

            const wasError = prev.processingState === ProcessingState.Error;
            const isError = next.processingState === ProcessingState.Error;

            if (isError && !wasError) {
              // Legal failure escape hatch from any active stage.
              continue;
            }
            if (wasError && isError) {
              // Stays in Error (no further transition) — allowed.
              expect(next.processingState).toBe(ProcessingState.Error);
              continue;
            }

            // START_UPLOAD legally resets ordering to Uploading from a
            // terminal/idle state; treat as a fresh submission boundary.
            if (
              action.type === "START_UPLOAD" &&
              next.processingState === ProcessingState.Uploading &&
              (prev.processingState === ProcessingState.Idle ||
                prev.processingState === ProcessingState.Complete ||
                prev.processingState === ProcessingState.Error)
            ) {
              continue;
            }

            const prevOrd = ordinal(prev.processingState);
            const nextOrd = ordinal(next.processingState);

            // Both should be in the linear order here.
            expect(prevOrd).toBeGreaterThanOrEqual(0);
            expect(nextOrd).toBeGreaterThanOrEqual(0);

            // Monotonic: never decreases (forward-only).
            expect(nextOrd).toBeGreaterThanOrEqual(prevOrd);

            // No skipping for the intermediate ADVANCE_* transitions: each moves
            // exactly one stage forward. COMPLETE may legally jump from any
            // active stage (a stage can have no work when a file is absent), so
            // it is exempt from the single-step rule but still moves forward.
            if (nextOrd > prevOrd && action.type !== "COMPLETE") {
              expect(nextOrd - prevOrd).toBe(1);
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("processingReducer Error invariant", () => {
  const preErrorStates: ProcessingState[] = [
    ProcessingState.Uploading,
    ProcessingState.TranscribingAudio,
    ProcessingState.SynthesizingSlides,
  ];

  // Feature: ai-lecture-companion, Property 13: Entering the Error state preserves files and re-enables the button
  it("Property 13: error from any active stage yields Error with a message set", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...preErrorStates),
        fc.string({ minLength: 1 }),
        (activeState, message) => {
          const start: ProcessingReducerState = {
            processingState: activeState,
            studyGuide: null,
            errorMessage: null,
          };

          const next = processingReducer(start, { type: "ERROR", message });

          // Resulting processing state is Error with the message set.
          expect(next.processingState).toBe(ProcessingState.Error);
          expect(next.errorMessage).toBe(message);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
