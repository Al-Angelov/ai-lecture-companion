// Client submission flow (Requirement 5.4, 5.5, 10.4-10.6). Extracted from the
// Dashboard component so the network/dispatch logic is unit-testable.

import type { ProcessingAction } from "./reducer";

export const NETWORK_ERROR_MESSAGE = "The request could not be completed.";
export const GENERIC_ERROR_MESSAGE = "Processing failed. Please try again.";

export interface SubmitDeps {
  audioFile: File;
  slidesFile: File;
  dispatch: (action: ProcessingAction) => void;
  // Injectable for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
}

/**
 * Submits the two files to /api/process as multipart form data and drives the
 * reducer through the forward-only stages.
 *
 * Because the reducer only allows single-step advancement (COMPLETE is valid
 * only from SynthesizingSlides), we optimistically walk Uploading ->
 * TranscribingAudio -> SynthesizingSlides before applying the terminal
 * response.
 */
export async function submitLecture({
  audioFile,
  slidesFile,
  dispatch,
  fetchImpl,
}: SubmitDeps): Promise<void> {
  const doFetch = fetchImpl ?? fetch;

  const formData = new FormData();
  formData.append("audio", audioFile);
  formData.append("slides", slidesFile);

  // Uploading (Requirement 6.2).
  dispatch({ type: "START_UPLOAD" });
  // Optimistic staged display updates (Requirements 6.3, 6.4).
  dispatch({ type: "ADVANCE_TRANSCRIBING" });
  dispatch({ type: "ADVANCE_SYNTHESIZING" });

  let response: Response;
  try {
    response = await doFetch("/api/process", {
      method: "POST",
      body: formData,
    });
  } catch {
    // Network failure (Requirement 10.6).
    dispatch({ type: "ERROR", message: NETWORK_ERROR_MESSAGE });
    return;
  }

  if (response.ok) {
    let studyGuide = "";
    try {
      const data = (await response.json()) as { studyGuide?: string };
      studyGuide = data.studyGuide ?? "";
    } catch {
      studyGuide = "";
    }
    dispatch({ type: "COMPLETE", studyGuide });
    return;
  }

  // Non-OK response: read the error message if present (Requirements 5.5, 10.4).
  let message = GENERIC_ERROR_MESSAGE;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error && data.error.trim().length > 0) {
      message = data.error;
    }
  } catch {
    // keep generic message
  }
  dispatch({ type: "ERROR", message });
}
