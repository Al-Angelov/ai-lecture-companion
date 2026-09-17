// Process_API pipeline orchestrator (Requirements 7, 8, 10). Kept independent
// of the Next.js Request/Response objects so it is unit- and property-testable.
// The route adapter wraps this and serializes the outcome.

import type { ProcessErrorCode, SlideMaterial } from "@/lib/types";
import {
  validateProcessRequest,
  checkCredential,
} from "./request-validation";
import type { OpenAIPipeline } from "./openai";
import { extractSlideMaterial, isSlideMaterialEmpty } from "./pdf";

export interface PipelineSuccess {
  status: 200;
  body: { studyGuide: string };
}

export interface PipelineError {
  status: 400 | 502 | 503;
  body: { error: string; code: ProcessErrorCode };
}

export type PipelineResult = PipelineSuccess | PipelineError;

export interface PipelineDeps {
  apiKey: string | undefined;
  // Factory so we only construct the client after the credential guard passes.
  createPipeline: (apiKey: string) => OpenAIPipeline;
  // Extracts slide material from the uploaded PDF File. Injectable for tests.
  extractSlides?: (slides: File) => Promise<SlideMaterial>;
}

/**
 * Runs the full pipeline against parsed FormData:
 * 1. Validate request (400 on failure, no upstream contact).
 * 2. Credential guard (503 on missing/empty, no upstream contact).
 * 3. Transcribe (502 TRANSCRIPTION_FAILED on error; synthesis not attempted).
 * 4. Extract slide material.
 * 5. Synthesize (502 SYNTHESIS_FAILED on error or unusable slides).
 * 6. 200 { studyGuide } on success.
 */
export async function runProcessPipeline(
  formData: FormData,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  // 1. Request validation (Property 7).
  const validation = validateProcessRequest(formData);
  if (!validation.ok) {
    return {
      status: 400,
      body: { error: validation.error, code: validation.code },
    };
  }

  // 2. Credential guard (Property 8).
  const credentialFailure = checkCredential(deps.apiKey);
  if (credentialFailure) {
    return {
      status: 503,
      body: { error: credentialFailure.error, code: credentialFailure.code },
    };
  }

  // apiKey is guaranteed non-empty here.
  const pipeline = deps.createPipeline(deps.apiKey as string);
  const { audio, slides } = validation.files;
  const hasAudio = audio !== null;
  const hasSlides = slides !== null;

  // 3. Transcription — only when audio is present. If audio is missing, the
  // transcript is an empty string and the Whisper call is skipped entirely.
  let transcript = "";
  if (hasAudio) {
    try {
      transcript = await pipeline.transcribe(audio);
    } catch {
      return {
        status: 502,
        body: {
          error: "Transcription failed",
          code: "TRANSCRIPTION_FAILED",
        },
      };
    }
  }

  // 4. Extract slide material — only when a PDF is present. If it is missing,
  // the slide content is empty and PDF extraction is skipped entirely.
  let material: SlideMaterial = { text: "", pageImages: [] };
  if (hasSlides) {
    const extractSlides = deps.extractSlides ?? defaultExtractSlides;
    try {
      material = await extractSlides(slides);
    } catch {
      // Extraction failure routes through the synthesis-failed contract.
      return {
        status: 502,
        body: { error: "Synthesis failed", code: "SYNTHESIS_FAILED" },
      };
    }

    // A PDF was provided but produced nothing usable (no text and no images).
    // Route through the synthesis-failed path so the client gets the defined
    // error contract rather than an empty synthesis.
    if (isSlideMaterialEmpty(material)) {
      return {
        status: 502,
        body: { error: "Synthesis failed", code: "SYNTHESIS_FAILED" },
      };
    }
  }

  // 5. Synthesis (Property 10: error -> 502). The system prompt and user
  // content are built dynamically from whichever inputs were provided.
  let studyGuide: string;
  try {
    studyGuide = await pipeline.synthesize({
      transcript,
      slides: material,
      hasAudio,
      hasSlides,
    });
  } catch {
    return {
      status: 502,
      body: { error: "Synthesis failed", code: "SYNTHESIS_FAILED" },
    };
  }

  // 6. Success.
  return { status: 200, body: { studyGuide } };
}

async function defaultExtractSlides(slides: File): Promise<SlideMaterial> {
  const bytes = new Uint8Array(await slides.arrayBuffer());
  return extractSlideMaterial(bytes);
}
