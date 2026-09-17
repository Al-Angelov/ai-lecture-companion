import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { statusText, isProcessButtonDisabled, outputMode } from "./ui-logic";
import { ProcessingState } from "./types";

const NUM_RUNS = 100;

const stateArb = fc.constantFrom(
  ProcessingState.Idle,
  ProcessingState.Uploading,
  ProcessingState.TranscribingAudio,
  ProcessingState.SynthesizingSlides,
  ProcessingState.Complete,
  ProcessingState.Error,
);

describe("isProcessButtonDisabled", () => {
  // Feature: ai-lecture-companion, Property 4: Process button disabled predicate
  it("Property 4: disabled iff NEITHER file is selected or a stage is in flight", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        stateArb,
        (audioSelected, slidesSelected, state) => {
          const inFlight =
            state === ProcessingState.Uploading ||
            state === ProcessingState.TranscribingAudio ||
            state === ProcessingState.SynthesizingSlides;
          // Revised for either/or inputs: valid when at least one file present.
          const expected = (!audioSelected && !slidesSelected) || inFlight;

          expect(
            isProcessButtonDisabled(audioSelected, slidesSelected, state),
          ).toBe(expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("statusText", () => {
  // Feature: ai-lecture-companion, Property 6: Status text is total and stage-correct
  it("Property 6: every state maps to a defined, non-empty, stage-correct string", () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.option(fc.string(), { nil: undefined }),
        (state, errorMessage) => {
          const text = statusText(state, errorMessage);

          expect(typeof text).toBe("string");
          expect(text.length).toBeGreaterThan(0);

          switch (state) {
            case ProcessingState.Idle:
              expect(text).toBe("Ready");
              break;
            case ProcessingState.Uploading:
              expect(text).toBe("Uploading...");
              break;
            case ProcessingState.TranscribingAudio:
              expect(text).toBe("Transcribing Audio...");
              break;
            case ProcessingState.SynthesizingSlides:
              expect(text).toBe("Synthesizing Slides...");
              break;
            case ProcessingState.Complete:
              expect(text).toBe("Complete!");
              break;
            case ProcessingState.Error:
              // Error text is either the supplied non-blank message or a
              // non-empty generic fallback.
              if (errorMessage && errorMessage.trim().length > 0) {
                expect(text).toBe(errorMessage);
              } else {
                expect(text.length).toBeGreaterThan(0);
              }
              break;
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("outputMode", () => {
  // Feature: ai-lecture-companion, Property 12: Output rendering decision matches trimmed emptiness
  it("Property 12: render iff non-null and has a non-whitespace character", () => {
    const valueArb = fc.oneof(
      fc.constant<string | null>(null),
      fc.constant(""),
      // whitespace-only strings
      fc
        .array(fc.constantFrom(" ", "\t", "\n", "\r"), { maxLength: 8 })
        .map((cs) => cs.join("")),
      // arbitrary strings (may or may not have non-whitespace)
      fc.string(),
    );

    fc.assert(
      fc.property(valueArb, (value) => {
        const mode = outputMode(value);
        if (value === null) {
          expect(mode).toBe("placeholder");
        } else if (value.trim().length === 0) {
          expect(mode).toBe("empty");
        } else {
          expect(mode).toBe("render");
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
