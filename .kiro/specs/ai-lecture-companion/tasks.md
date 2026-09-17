# Implementation Plan: AI Lecture Companion

## Overview

This plan builds the AI Lecture Companion as a Next.js (App Router) + TypeScript full-stack MVP. It proceeds bottom-up: project scaffolding and shared types first, then pure logic (validation, reducer) with their property tests, then presentational components, then the client dashboard wiring, and finally the `Process_API` route and its pipeline. Each step builds on the previous ones and ends by wiring pieces together so no code is left orphaned.

Testing is embedded as sub-tasks next to the code it validates. Every one of the 13 correctness properties from the design maps to a single `fast-check` property test (minimum 100 iterations) tagged with `// Feature: ai-lecture-companion, Property N: ...`. Sub-tasks marked with `*` are optional (tests) and can be skipped for a faster MVP.

## Tasks

- [~] 1. Scaffold the Next.js project and tooling
  - Initialize a Next.js App Router project with TypeScript (`app/` directory, `tsconfig.json`, `next.config`).
  - Configure Tailwind CSS with `darkMode: "class"` and global styles; add a base layout (`app/layout.tsx`) and a color-transition class (≤ 500 ms) for theme switching.
  - Add runtime deps: `lucide-react`, `react-markdown`.
  - Add dev/test deps and config: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, and a jsdom test environment; add a test script using `vitest --run`.
  - Verify the project builds and an empty test suite runs.
  - _Requirements: 1.1, 1.4, 2.3_

- [ ] 2. Define shared types and configuration module
  - [~] 2.1 Create the shared types/config module (e.g., `lib/types.ts`)
    - Define `ProcessingState` enum and `STATE_ORDER` array exactly as in the design (Error excluded from linear order).
    - Define `Theme`, `MultiDropPolicy`, `FileValidationConfig`, `ValidationResult`, and the `AUDIO_CONFIG`/`SLIDES_CONFIG` constants with the specified sizes (500 MB / 100 MB), extensions, drop policies, and messages.
    - Define `DashboardState`, `ProcessSuccessResponse`, `ProcessErrorResponse`, and the `ProcessErrorCode` union.
    - Define server-internal `SlideMaterial` and the `FEYNMAN_SYSTEM_PROMPT` constant verbatim (character-for-character matching Requirement 8.3).
    - _Requirements: 2.1, 3.6, 3.7, 4.6, 4.7, 6.6, 8.3_

  - [~] 2.2 Write a guard test for the verbatim Feynman prompt
    - Assert `FEYNMAN_SYSTEM_PROMPT` equals the exact string from Requirement 8.3 (protects Property 11's premise).
    - _Requirements: 8.3_

- [ ] 3. Implement file validation logic
  - [~] 3.1 Implement the pure file validator (e.g., `lib/validation.ts`)
    - Export a pure function `validateFile(file, config): ValidationResult` that accepts iff extension ∈ `config.acceptedExtensions` (case-insensitive) AND size ≤ `config.maxSizeBytes`; otherwise returns `ok: false` with the config's wrong-format or oversize message.
    - Export a `applySelection(current, offered, config)` helper that returns the offered file when valid, else keeps `current`.
    - Export a multi-drop resolver honoring `multiDropPolicy` (`reject` vs `firstOnly`).
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 4.4, 4.5, 4.6, 4.7_

  - [~] 3.2 Write property test for file validation
    - **Property 1: File validation is exactly extension-and-size**
    - Tag: `// Feature: ai-lecture-companion, Property 1: File validation is exactly extension-and-size`
    - Generators for arbitrary names/extensions/sizes; `fc.assert(..., { numRuns: 100 })`.
    - **Validates: Requirements 3.4, 3.7, 4.4, 4.7**

  - [~] 3.3 Write property test for selection preservation/replacement
    - **Property 2: Rejecting an invalid file preserves the current valid selection**
    - Tag: `// Feature: ai-lecture-companion, Property 2: Rejecting an invalid file preserves the current valid selection`
    - **Validates: Requirements 3.4, 3.5, 3.7, 4.4, 4.5, 4.7**

  - [~] 3.4 Write property test for multi-file drop policy
    - **Property 3: Multi-file drop policy per zone**
    - Tag: `// Feature: ai-lecture-companion, Property 3: Multi-file drop policy per zone`
    - Generators over file-count arrays for `reject` (audio) vs `firstOnly` (slides).
    - **Validates: Requirements 3.6, 4.6**

  - [~] 3.5 Write edge-case tests for validation boundaries
    - Exactly-max size (accepted), one byte over (rejected), case-insensitive extension (`.MP3`), empty/no extension.
    - _Requirements: 3.7, 4.7_

- [ ] 4. Implement the client state reducer
  - [~] 4.1 Implement the forward-only processing reducer (e.g., `lib/reducer.ts`)
    - Implement a reducer over `{ processingState, studyGuide, errorMessage }` whose transitions never decrease the `STATE_ORDER` index and never skip a stage, except a failure event may move to terminal `Error` from any active stage.
    - Handle events: start upload, advance to transcribing, advance to synthesizing, complete (sets `studyGuide`), error (sets `errorMessage`, preserves files by not touching them).
    - _Requirements: 5.5, 6.6, 10.4, 10.5, 10.6_

  - [~] 4.2 Write property test for forward-only transitions
    - **Property 5: State transitions are forward-only within a submission**
    - Tag: `// Feature: ai-lecture-companion, Property 5: State transitions are forward-only within a submission`
    - Generator for arbitrary event sequences; assert monotonic ordinal + no skips + Error escape hatch.
    - **Validates: Requirements 6.6**

  - [~] 4.3 Write property test for the Error-transition invariant
    - **Property 13: Entering the Error state preserves files and re-enables the button**
    - Tag: `// Feature: ai-lecture-companion, Property 13: Entering the Error state preserves files and re-enables the button`
    - Generators for pre-error states (both files selected) and error causes (API error / network failure).
    - **Validates: Requirements 5.5, 10.4, 10.5, 10.6**

- [~] 5. Checkpoint - core logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement presentational components
  - [~] 6.1 Implement Header and ThemeController
    - Header renders the title "AI Lecture Companion" and hosts the ThemeController; re-styles with the active theme.
    - ThemeController toggles the `dark` class on the document root, persists the choice to `localStorage` under a fixed key, reads it on mount, and defaults to `"light"` when absent or unreadable.
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [~] 6.2 Write example tests for Header and ThemeController
    - Title text present; default light with no stored preference; toggle switches; stored preference restored; unreadable storage falls back to light.
    - _Requirements: 1.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [~] 6.3 Implement the reusable DropZone component
    - Support drag-and-drop and click-to-open picker; on valid file call `onFileAccepted` and show the file name; on invalid call `onValidationError` without clearing the prior valid file; replace on new valid file.
    - Encode per-zone multi-drop policy via `config.multiDropPolicy` (audio `reject`, slides `firstOnly`), reusing the validation helpers from task 3.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [~] 6.4 Write example tests for DropZone
    - Shows selected file name after acceptance; invalid file keeps prior selection; audio rejects multi-drop with message; slides takes first of many.
    - _Requirements: 3.3, 3.4, 3.6, 4.3, 4.4, 4.6_

  - [~] 6.5 Implement the Process Button
    - Label "Process Lecture"; `disabled` iff either file unselected OR `ProcessingState ∈ {Uploading, TranscribingAudio, SynthesizingSlides}`; on click triggers submission.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [~] 6.6 Write property test for the button disabled predicate
    - **Property 4: Process button disabled predicate**
    - Tag: `// Feature: ai-lecture-companion, Property 4: Process button disabled predicate`
    - Generator over (audio selected?, slides selected?, ProcessingState).
    - **Validates: Requirements 5.2, 5.3**

  - [~] 6.7 Implement the StatusIndicator
    - Map each `ProcessingState` to its display text (Idle→"Ready", Uploading→"Uploading...", TranscribingAudio→"Transcribing Audio...", SynthesizingSlides→"Synthesizing Slides...", Complete→"Complete!", Error→error text).
    - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [~] 6.8 Write property test for status text totality
    - **Property 6: Status text is total and stage-correct**
    - Tag: `// Feature: ai-lecture-companion, Property 6: Status text is total and stage-correct`
    - Generator over all `ProcessingState` values; assert defined, non-empty, stage-correct text.
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7**

  - [~] 6.9 Implement the OutputContainer
    - Render Markdown via `react-markdown` iff `studyGuide` is non-null and has a non-whitespace character; show placeholder when null; show no-content message and retain placeholder when empty/whitespace.
    - Support headings h1–h6, ordered/unordered lists, bold/italic, fenced/inline code.
    - _Requirements: 1.5, 9.1, 9.2, 9.3, 9.4_

  - [~] 6.10 Write property test for the output rendering decision
    - **Property 12: Output rendering decision matches trimmed emptiness**
    - Tag: `// Feature: ai-lecture-companion, Property 12: Output rendering decision matches trimmed emptiness`
    - Generators for null/empty/whitespace/non-empty strings.
    - **Validates: Requirements 9.1, 9.3, 9.4**

  - [~] 6.11 Write example tests for OutputContainer Markdown coverage
    - Render each Markdown element (h1–h6, ordered/unordered lists, bold/italic, fenced/inline code) via `react-markdown`.
    - _Requirements: 9.2_

- [~] 7. Checkpoint - components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement the Dashboard page and wiring
  - [~] 8.1 Build the Dashboard layout and compose components (`app/page.tsx`)
    - Render header, upload section as a two-column grid (audio left, slides right) that stacks to single column below 768px, action section, StatusIndicator, and OutputContainer in top-to-bottom order.
    - Wire `useState` for files and `useReducer` (from task 4) for processing/studyGuide/errorMessage; wire both DropZones with `AUDIO_CONFIG`/`SLIDES_CONFIG`, the Process Button, StatusIndicator, and OutputContainer; apply the active theme across all sections.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.7_

  - [~] 8.2 Implement the submission flow
    - On click, build `FormData` (`audio`, `slides`), dispatch `Uploading`, then optimistically advance to `TranscribingAudio` and (after a scheduled delay) `SynthesizingSlides` while the POST is in flight.
    - On `200` dispatch `Complete` and set `studyGuide`; on non-OK read `{ error }`, dispatch `Error`, re-enable the button, retain files; on network failure dispatch `Error` with "The request could not be completed."
    - _Requirements: 5.4, 5.5, 6.2, 6.5, 9.1, 10.4, 10.5, 10.6_

  - [~] 8.3 Write example tests for dashboard wiring
    - Idle load shows "Ready" and empty OutputContainer; happy path renders study guide; error response and network failure both reach Error state with files retained and button re-enabled.
    - _Requirements: 1.5, 5.5, 6.5, 10.4, 10.5, 10.6_

- [~] 9. Checkpoint - client complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement the Process_API route
  - [~] 10.1 Implement request parsing and validation (`app/api/process/route.ts`)
    - Node.js runtime POST handler; read `FormData`, require exactly one `audio` and one `slides` file; validate audio extension/size and slides extension/size using the shared config; on failure return `400 { error, code }` with the specific `ProcessErrorCode` and never contact OpenAI.
    - _Requirements: 7.1, 7.2, 10.1_

  - [~] 10.2 Write property test for pre-upstream rejection of invalid requests
    - **Property 7: Missing-file requests are rejected before any upstream call**
    - Tag: `// Feature: ai-lecture-companion, Property 7: Missing-file requests are rejected before any upstream call`
    - Generators for absent/invalid fields; mock OpenAI and spy that it is never called; assert 4xx + failed-constraint code.
    - **Validates: Requirements 7.1, 7.2, 10.1**

  - [~] 10.3 Implement the credential guard
    - Read `OPENAI_API_KEY`; if absent, empty, or whitespace-only, return `503 { error: "Service unavailable" }` before contacting OpenAI.
    - _Requirements: 7.6, 7.7_

  - [~] 10.4 Write property test for the credential guard
    - **Property 8: Absent or empty credentials yield service-unavailable without upstream calls**
    - Tag: `// Feature: ai-lecture-companion, Property 8: Absent or empty credentials yield service-unavailable without upstream calls`
    - Generators for absent/empty/whitespace key values; assert 503 and no upstream calls.
    - **Validates: Requirements 7.6, 7.7**

  - [~] 10.5 Implement Whisper transcription
    - Send audio to `v1/audio/transcriptions`; on success capture `Transcript`; on error return `502 { error: "Transcription failed", code: "TRANSCRIPTION_FAILED" }`, retain no partial transcript, and do not call synthesis.
    - _Requirements: 7.3, 7.4, 7.5, 10.2_

  - [~] 10.6 Implement PDF slide extraction
    - Extract per-page text (always) and best-effort page images (capped page count) into `SlideMaterial`; if nothing usable is produced, surface via the synthesis-failed path.
    - _Requirements: 8.1_

  - [~] 10.7 Write edge-case tests for slide extraction
    - Empty PDF, image-only PDF, text-only PDF produce sensible `SlideMaterial` or route to the synthesis-failed contract.
    - _Requirements: 8.1, 8.5, 10.3_

  - [~] 10.8 Implement gpt-4o synthesis
    - Call gpt-4o with the verbatim `FEYNMAN_SYSTEM_PROMPT` plus a user message containing the `Transcript` and `SlideMaterial` (text and, when available, page images); on success return `200 { studyGuide }`; on error return `502 { error: "Synthesis failed", code: "SYNTHESIS_FAILED" }`.
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 10.3_

  - [~] 10.9 Write property test for stage-error mapping
    - **Property 10: Stage errors map to the defined error contract and halt the pipeline**
    - Tag: `// Feature: ai-lecture-companion, Property 10: Stage errors map to the defined error contract and halt the pipeline`
    - Generators for varied upstream error kinds; assert transcription error → 502 + no synthesis call; synthesis error → 502.
    - **Validates: Requirements 7.5, 8.5, 10.2, 10.3**

  - [~] 10.10 Write property test for verbatim prompt and inputs
    - **Property 11: Synthesis request always contains the verbatim Feynman prompt and both inputs**
    - Tag: `// Feature: ai-lecture-companion, Property 11: Synthesis request always contains the verbatim Feynman prompt and both inputs`
    - Capture the gpt-4o request via mock; assert exact `FEYNMAN_SYSTEM_PROMPT` equality plus presence of transcript + slide material.
    - **Validates: Requirements 8.2, 8.3**

  - [~] 10.11 Write property test for credential exclusion
    - **Property 9: Credentials never appear in any response**
    - Tag: `// Feature: ai-lecture-companion, Property 9: Credentials never appear in any response`
    - Drive a sentinel key through every branch (validation, 503, transcription error, synthesis error, success); assert the serialized response body and headers never contain the sentinel.
    - **Validates: Requirements 7.8**

- [ ] 11. Integration tests and final wiring
  - [~] 11.1 Write integration tests (mocked upstream)
    - Full happy path: valid multipart request → mocked Whisper transcript → mocked gpt-4o study guide → `200 { studyGuide }`.
    - Transcription-failed and synthesis-failed paths produce the correct status/code and stop the pipeline.
    - _Requirements: 7.3, 7.4, 7.5, 8.2, 8.4, 8.5_

  - [~] 11.2 Final wiring and cleanup
    - Confirm the Dashboard submission flow calls `/api/process` end-to-end against the implemented route (mocked OpenAI in tests), env var documented, and no orphaned code remains.
    - _Requirements: 5.4, 7.1, 8.4_

- [~] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (all tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirement sub-clauses for traceability.
- The design uses TypeScript throughout (not pseudocode), so all implementation uses TypeScript/React.
- Property tests use `fast-check` at a minimum of 100 iterations (`fc.assert(fc.property(...), { numRuns: 100 })`) and are tagged `// Feature: ai-lecture-companion, Property N: ...`.
- All 13 correctness properties are covered: P1 (3.2), P2 (3.3), P3 (3.4), P4 (6.6), P5 (4.2), P6 (6.8), P7 (10.2), P8 (10.4), P9 (10.11), P10 (10.9), P11 (10.10), P12 (6.10), P13 (4.3).
- Theme, Markdown rendering, responsive layout, and PDF-parse specifics use example/edge-case tests per the design Testing Strategy rather than properties.
- OpenAI calls are mocked in all automated tests so property and integration tests run fast and offline.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "4.3"] },
    { "id": 3, "tasks": ["6.1", "6.3", "6.5", "6.7", "6.9", "10.1", "10.3", "10.5", "10.6", "10.8"] },
    { "id": 4, "tasks": ["6.2", "6.4", "6.6", "6.8", "6.10", "6.11", "10.2", "10.4", "10.7", "10.9", "10.10", "10.11"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3", "11.1", "11.2"] }
  ]
}
```
