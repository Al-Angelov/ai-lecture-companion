// PDF slide extraction (Requirement 8.1). Produces SlideMaterial with a
// guaranteed text channel and a best-effort image channel.
//
// Text extraction uses pdfjs-dist's per-page text content, which runs in
// Node without a native canvas. Image rendering requires a canvas backend that
// is not guaranteed in every deployment target, so images are best-effort and
// capped; text is always the guaranteed input to synthesis.

import type { SlideMaterial } from "@/lib/types";

// Cap the number of rendered page images to bound gpt-4o token/cost and payload.
export const MAX_PAGE_IMAGES = 10;

export interface PdfExtractorDeps {
  // Injectable text extractor so the pipeline is testable without a real PDF.
  extractText?: (data: Uint8Array) => Promise<string[]>;
  // Injectable, best-effort image renderer (data URLs). Absent by default.
  renderImages?: (data: Uint8Array, maxPages: number) => Promise<string[]>;
}

/**
 * Extracts per-page text (always attempted) and best-effort page images.
 * Returns SlideMaterial; callers treat a fully-empty result (no text and no
 * images) as an extraction failure routed through the synthesis-failed path.
 */
export async function extractSlideMaterial(
  pdfBytes: Uint8Array,
  deps: PdfExtractorDeps = {},
): Promise<SlideMaterial> {
  const extractText = deps.extractText ?? defaultExtractText;

  // Text extraction is the guaranteed channel. If the PDF cannot be parsed at
  // all (corrupt, encrypted, wrong bytes), we must NOT silently swallow the
  // error into an empty result — that hides the real cause behind a generic
  // "Synthesis failed". Instead, propagate a descriptive error the route can
  // log and surface to the user.
  let pages: string[];
  try {
    pages = await extractText(pdfBytes);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF text extraction failed: ${detail}`);
  }

  const text = pages
    .map((p, i) => {
      const trimmed = p.trim();
      return trimmed.length > 0 ? `[Slide ${i + 1}]\n${trimmed}` : "";
    })
    .filter((s) => s.length > 0)
    .join("\n\n");

  // Image rendering remains best-effort: a canvas backend may be absent, and
  // that should not fail the whole request when text was extracted.
  let pageImages: string[] = [];
  if (deps.renderImages) {
    try {
      pageImages = await deps.renderImages(pdfBytes, MAX_PAGE_IMAGES);
    } catch {
      pageImages = [];
    }
  }

  return { text, pageImages };
}

/** True when the extraction produced nothing usable at all. */
export function isSlideMaterialEmpty(material: SlideMaterial): boolean {
  return material.text.trim().length === 0 && material.pageImages.length === 0;
}

/**
 * Default text extractor backed by pdfjs-dist. Imported lazily so test
 * environments that inject their own extractor never load the library.
 */
async function defaultExtractText(data: Uint8Array): Promise<string[]> {
  // Use the legacy build which is Node-friendly (no DOM APIs required for text).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data,
    // Disable worker for server-side text extraction.
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter((s) => s.length > 0);
    pages.push(strings.join(" "));
  }
  return pages;
}
