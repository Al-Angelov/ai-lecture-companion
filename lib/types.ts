// Shared types and configuration for the AI Lecture Companion.
// These definitions match the design document exactly.

// ---------------------------------------------------------------------------
// Processing state
// ---------------------------------------------------------------------------

// Processing state — forward-only ordering is enforced by transition logic
// (Requirement 6.6).
export enum ProcessingState {
  Idle = "Idle",
  Uploading = "Uploading",
  TranscribingAudio = "TranscribingAudio",
  SynthesizingSlides = "SynthesizingSlides",
  Complete = "Complete",
  Error = "Error",
}

// Ordinal ordering used to enforce forward-only progression on the client.
// Error is terminal and reachable from any active stage; it is not part of the
// linear order.
export const STATE_ORDER: ProcessingState[] = [
  ProcessingState.Idle,
  ProcessingState.Uploading,
  ProcessingState.TranscribingAudio,
  ProcessingState.SynthesizingSlides,
  ProcessingState.Complete,
];

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export type Theme = "light" | "dark";

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

// Multi-file drop differs per zone (Requirements 3.6 vs 4.6).
export type MultiDropPolicy = "reject" | "firstOnly";

export interface FileValidationConfig {
  field: "audio" | "slides";
  acceptedExtensions: string[]; // e.g. [".mp3", ".wav", ".m4a"] or [".pdf"]
  maxSizeBytes: number; // Max_Audio_Size or Max_Slides_Size
  multiDropPolicy: MultiDropPolicy;
  oversizeMessage: string;
  wrongFormatMessage: string;
  multiDropMessage?: string; // used only when policy === "reject"
}

export const AUDIO_CONFIG: FileValidationConfig = {
  field: "audio",
  acceptedExtensions: [".mp3", ".wav", ".m4a"],
  maxSizeBytes: 524_288_000, // 500 MB
  multiDropPolicy: "reject",
  oversizeMessage: "The audio file exceeds the maximum allowed size.",
  wrongFormatMessage: "Only .mp3, .wav, and .m4a files are accepted.",
  multiDropMessage: "Only one audio file may be selected.",
};

export const SLIDES_CONFIG: FileValidationConfig = {
  field: "slides",
  acceptedExtensions: [".pdf"],
  maxSizeBytes: 104_857_600, // 100 MB
  multiDropPolicy: "firstOnly",
  oversizeMessage: "The slides file exceeds the maximum allowed size.",
  wrongFormatMessage: "Only .pdf files are accepted.",
};

// Result of a validation attempt.
export interface ValidationResult {
  ok: boolean;
  message?: string; // present when ok === false
}

// ---------------------------------------------------------------------------
// Client state
// ---------------------------------------------------------------------------

export interface DashboardState {
  audioFile: File | null;
  slidesFile: File | null;
  processingState: ProcessingState;
  studyGuide: string | null; // null = none received yet
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// API request / response
// ---------------------------------------------------------------------------

// Request: multipart/form-data
//   audio:  File (one of .mp3/.wav/.m4a, <= 500 MB)
//   slides: File (.pdf, <= 100 MB)

// Success response (200)
export interface ProcessSuccessResponse {
  studyGuide: string; // Markdown
}

// Error response (400 | 502 | 503)
export interface ProcessErrorResponse {
  error: string; // human-readable, safe to display (never contains the API key)
  code: ProcessErrorCode;
}

export type ProcessErrorCode =
  | "MISSING_AUDIO"
  | "MISSING_SLIDES"
  | "MISSING_FILES" // neither audio nor slides provided
  | "INVALID_AUDIO_FORMAT"
  | "INVALID_SLIDES_FORMAT"
  | "AUDIO_TOO_LARGE"
  | "SLIDES_TOO_LARGE"
  | "SERVICE_UNAVAILABLE" // missing/empty API key
  | "TRANSCRIPTION_FAILED"
  | "SYNTHESIS_FAILED";

// ---------------------------------------------------------------------------
// Server-internal types
// ---------------------------------------------------------------------------

export interface SlideMaterial {
  text: string; // concatenated per-page text ("" if none extracted)
  pageImages: string[]; // base64/data-URL page renders (empty if none)
}

// Dynamic Feynman system prompt template. `{provided_materials}` is swapped at
// request time for a phrase describing the file(s) actually uploaded.
export const FEYNMAN_SYSTEM_PROMPT_TEMPLATE =
  "Act as an expert private tutor. You are receiving {provided_materials}. Synthesize this material into a dummy-proof study guide using the Feynman technique. Format your output strictly in Markdown with these sections: 1. Core Concept in Plain English. 2. Step-by-Step Breakdown (with real-world numbers/units if applicable). 3. Real-World Analogy & Practical Example. 4. Source Cross-Reference & Key Takeaways.";

// Phrases substituted for {provided_materials} based on which inputs are present.
export const PROVIDED_MATERIALS = {
  audioOnly: "a lecture transcript",
  slidesOnly: "a slide deck",
  both: "a lecture transcript and the corresponding slide deck",
} as const;

/**
 * Resolves the phrase describing the provided materials, then substitutes it
 * into the template to produce the final system prompt. Requires at least one
 * input to be present (guaranteed by request validation).
 */
export function buildFeynmanSystemPrompt(
  hasAudio: boolean,
  hasSlides: boolean,
): string {
  const materials =
    hasAudio && hasSlides
      ? PROVIDED_MATERIALS.both
      : hasAudio
        ? PROVIDED_MATERIALS.audioOnly
        : PROVIDED_MATERIALS.slidesOnly;
  return FEYNMAN_SYSTEM_PROMPT_TEMPLATE.replace(
    "{provided_materials}",
    materials,
  );
}
