// Server-side request parsing and validation for the Process_API route.
// Mirrors the client-side constraints but produces specific ProcessErrorCodes.

import {
  AUDIO_CONFIG,
  SLIDES_CONFIG,
  type ProcessErrorCode,
} from "@/lib/types";
import { getExtension } from "@/lib/validation";

export interface ValidatedFiles {
  audio: File;
  slides: File;
}

export interface RequestValidationSuccess {
  ok: true;
  files: ValidatedFiles;
}

export interface RequestValidationFailure {
  ok: false;
  error: string;
  code: ProcessErrorCode;
}

export type RequestValidationResult =
  | RequestValidationSuccess
  | RequestValidationFailure;

function isFile(value: FormDataEntryValue | null): value is File {
  // In the Node/undici runtime, uploaded files are File instances. Guard on the
  // shape rather than instanceof to stay robust across runtimes (a plain string
  // form field has no numeric `size`, so this cleanly rejects non-file fields).
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number"
  );
}

/**
 * Validates that the FormData carries exactly one audio and one slides file,
 * each with an accepted extension and within its size limit. Returns a specific
 * ProcessErrorCode on the first failed constraint. (Requirements 7.1, 7.2, 10.1)
 */
export function validateProcessRequest(
  formData: FormData,
): RequestValidationResult {
  const audioEntry = formData.get("audio");
  const slidesEntry = formData.get("slides");

  if (!isFile(audioEntry)) {
    return {
      ok: false,
      error: "An audio file is required.",
      code: "MISSING_AUDIO",
    };
  }
  if (!isFile(slidesEntry)) {
    return {
      ok: false,
      error: "A slides file is required.",
      code: "MISSING_SLIDES",
    };
  }

  const audio = audioEntry;
  const slides = slidesEntry;

  // Audio format then size.
  const audioExt = getExtension(audio.name);
  if (!AUDIO_CONFIG.acceptedExtensions.includes(audioExt)) {
    return {
      ok: false,
      error: AUDIO_CONFIG.wrongFormatMessage,
      code: "INVALID_AUDIO_FORMAT",
    };
  }
  if (audio.size > AUDIO_CONFIG.maxSizeBytes) {
    return {
      ok: false,
      error: AUDIO_CONFIG.oversizeMessage,
      code: "AUDIO_TOO_LARGE",
    };
  }

  // Slides format then size.
  const slidesExt = getExtension(slides.name);
  if (!SLIDES_CONFIG.acceptedExtensions.includes(slidesExt)) {
    return {
      ok: false,
      error: SLIDES_CONFIG.wrongFormatMessage,
      code: "INVALID_SLIDES_FORMAT",
    };
  }
  if (slides.size > SLIDES_CONFIG.maxSizeBytes) {
    return {
      ok: false,
      error: SLIDES_CONFIG.oversizeMessage,
      code: "SLIDES_TOO_LARGE",
    };
  }

  return { ok: true, files: { audio, slides } };
}

/**
 * Reads and validates the OpenAI credential. Returns null when present and
 * usable, or a failure descriptor when absent/empty/whitespace-only.
 * (Requirements 7.6, 7.7)
 */
export function checkCredential(
  apiKey: string | undefined,
): RequestValidationFailure | null {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      ok: false,
      error: "Service unavailable",
      code: "SERVICE_UNAVAILABLE",
    };
  }
  return null;
}
