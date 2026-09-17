import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the OpenAI pipeline factory so no real network calls occur. The mock is
// configurable per test via the module-level `mockPipeline` object.
const transcribeMock = vi.fn();
const synthesizeMock = vi.fn();

vi.mock("@/lib/server/openai", () => ({
  createOpenAIPipeline: () => ({
    transcribe: transcribeMock,
    synthesize: synthesizeMock,
  }),
}));

// Mock PDF extraction so a fake .pdf byte blob yields usable slide material
// without invoking pdfjs-dist.
vi.mock("@/lib/server/pdf", () => ({
  extractSlideMaterial: vi.fn(async () => ({
    text: "slide text",
    pageImages: [],
  })),
  isSlideMaterialEmpty: (m: { text: string; pageImages: string[] }) =>
    m.text.trim().length === 0 && m.pageImages.length === 0,
}));

import { POST } from "./route";

function makeFile(name: string, size = 100): File {
  const file = new File(["x"], name);
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new ArrayBuffer(size),
  });
  return file;
}

function makeRequest(fields: {
  audio?: File | string;
  slides?: File | string;
}): Request {
  const fd = new FormData();
  if (fields.audio !== undefined) fd.append("audio", fields.audio as never);
  if (fields.slides !== undefined) fd.append("slides", fields.slides as never);
  // jsdom does not reliably round-trip multipart bodies through
  // Request.formData(), so provide a request-like object whose formData()
  // resolves to our FormData directly. The route only calls request.formData().
  return {
    formData: async () => fd,
  } as unknown as Request;
}

const ORIGINAL_ENV = process.env.OPENAI_API_KEY;

beforeEach(() => {
  transcribeMock.mockReset();
  synthesizeMock.mockReset();
  process.env.OPENAI_API_KEY = "sk-integration-test-key";
});

afterEach(() => {
  process.env.OPENAI_API_KEY = ORIGINAL_ENV;
});

describe("POST /api/process integration (mocked upstream)", () => {
  it("full happy path returns 200 { studyGuide } (Requirements 7.3, 7.4, 8.2, 8.4)", async () => {
    transcribeMock.mockResolvedValue("the transcript");
    synthesizeMock.mockResolvedValue("# Study Guide\n\nContent");

    const res = await POST(
      makeRequest({
        audio: makeFile("lecture.mp3"),
        slides: makeFile("deck.pdf"),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ studyGuide: "# Study Guide\n\nContent" });
    expect(transcribeMock).toHaveBeenCalledTimes(1);
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    // Synthesis received the transcript.
    expect(synthesizeMock.mock.calls[0][0]).toBe("the transcript");
  });

  it("transcription failure returns 502 TRANSCRIPTION_FAILED and stops the pipeline (Requirement 7.5)", async () => {
    transcribeMock.mockRejectedValue(new Error("whisper down"));

    const res = await POST(
      makeRequest({
        audio: makeFile("lecture.mp3"),
        slides: makeFile("deck.pdf"),
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ code: "TRANSCRIPTION_FAILED" });
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("synthesis failure returns 502 SYNTHESIS_FAILED (Requirement 8.5)", async () => {
    transcribeMock.mockResolvedValue("the transcript");
    synthesizeMock.mockRejectedValue(new Error("gpt-4o down"));

    const res = await POST(
      makeRequest({
        audio: makeFile("lecture.mp3"),
        slides: makeFile("deck.pdf"),
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({ code: "SYNTHESIS_FAILED" });
  });

  it("missing audio returns 400 without any upstream call (Requirement 7.2)", async () => {
    const res = await POST(makeRequest({ slides: makeFile("deck.pdf") }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ code: "MISSING_AUDIO" });
    expect(transcribeMock).not.toHaveBeenCalled();
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("missing credential returns 503 without any upstream call (Requirement 7.7)", async () => {
    process.env.OPENAI_API_KEY = "   ";
    const res = await POST(
      makeRequest({
        audio: makeFile("lecture.mp3"),
        slides: makeFile("deck.pdf"),
      }),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(transcribeMock).not.toHaveBeenCalled();
  });
});
