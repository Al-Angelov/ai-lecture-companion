import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateFile,
  applySelection,
  resolveMultiDrop,
  getExtension,
  type ValidatableFile,
} from "./validation";
import { AUDIO_CONFIG, SLIDES_CONFIG, type FileValidationConfig } from "./types";

const NUM_RUNS = 100;

// Arbitrary that produces a filename with a chosen extension token appended.
// `ext` may be "" to represent a name with no usable extension.
function nameWithExt(base: string, ext: string): string {
  return ext === "" ? base : `${base}${ext}`;
}

// A pool of extensions: some accepted (across both configs), some not.
const extArb = fc.constantFrom(
  ".mp3",
  ".wav",
  ".m4a",
  ".MP3",
  ".WAV",
  ".M4A",
  ".pdf",
  ".PDF",
  ".txt",
  ".exe",
  ".png",
  ".mp4",
  "", // no extension
);

const configArb = fc.constantFrom(AUDIO_CONFIG, SLIDES_CONFIG);

// Reference oracle for validity, independent of the implementation.
function isValid(
  name: string,
  size: number,
  config: FileValidationConfig,
): boolean {
  const lastDot = name.lastIndexOf(".");
  const ext =
    lastDot <= 0 || lastDot === name.length - 1
      ? ""
      : name.slice(lastDot).toLowerCase();
  const accepted = config.acceptedExtensions.map((e) => e.toLowerCase());
  return accepted.includes(ext) && size <= config.maxSizeBytes;
}

describe("validateFile", () => {
  // Feature: ai-lecture-companion, Property 1: File validation is exactly extension-and-size
  it("Property 1: accepts iff extension is accepted (case-insensitive) and size <= max", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !s.includes(".")),
        extArb,
        fc.integer({ min: 0, max: 600_000_000 }),
        configArb,
        (base, ext, size, config) => {
          const name = nameWithExt(base, ext);
          const result = validateFile({ name, size }, config);
          const expectedOk = isValid(name, size, config);

          expect(result.ok).toBe(expectedOk);

          if (!expectedOk) {
            // Message must be the config's own wrong-format or oversize message.
            const extLower = getExtension(name);
            const accepted = config.acceptedExtensions.map((e) =>
              e.toLowerCase(),
            );
            if (!accepted.includes(extLower)) {
              expect(result.message).toBe(config.wrongFormatMessage);
            } else {
              expect(result.message).toBe(config.oversizeMessage);
            }
          } else {
            expect(result.message).toBeUndefined();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("applySelection", () => {
  // Feature: ai-lecture-companion, Property 2: Rejecting an invalid file preserves the current valid selection
  it("Property 2: invalid offered file keeps current; valid offered file replaces it", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes(".")),
        extArb,
        fc.integer({ min: 0, max: 600_000_000 }),
        configArb,
        (base, ext, size, config) => {
          // Establish a known-valid current selection for the config.
          const current: ValidatableFile = {
            name: `current${config.acceptedExtensions[0]}`,
            size: 1,
          };
          const offered: ValidatableFile = { name: nameWithExt(base, ext), size };

          const { file } = applySelection(current, offered, config);
          const offeredValid = isValid(offered.name, offered.size, config);

          if (offeredValid) {
            expect(file).toBe(offered);
          } else {
            expect(file).toBe(current);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("resolveMultiDrop", () => {
  // Feature: ai-lecture-companion, Property 3: Multi-file drop policy per zone
  it("Property 3: audio rejects multi-drop; slides takes the first", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 8 }),
            size: fc.integer({ min: 0, max: 1000 }),
          }),
          { minLength: 2, maxLength: 6 },
        ),
        (files) => {
          const audio = resolveMultiDrop(files, AUDIO_CONFIG);
          expect(audio.rejected).toBe(true);
          expect(audio.candidate).toBeNull();
          expect(audio.message).toBe(AUDIO_CONFIG.multiDropMessage);

          const slides = resolveMultiDrop(files, SLIDES_CONFIG);
          expect(slides.rejected).toBe(false);
          expect(slides.candidate).toBe(files[0]);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("passes a single-file drop through under either policy", () => {
    const one = [{ name: "a.mp3", size: 1 }];
    expect(resolveMultiDrop(one, AUDIO_CONFIG).candidate).toBe(one[0]);
    expect(resolveMultiDrop(one, AUDIO_CONFIG).rejected).toBe(false);
    expect(resolveMultiDrop(one, SLIDES_CONFIG).candidate).toBe(one[0]);
  });
});

describe("validation edge cases", () => {
  it("accepts a file exactly at the max size", () => {
    expect(
      validateFile(
        { name: "lecture.mp3", size: AUDIO_CONFIG.maxSizeBytes },
        AUDIO_CONFIG,
      ).ok,
    ).toBe(true);
  });

  it("rejects a file one byte over the max size", () => {
    const result = validateFile(
      { name: "lecture.mp3", size: AUDIO_CONFIG.maxSizeBytes + 1 },
      AUDIO_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toBe(AUDIO_CONFIG.oversizeMessage);
  });

  it("matches extensions case-insensitively (.MP3)", () => {
    expect(validateFile({ name: "LECTURE.MP3", size: 10 }, AUDIO_CONFIG).ok).toBe(
      true,
    );
    expect(validateFile({ name: "deck.PDF", size: 10 }, SLIDES_CONFIG).ok).toBe(
      true,
    );
  });

  it("rejects a file with no extension", () => {
    const result = validateFile({ name: "noextension", size: 10 }, AUDIO_CONFIG);
    expect(result.ok).toBe(false);
    expect(result.message).toBe(AUDIO_CONFIG.wrongFormatMessage);
  });

  it("treats an empty extension segment as no extension", () => {
    expect(getExtension("trailingdot.")).toBe("");
    expect(getExtension("nodot")).toBe("");
    expect(validateFile({ name: "trailingdot.", size: 1 }, AUDIO_CONFIG).ok).toBe(
      false,
    );
  });
});
