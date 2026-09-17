import { describe, it, expect } from "vitest";
import { extractSlideMaterial, isSlideMaterialEmpty } from "./pdf";

const EMPTY_BYTES = new Uint8Array([1, 2, 3]);

describe("extractSlideMaterial", () => {
  it("empty PDF (no text, no images) yields empty material", async () => {
    const material = await extractSlideMaterial(EMPTY_BYTES, {
      extractText: async () => [],
    });
    expect(material.text).toBe("");
    expect(material.pageImages).toEqual([]);
    expect(isSlideMaterialEmpty(material)).toBe(true);
  });

  it("text-only PDF produces per-slide labelled text and no images", async () => {
    const material = await extractSlideMaterial(EMPTY_BYTES, {
      extractText: async () => ["Intro to Physics", "Newton's Laws"],
    });
    expect(material.text).toContain("[Slide 1]");
    expect(material.text).toContain("Intro to Physics");
    expect(material.text).toContain("[Slide 2]");
    expect(material.pageImages).toEqual([]);
    expect(isSlideMaterialEmpty(material)).toBe(false);
  });

  it("image-only PDF (no extractable text) still yields usable material via images", async () => {
    const material = await extractSlideMaterial(EMPTY_BYTES, {
      extractText: async () => ["", "   "],
      renderImages: async () => ["data:image/png;base64,AAA"],
    });
    expect(material.text).toBe("");
    expect(material.pageImages.length).toBe(1);
    expect(isSlideMaterialEmpty(material)).toBe(false);
  });

  it("propagates a text-extraction failure with a descriptive message (no swallowing)", async () => {
    await expect(
      extractSlideMaterial(EMPTY_BYTES, {
        extractText: async () => {
          throw new Error("Invalid PDF structure");
        },
      }),
    ).rejects.toThrow(/PDF text extraction failed: Invalid PDF structure/);
  });

  it("tolerates an image-rendering failure without losing text", async () => {
    const material = await extractSlideMaterial(EMPTY_BYTES, {
      extractText: async () => ["Slide content"],
      renderImages: async () => {
        throw new Error("no canvas backend");
      },
    });
    expect(material.text).toContain("Slide content");
    expect(material.pageImages).toEqual([]);
  });
});

// A minimal, valid single-page PDF that shows the text "Hello". Built inline so
// the real pdfjs-dist code path (the default extractor) can be exercised end to
// end without a fixture file. Byte offsets in the xref are approximate; pdfjs is
// tolerant and recovers via its cross-reference rebuild, which is exactly the
// Node/serverless path we need to verify runs workerless.
const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 20 100 Td (Hello PDF) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

describe("extractSlideMaterial with the real (workerless) pdfjs extractor", () => {
  it("extracts text from a real PDF without a fake-worker / missing-module error", async () => {
    const bytes = new Uint8Array(Buffer.from(MINIMAL_PDF, "latin1"));

    // No injected extractText => exercises defaultExtractText (pdfjs-dist).
    // The key assertion is that this resolves at all: prior to the workerless
    // fix this rejected with 'Setting up fake worker failed: Cannot find
    // module .../pdf.worker.mjs'.
    const material = await extractSlideMaterial(bytes);

    expect(typeof material.text).toBe("string");
    expect(material.text).toContain("Hello PDF");
  });

  it("does not throw a worker-related error for a real PDF", async () => {
    const bytes = new Uint8Array(Buffer.from(MINIMAL_PDF, "latin1"));
    let thrown: unknown = null;
    try {
      await extractSlideMaterial(bytes);
    } catch (e) {
      thrown = e;
    }
    if (thrown) {
      // If anything did throw, it must not be the fake-worker failure.
      expect(String((thrown as Error).message)).not.toMatch(/fake worker/i);
      expect(String((thrown as Error).message)).not.toMatch(/pdf\.worker/i);
    }
  });
});
