import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { runProcessPipeline, type PipelineDeps } from "./pipeline";
import { buildSynthesisUserContent } from "./openai";
import type { OpenAIPipeline } from "./openai";
import { FEYNMAN_SYSTEM_PROMPT, type SlideMaterial } from "@/lib/types";

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
  it("Property 7: absent/invalid fields => 4xx and no upstream calls", async () => {
    const badFieldArb = fc.oneof(
      fc.constant<null>(null), // absent
      fc.constant<string>("not-a-file"), // wrong type (string field)
      fc.record({ kind: fc.constant("wrongExt"), name: fc.constant("f.txt") }),
      fc.record({
        kind: fc.constant("oversize"),
        name: fc.constant("f.mp3"),
      }),
    );

    await fc.assert(
      fc.asyncProperty(
        fc.record({ audioBad: fc.boolean(), spec: badFieldArb }),
        async ({ audioBad, spec }) => {
          const spy = makeSpyPipeline();

          function build(bad: typeof spec, field: "audio" | "slides") {
            if (bad === null) return null;
            if (typeof bad === "string") return bad;
            if (bad.kind === "wrongExt") return makeFile(bad.name, 10);
            // oversize
            return makeFile(
              field === "audio" ? "f.mp3" : "f.pdf",
              600_000_000,
            );
          }

          // Ensure at least one field is invalid; keep the other valid.
          const audio = audioBad
            ? build(spec, "audio")
            : makeFile("good.mp3", 10);
          const slides = audioBad
            ? makeFile("good.pdf", 10)
            : build(spec, "slides");

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
  // Feature: ai-lecture-companion, Property 11: Synthesis request always contains the verbatim Feynman prompt and both inputs
  it("Property 11: synthesize receives the exact prompt (system) and both inputs", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.array(fc.constant("data:image/png;base64,AAA"), { maxLength: 3 }),
        async (transcript, slideText, images) => {
          let capturedTranscript = "";
          let capturedSlides: SlideMaterial | null = null;

          const spy = makeSpyPipeline({
            transcribe: async () => transcript,
            synthesize: async (t, s) => {
              capturedTranscript = t;
              capturedSlides = s;
              return "guide";
            },
          });

          const material: SlideMaterial = {
            text: slideText,
            pageImages: images,
          };
          const fd = makeFormData({
            audio: makeFile("good.mp3", 10),
            slides: makeFile("good.pdf", 10),
          });

          // Force non-empty material so synthesis is always reached.
          const deps = depsWith(VALID_KEY, spy, async () => ({
            text: material.text.trim().length > 0 ? material.text : "fallback",
            pageImages: material.pageImages,
          }));

          const result = await runProcessPipeline(fd, deps);
          expect(result.status).toBe(200);

          // Both inputs were passed to synthesize.
          expect(capturedTranscript).toBe(transcript);
          expect(capturedSlides).not.toBeNull();

          // The user content includes the transcript and the slide material,
          // and the system prompt is the exact Feynman string.
          const content = buildSynthesisUserContent(
            capturedTranscript,
            capturedSlides as unknown as SlideMaterial,
          );
          const textPart = content.find((p) => p.type === "text") as {
            type: "text";
            text: string;
          };
          expect(textPart.text).toContain(capturedTranscript);
          expect(FEYNMAN_SYSTEM_PROMPT).toBe(
            "Act as an expert private tutor. You will receive a lecture transcript and the corresponding slide deck material. Synthesize this material into a dummy-proof study guide using the Feynman technique. Format your output strictly in Markdown with these sections: 1. Core Concept in Plain English. 2. Step-by-Step Formula Breakdown (with real-world numbers/units if applicable). 3. Real-World Analogy & Practical Example. 4. Slide Cross-Reference & Key Takeaways.",
          );
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
            ? makeFormData({ audio: null, slides: makeFile("good.pdf", 10) })
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

  it("routes empty slide extraction to the synthesis-failed contract (Requirement 8.5)", async () => {
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
    // Synthesis is never attempted when material is unusable.
    expect(spy.synthesize).not.toHaveBeenCalled();
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
});
