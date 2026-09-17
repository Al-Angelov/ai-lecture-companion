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

  // 3. Transcription (Property 10: error -> 502, no synthesis).
  let transcript: string;
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

  // 4. Extract slide material.
  const extractSlides = deps.extractSlides ?? defaultExtractSlides;
  let material: SlideMaterial;
  try {
    material = await extractSlides(slides);
  } catch {
    // Extraction failure routes through the synthesis-failed contract.
    return {
      status: 502,
      body: { error: "Synthesis failed", code: "SYNTHESIS_FAILED" },
    };
  }

  // Unusable slide material (no text and no images) -> synthesis-failed path.
  if (isSlideMaterialEmpty(material)) {
    return {
      status: 502,
      body: { error: "Synthesis failed", code: "SYNTHESIS_FAILED" },
    };
  }

  // 5. Synthesis (Property 10: error -> 502).
  let studyGuide: string;
  try {
    studyGuide = await pipeline.synthesize(transcript, material);
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
