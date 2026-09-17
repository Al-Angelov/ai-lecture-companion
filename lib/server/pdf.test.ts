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
