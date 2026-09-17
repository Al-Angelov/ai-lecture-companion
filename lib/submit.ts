// Client submission flow (Requirement 5.4, 5.5, 10.4-10.6). Extracted from the
// Dashboard component so the network/dispatch logic is unit-testable.

import type { ProcessingAction } from "./reducer";

export const NETWORK_ERROR_MESSAGE = "The request could not be completed.";
export const GENERIC_ERROR_MESSAGE = "Processing failed. Please try again.";

export interface SubmitDeps {
  // Either file may be null; a submission is valid when at least one is present.
  audioFile: File | null;
  slidesFile: File | null;
  dispatch: (action: ProcessingAction) => void;
  // Injectable for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
}

/**
 * Submits the provided file(s) to /api/process as multipart form data and
 * drives the reducer through the forward-only stages.
 *
 * Stages are skipped dynamically: the "Transcribing Audio..." stage is only
 * entered when an audio file is present, and "Synthesizing Slides..." only when
 * a PDF is present. The terminal COMPLETE transition can advance from whichever
 * active stage the flow lands on (see the reducer).
 */
export async function submitLecture({
  audioFile,
  slidesFile,
  dispatch,
  fetchImpl,
}: SubmitDeps): Promise<void> {
  const doFetch = fetchImpl ?? fetch;

  const formData = new FormData();
  if (audioFile) formData.append("audio", audioFile);
  if (slidesFile) formData.append("slides", slidesFile);

  // Uploading (Requirement 6.2).
  dispatch({ type: "START_UPLOAD" });
  // Optimistic staged display updates, skipping stages with no work to do
  // (Requirements 6.3, 6.4).
  if (audioFile) dispatch({ type: "ADVANCE_TRANSCRIBING" });
  if (slidesFile) dispatch({ type: "ADVANCE_SYNTHESIZING" });

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

  // Non-OK response: surface the actual server error. Read `{ error }` from the
  // response JSON; if the body is not JSON or has no error, fall back to a
  // message that still includes the HTTP status so the failure is never silent.
  let message = `${GENERIC_ERROR_MESSAGE} (HTTP ${response.status})`;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error && data.error.trim().length > 0) {
      message = data.error;
    }
  } catch {
    // Non-JSON body (e.g. an HTML error page): keep the status-based message.
  }
  dispatch({ type: "ERROR", message });
}
