// Server-side request parsing and validation for the Process_API route.
// Mirrors the client-side constraints but produces specific ProcessErrorCodes.

import {
  AUDIO_CONFIG,
  SLIDES_CONFIG,
  type ProcessErrorCode,
} from "@/lib/types";
import { getExtension } from "@/lib/validation";

export interface ValidatedFiles {
  // Either channel may be absent; a valid request has at least one present.
  audio: File | null;
  slides: File | null;
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
 * Validates that the FormData carries at least one of `audio`/`slides`, and
 * that whichever file(s) are present have an accepted extension and are within
 * their size limit. Returns a specific ProcessErrorCode on the first failed
 * constraint, or MISSING_FILES (400) when both files are absent.
 * (Requirements 7.1, 7.2, 10.1; revised for either/or inputs.)
 */
export function validateProcessRequest(
  formData: FormData,
): RequestValidationResult {
  const audioEntry = formData.get("audio");
  const slidesEntry = formData.get("slides");

  const audio = isFile(audioEntry) ? audioEntry : null;
  const slides = isFile(slidesEntry) ? slidesEntry : null;

  // Failsafe: at least one file must be provided.
  if (!audio && !slides) {
    return {
      ok: false,
      error: "Provide at least one file: a lecture audio file or a slides PDF.",
      code: "MISSING_FILES",
    };
  }

  // Validate the audio channel only when present.
  if (audio) {
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
  }

  // Validate the slides channel only when present.
  if (slides) {
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
