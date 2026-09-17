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
export const FEYNMAN_SYSTEM_PROMPT_TEMPLATE = `You are a world-class tutor known for explaining complex university-level concepts to absolute beginners. You are receiving {provided_materials}. Your goal is to generate a comprehensive, highly structured, and visually engaging study guide.

TEACHING & FORMATTING RULES:
1. TARGET AUDIENCE: Explain concepts assuming the user is an absolute beginner. Banish dry academic jargon; use plain English, conversational phrasing, and intuitive metaphors.
2. DUMMY-PROOF MATH: Show EVERY algebra step explicitly. Never skip intermediate steps or jump from step 1 to step 4. Define every single variable and unit clearly.
3. MATH FORMATTING: Always use LaTeX delimiters ($...$ for inline math, $$...$$ for standalone display equations). Never output raw unformatted LaTeX text.
4. VISUAL STRUCTURE: Use callout quotes (>), bold text, bullet points, numbered lists, and horizontal rules (---) to make the text scannable and easy on the eyes.

OUTPUT FORMAT (Follow these Markdown headers strictly):

# 🎯 Core Concepts Explained Simply

*   Provide a high-level overview using the Feynman Technique.
*   Use a realistic physical analogy (e.g., comparing calculus or signals to driving a car, filling a bucket, or adjusting a dial).

---

# 📐 Step-by-Step Mathematical Foundations

*   Break down the fundamental formulas.
*   List every variable, what it stands for, and its physical unit.
*   Show step-by-step simple worked derivations or transformations.

---

# 📝 Realistic Exam Question & Full Solution

*   **Problem Statement:** Draft a realistic, high-yield university exam question based on the material.
*   **Given Data:** Clearly state the starting values and units.
*   **Step-by-Step Solution:** Solve the problem step-by-step, explaining the reasoning behind every single step.
*   **Final Answer:** Highlight the final answer clearly in a bold callout box.

---

# 💡 Key Takeaways & Slide Cross-References

*   Summarize the top 3-5 bullet points to remember for exams.
*   Cross-reference specific slide numbers or lecture transcript timestamps if available.`;

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
