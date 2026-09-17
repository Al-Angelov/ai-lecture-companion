import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { runProcessPipeline, type PipelineDeps } from "./pipeline";
import { buildSynthesisUserContent, type SynthesisInputs } from "./openai";
import type { OpenAIPipeline } from "./openai";
import {
  FEYNMAN_SYSTEM_PROMPT_TEMPLATE,
  buildFeynmanSystemPrompt,
  type SlideMaterial,
} from "@/lib/types";

const NUM_RUNS = 100;
const VALID_KEY = "sk-test-valid-key";

function makeFile(name: string, size = 100): File {
  const file = new File(["x"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function makeFormData(opts: {
  audio?: File | string | null;
  slides?: File | string | null;
}): FormData {
  const fd = new FormData();
  if (opts.audio instanceof File) fd.append("audio", opts.audio);
  else if (typeof opts.audio === "string") fd.append("audio", opts.audio);
  if (opts.slides instanceof File) fd.append("slides", opts.slides);
  else if (typeof opts.slides === "string") fd.append("slides", opts.slides);
  return fd;
}

// A spyable pipeline whose behavior is configurable per test.
function makeSpyPipeline(overrides: Partial<OpenAIPipeline> = {}) {
  const transcribe = vi.fn(overrides.transcribe ?? (async () => "transcript"));
  const synthesize = vi.fn(
    overrides.synthesize ?? (async () => "# Study Guide"),
  );
  const pipeline: OpenAIPipeline = { transcribe, synthesize };
  return { pipeline, transcribe, synthesize };
}

function depsWith(
  apiKey: string | undefined,
  spy: ReturnType<typeof makeSpyPipeline>,
  extractSlides?: (slides: File) => Promise<SlideMaterial>,
): PipelineDeps {
  return {
    apiKey,
    createPipeline: () => spy.pipeline,
    extractSlides:
      extractSlides ??
      (async () => ({ text: "slide text", pageImages: [] }) as SlideMaterial),
  };
}

// ---------------------------------------------------------------------------
// Property 7
// ---------------------------------------------------------------------------
describe("Process_API request validation", () => {
  // Feature: ai-lecture-companion, Property 7: Missing-file requests are rejected before any upstream call
  // Revised for either/or inputs: a request is rejected only when EVERY provided
  // field is absent or invalid (a single valid file is now sufficient). This
  // property drives all-invalid combinations and asserts a 4xx with no upstream
  // contact.
  it("Property 7: all-absent/all-invalid requests => 4xx and no upstream calls", async () => {
    // A single field is either absent, a non-file string, wrong-extension, or
    // oversize — i.e. never usable.
    const badFieldArb = fc.oneof(
      fc.constant<{ kind: "absent" }>({ kind: "absent" }),
      fc.constant<{ kind: "string" }>({ kind: "string" }),
      fc.constant<{ kind: "wrongExt" }>({ kind: "wrongExt" }),
      fc.constant<{ kind: "oversize" }>({ kind: "oversize" }),
    );

    function build(
      bad: { kind: string },
      field: "audio" | "slides",
    ): File | string | null {
      const validName = field === "audio" ? "f.mp3" : "f.pdf";
      switch (bad.kind) {
        case "absent":
          return null;
        case "string":
          return "not-a-file";
        case "wrongExt":
          return makeFile("f.txt", 10);
        case "oversize":
          return makeFile(validName, 600_000_000);
        default:
          return null;
      }
    }

    await fc.assert(
      fc.asyncProperty(
        badFieldArb,
        badFieldArb,
        async (audioBad, slidesBad) => {
          const spy = makeSpyPipeline();
          const audio = build(audioBad, "audio");
          const slides = build(slidesBad, "slides");

          const fd = makeFormData({ audio, slides });
          const result = await runProcessPipeline(fd, depsWith(VALID_KEY, spy));

          expect(result.status).toBeGreaterThanOrEqual(400);
          expect(result.status).toBeLessThan(500);
          expect(spy.transcribe).not.toHaveBeenCalled();
          expect(spy.synthesize).not.toHaveBeenCalled();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns 400 MISSING_FILES when both files are absent, with no upstream calls", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({});
    const result = await runProcessPipeline(fd, depsWith(VALID_KEY, spy));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "MISSING_FILES" });
    expect(spy.transcribe).not.toHaveBeenCalled();
    expect(spy.synthesize).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Property 8
// ---------------------------------------------------------------------------
describe("Process_API credential guard", () => {
  // Feature: ai-lecture-companion, Property 8: Absent or empty credentials yield service-unavailable without upstream calls
  it("Property 8: absent/empty/whitespace key => 503 and no upstream calls", async () => {
    const keyArb = fc.oneof(
      fc.constant<undefined>(undefined),
      fc.constant(""),
      fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { maxLength: 6 }).map((c) =>
        c.join(""),
      ),
    );

    await fc.assert(
      fc.asyncProperty(keyArb, async (key) => {
        const spy = makeSpyPipeline();
        const fd = makeFormData({
          audio: makeFile("good.mp3", 10),
          slides: makeFile("good.pdf", 10),
        });
        const result = await runProcessPipeline(fd, depsWith(key, spy));

        expect(result.status).toBe(503);
        expect(spy.transcribe).not.toHaveBeenCalled();
        expect(spy.synthesize).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10
// ---------------------------------------------------------------------------
describe("Process_API stage-error mapping", () => {
  // Feature: ai-lecture-companion, Property 10: Stage errors map to the defined error contract and halt the pipeline
  it("Property 10: transcription error => 502 + no synthesis; synthesis error => 502", async () => {
    const errorKindArb = fc.constantFrom("string", "error", "object");

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        errorKindArb,
        async (failTranscription, kind) => {
          const thrown =
            kind === "string"
              ? "upstream boom"
              : kind === "error"
                ? new Error("upstream boom")
                : { status: 500, message: "upstream boom" };

          const spy = makeSpyPipeline({
            transcribe: async () => {
              if (failTranscription) throw thrown;
              return "transcript";
            },
            synthesize: async () => {
              if (!failTranscription) throw thrown;
              return "guide";
            },
          });

          const fd = makeFormData({
            audio: makeFile("good.mp3", 10),
            slides: makeFile("good.pdf", 10),
          });
          const result = await runProcessPipeline(fd, depsWith(VALID_KEY, spy));

          expect(result.status).toBe(502);
          if (failTranscription) {
            expect(result.body).toMatchObject({ code: "TRANSCRIPTION_FAILED" });
            // Synthesis must not run after a transcription failure.
            expect(spy.synthesize).not.toHaveBeenCalled();
          } else {
            expect(result.body).toMatchObject({ code: "SYNTHESIS_FAILED" });
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11
// ---------------------------------------------------------------------------
describe("Synthesis request content", () => {
  // Feature: ai-lecture-companion, Property 11: Synthesis request always contains the verbatim Feynman prompt and the provided inputs
  // Revised for either/or inputs: for whichever combination of files is
  // present, the synthesis request must (a) resolve the dynamic system prompt
  // from the exact template and (b) include exactly the provided inputs in the
  // user content (and omit absent ones).
  it("Property 11: synthesize receives the dynamic prompt and exactly the provided inputs", async () => {
    // At least one of audio/slides must be present.
    const presenceArb = fc
      .record({ hasAudio: fc.boolean(), hasSlides: fc.boolean() })
      .filter((p) => p.hasAudio || p.hasSlides);

    await fc.assert(
      fc.asyncProperty(
        presenceArb,
        fc.string(),
        fc.string(),
        fc.array(fc.constant("data:image/png;base64,AAA"), { maxLength: 3 }),
        async ({ hasAudio, hasSlides }, transcript, slideText, images) => {
          let captured: SynthesisInputs | null = null;

          const spy = makeSpyPipeline({
            transcribe: async () => transcript,
            synthesize: async (inputs) => {
              captured = inputs;
              return "guide";
            },
          });

          const fd = makeFormData({
            audio: hasAudio ? makeFile("good.mp3", 10) : null,
            slides: hasSlides ? makeFile("good.pdf", 10) : null,
          });

          // Force non-empty slide material so a present PDF always reaches
          // synthesis rather than the empty-material error path.
          const deps = depsWith(VALID_KEY, spy, async () => ({
            text: slideText.trim().length > 0 ? slideText : "fallback",
            pageImages: images,
          }));

          const result = await runProcessPipeline(fd, deps);
          expect(result.status).toBe(200);
          expect(captured).not.toBeNull();
          const inputs = captured as unknown as SynthesisInputs;

          // Presence flags reflect the actually-provided files.
          expect(inputs.hasAudio).toBe(hasAudio);
          expect(inputs.hasSlides).toBe(hasSlides);
          // Transcript is the Whisper output when audio present, else empty.
          expect(inputs.transcript).toBe(hasAudio ? transcript : "");

          // System prompt resolves from the exact template for this combo.
          const systemPrompt = buildFeynmanSystemPrompt(hasAudio, hasSlides);
          expect(systemPrompt).toBe(
            FEYNMAN_SYSTEM_PROMPT_TEMPLATE.replace(
              "{provided_materials}",
              hasAudio && hasSlides
                ? "a lecture transcript and the corresponding slide deck"
                : hasAudio
                  ? "a lecture transcript"
                  : "a slide deck",
            ),
          );

          // User content includes provided channels and omits absent ones.
          const content = buildSynthesisUserContent(inputs);
          const textPart = content.find((p) => p.type === "text") as {
            type: "text";
            text: string;
          };
          if (hasAudio) {
            expect(textPart.text).toContain("LECTURE TRANSCRIPT:");
          } else {
            expect(textPart.text).not.toContain("LECTURE TRANSCRIPT:");
          }
          if (hasSlides) {
            expect(textPart.text).toContain("SLIDE DECK MATERIAL");
          } else {
            expect(textPart.text).not.toContain("SLIDE DECK MATERIAL");
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9
// ---------------------------------------------------------------------------
describe("Credential exclusion", () => {
  // Feature: ai-lecture-companion, Property 9: Credentials never appear in any response
  it("Property 9: the API key sentinel never appears in any response body", async () => {
    const SENTINEL = "sk-SENTINEL-SECRET-KEY-1234567890";

    // Each scenario drives a different branch of the pipeline.
    const scenarioArb = fc.constantFrom(
      "validation", // 400
      "transcription", // 502
      "synthesis", // 502
      "success", // 200
    );

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const spy = makeSpyPipeline({
          transcribe: async () => {
            if (scenario === "transcription") throw new Error(SENTINEL);
            return "transcript";
          },
          synthesize: async () => {
            if (scenario === "synthesis") throw new Error(SENTINEL);
            return "# guide";
          },
        });

        const fd =
          scenario === "validation"
            ? makeFormData({}) // both missing => 400 validation branch
            : makeFormData({
                audio: makeFile("good.mp3", 10),
                slides: makeFile("good.pdf", 10),
              });

        const result = await runProcessPipeline(fd, depsWith(SENTINEL, spy));

        const serialized = JSON.stringify(result.body);
        expect(serialized).not.toContain(SENTINEL);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Also cover the 503 branch explicitly with a non-empty sentinel-looking key
  // that is nonetheless whitespace-only in effect. Since 503 only fires for
  // empty/whitespace keys, assert the body is exactly the static contract and
  // contains no key material beyond the fixed message/code.
  it("Property 9 (503 branch): service-unavailable body is the static contract only", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({
      audio: makeFile("good.mp3", 10),
      slides: makeFile("good.pdf", 10),
    });
    const result = await runProcessPipeline(fd, depsWith("   ", spy));
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      error: "Service unavailable",
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

// ---------------------------------------------------------------------------
// Happy path + edge cases
// ---------------------------------------------------------------------------
describe("Process_API pipeline behavior", () => {
  it("returns 200 { studyGuide } on the happy path", async () => {
    const spy = makeSpyPipeline({
      transcribe: async () => "the transcript",
      synthesize: async () => "# The Guide",
    });
    const fd = makeFormData({
      audio: makeFile("lecture.mp3", 10),
      slides: makeFile("deck.pdf", 10),
    });
    const result = await runProcessPipeline(fd, depsWith(VALID_KEY, spy));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ studyGuide: "# The Guide" });
    expect(spy.transcribe).toHaveBeenCalledTimes(1);
    expect(spy.synthesize).toHaveBeenCalledTimes(1);
  });

  it("routes empty slide extraction to a descriptive synthesis-failed error (Requirement 8.5)", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({
      audio: makeFile("lecture.mp3", 10),
      slides: makeFile("deck.pdf", 10),
    });
    const deps = depsWith(VALID_KEY, spy, async () => ({
      text: "",
      pageImages: [],
    }));
    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ code: "SYNTHESIS_FAILED" });
    // The message explains the cause rather than being a bare "Synthesis failed".
    expect(result.body.error).toContain("No text could be extracted");
    // Synthesis is never attempted when material is unusable.
    expect(spy.synthesize).not.toHaveBeenCalled();
  });

  it("surfaces the real cause when PDF extraction throws (Requirement: error surfacing)", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({ slides: makeFile("deck.pdf", 10) });
    const deps = depsWith(VALID_KEY, spy, async () => {
      throw new Error("PDF text extraction failed: Invalid PDF structure");
    });
    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ code: "SYNTHESIS_FAILED" });
    expect(result.body.error).toContain("Invalid PDF structure");
    expect(spy.synthesize).not.toHaveBeenCalled();
  });

  it("surfaces the real cause when transcription throws", async () => {
    const spy = makeSpyPipeline({
      transcribe: async () => {
        throw new Error("Whisper 413: file too large");
      },
    });
    const fd = makeFormData({ audio: makeFile("lecture.mp3", 10) });
    const result = await runProcessPipeline(fd, depsWith(VALID_KEY, spy));
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ code: "TRANSCRIPTION_FAILED" });
    expect(result.body.error).toContain("file too large");
  });

  it("surfaces the real cause when synthesis throws", async () => {
    const spy = makeSpyPipeline({
      transcribe: async () => "t",
      synthesize: async () => {
        throw new Error("gpt-4o 429: rate limited");
      },
    });
    const fd = makeFormData({
      audio: makeFile("lecture.mp3", 10),
      slides: makeFile("deck.pdf", 10),
    });
    const deps = depsWith(VALID_KEY, spy, async () => ({
      text: "slide text",
      pageImages: [],
    }));
    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ code: "SYNTHESIS_FAILED" });
    expect(result.body.error).toContain("rate limited");
  });

  it("proceeds with text-only slide material (image channel absent)", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({
      audio: makeFile("lecture.mp3", 10),
      slides: makeFile("deck.pdf", 10),
    });
    const deps = depsWith(VALID_KEY, spy, async () => ({
      text: "text only slides",
      pageImages: [],
    }));
    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(200);
  });

  it("proceeds with image-only slide material (no text)", async () => {
    const spy = makeSpyPipeline();
    const fd = makeFormData({
      audio: makeFile("lecture.mp3", 10),
      slides: makeFile("deck.pdf", 10),
    });
    const deps = depsWith(VALID_KEY, spy, async () => ({
      text: "",
      pageImages: ["data:image/png;base64,AAA"],
    }));
    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(200);
  });

  it("audio-only: transcribes, skips PDF extraction, and synthesizes", async () => {
    let extractCalled = false;
    const spy = makeSpyPipeline({
      transcribe: async () => "the transcript",
      synthesize: async () => "# Guide",
    });
    const deps = depsWith(VALID_KEY, spy, async () => {
      extractCalled = true;
      return { text: "should not be used", pageImages: [] };
    });
    const fd = makeFormData({ audio: makeFile("lecture.mp3", 10) });

    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ studyGuide: "# Guide" });
    expect(spy.transcribe).toHaveBeenCalledTimes(1);
    expect(spy.synthesize).toHaveBeenCalledTimes(1);
    // PDF extraction is skipped entirely when no slides file is present.
    expect(extractCalled).toBe(false);
    // Synthesis is told there is no slides channel and an empty slide material.
    const inputs = spy.synthesize.mock.calls[0][0] as SynthesisInputs;
    expect(inputs.hasAudio).toBe(true);
    expect(inputs.hasSlides).toBe(false);
    expect(inputs.slides).toEqual({ text: "", pageImages: [] });
  });

  it("pdf-only: skips Whisper (empty transcript), extracts, and synthesizes", async () => {
    const spy = makeSpyPipeline({
      synthesize: async () => "# Guide",
    });
    const deps = depsWith(VALID_KEY, spy, async () => ({
      text: "slide text",
      pageImages: [],
    }));
    const fd = makeFormData({ slides: makeFile("deck.pdf", 10) });

    const result = await runProcessPipeline(fd, deps);
    expect(result.status).toBe(200);
    // Whisper is never called when no audio file is present.
    expect(spy.transcribe).not.toHaveBeenCalled();
    expect(spy.synthesize).toHaveBeenCalledTimes(1);
    const inputs = spy.synthesize.mock.calls[0][0] as SynthesisInputs;
    expect(inputs.hasAudio).toBe(false);
    expect(inputs.hasSlides).toBe(true);
    expect(inputs.transcript).toBe("");
  });
});
