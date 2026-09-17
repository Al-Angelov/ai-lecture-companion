# Requirements Document

## Introduction

The AI Lecture Companion is a Next.js full-stack web application that transforms lecture materials into AI-generated study guides. Phase 1 MVP delivers a minimalist, distraction-free dashboard where a user uploads lecture audio and PDF slides, submits them to a serverless processing pipeline, and receives a Markdown-formatted study guide synthesized using the Feynman technique.

The processing pipeline uses the OpenAI ecosystem exclusively: the Whisper API transcribes the audio to text, and the gpt-4o model performs multimodal synthesis of the transcript combined with the parsed slide deck material. API credentials remain server-side and are never exposed to the client.

This document defines the requirements for the frontend dashboard, the backend audio-transcription and multimodal-synthesis pipeline, file upload and validation, client-side state management, and error handling.

## Glossary

- **Companion_App**: The complete Next.js full-stack web application (frontend dashboard plus backend API routes).
- **Dashboard**: The client-side user interface rendered at the application root route (`app/page.tsx`).
- **Audio_Drop_Zone**: The drag-and-drop UI region in the left grid column that accepts a single lecture audio file.
- **Slides_Drop_Zone**: The drag-and-drop UI region in the right grid column that accepts a single lecture slide deck PDF file.
- **Process_Button**: The action control labeled "Process Lecture" that submits the selected files to the backend.
- **Status_Indicator**: The dynamic text element that displays the current processing state to the user.
- **Output_Container**: The readable UI region that renders the returned study guide as formatted Markdown.
- **Theme_Controller**: The client-side mechanism that switches the Dashboard between dark mode and light mode.
- **Process_API**: The Next.js serverless POST route (`app/api/process/route.ts`) that executes the processing pipeline.
- **Transcription_Service**: The OpenAI Whisper API endpoint (`v1/audio/transcriptions`) used to convert audio to text.
- **Synthesis_Service**: The OpenAI gpt-4o model used to synthesize the transcript and slide material into a study guide.
- **Transcript**: The plain-text output produced by the Transcription_Service from the uploaded audio file.
- **Slide_Material**: The text and/or image content extracted from the uploaded PDF slide deck.
- **Study_Guide**: The Markdown-formatted study guide returned by the Synthesis_Service.
- **Supported_Audio_Format**: An audio file with an extension of `.mp3`, `.wav`, or `.m4a`.
- **Supported_Slides_Format**: A slide deck file with an extension of `.pdf`.
- **Max_Audio_Size**: The maximum allowed size of a selected audio file, 524,288,000 bytes (500 MB).
- **Max_Slides_Size**: The maximum allowed size of a selected slides file, 104,857,600 bytes (100 MB).
- **Desktop_Breakpoint**: The viewport width threshold of 768 pixels; widths below this value use the single-column stacked layout.
- **Idle_State_Text**: The text "Ready" displayed by the Status_Indicator while no submission is in progress.
- **Feynman_System_Prompt**: The exact system prompt provided to the Synthesis_Service (defined in Requirement 8).
- **Processing_State**: The current stage of the pipeline, one of: Idle, Uploading, Transcribing Audio, Synthesizing Slides, Complete, or Error.

## Requirements

### Requirement 1: Minimalist Dashboard Layout

**User Story:** As a student, I want a clean, distraction-free dashboard, so that I can focus on uploading materials and reading my study guide without visual clutter.

#### Acceptance Criteria

1. THE Dashboard SHALL display a header containing the title text "AI Lecture Companion".
2. THE Dashboard SHALL display, in top-to-bottom order, the upload section, the action section, the Status_Indicator, and the Output_Container.
3. THE Dashboard SHALL arrange the upload section as a two-column grid with the Audio_Drop_Zone in the left column and the Slides_Drop_Zone in the right column.
4. WHERE the viewport width is less than 768 pixels, THE Dashboard SHALL stack the Audio_Drop_Zone and Slides_Drop_Zone vertically in a single column.
5. WHEN the Dashboard first loads and no material has been uploaded, THE Dashboard SHALL display the Status_Indicator in an idle state and display the Output_Container empty of study guide content.

### Requirement 2: Theme Support

**User Story:** As a student, I want dark and light mode support, so that I can read comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme_Controller SHALL support a dark mode and a light mode for the Dashboard.
2. WHEN the Dashboard first loads and no stored theme preference exists, THE Theme_Controller SHALL apply light mode as the default theme.
3. WHEN the user activates the theme toggle, THE Theme_Controller SHALL switch the Dashboard between dark mode and light mode within 500 milliseconds.
4. WHEN the user switches the theme, THE Theme_Controller SHALL store the selected theme preference.
5. WHEN the Dashboard loads and a stored theme preference exists, THE Theme_Controller SHALL apply the stored theme preference.
6. IF the stored theme preference cannot be retrieved, THEN THE Theme_Controller SHALL apply light mode as the default theme.
7. THE Dashboard SHALL apply the active theme to the header, upload section, action section, Status_Indicator, and Output_Container.

### Requirement 3: Audio File Selection

**User Story:** As a student, I want to drag and drop or select my lecture audio, so that I can provide the recording for transcription.

#### Acceptance Criteria

1. WHEN the user drops a single file onto the Audio_Drop_Zone, THE Dashboard SHALL capture that file as the selected audio file.
2. WHEN the user selects a file through the Audio_Drop_Zone file picker, THE Dashboard SHALL capture that file as the selected audio file.
3. WHEN an audio file is captured as the selected audio file, THE Dashboard SHALL display the selected audio file name in the Audio_Drop_Zone.
4. IF the selected audio file is not a Supported_Audio_Format, THEN THE Dashboard SHALL reject the file, retain any previously selected valid audio file, and display a message stating that only `.mp3`, `.wav`, and `.m4a` files are accepted.
5. WHEN a new valid audio file is selected while an audio file is already selected, THE Dashboard SHALL replace the previously selected audio file with the new file and update the displayed file name.
6. IF the user drops more than one file onto the Audio_Drop_Zone, THEN THE Dashboard SHALL reject the drop and display a message stating that only one audio file may be selected.
7. IF the selected audio file exceeds 524,288,000 bytes (500 MB), THEN THE Dashboard SHALL reject the file, retain any previously selected valid audio file, and display a message stating that the audio file exceeds the maximum allowed size.

### Requirement 4: Slides File Selection

**User Story:** As a student, I want to drag and drop or select my lecture slides, so that I can provide the slide deck for synthesis.

#### Acceptance Criteria

1. WHEN the user drops a single file onto the Slides_Drop_Zone, THE Dashboard SHALL capture that file as the selected slides file.
2. WHEN the user selects a file through the Slides_Drop_Zone file picker, THE Dashboard SHALL capture that file as the selected slides file.
3. WHEN a slides file is captured as the selected slides file, THE Dashboard SHALL display the selected slides file name in the Slides_Drop_Zone.
4. IF the selected slides file is not a Supported_Slides_Format, THEN THE Dashboard SHALL reject the file, retain any previously selected valid slides file, and display a message stating that only `.pdf` files are accepted.
5. WHEN a new valid slides file is selected while a slides file is already selected, THE Dashboard SHALL replace the previously selected slides file with the new file and update the displayed file name.
6. IF the user drops more than one file onto the Slides_Drop_Zone, THEN THE Dashboard SHALL capture only the first file and ignore the remaining files.
7. IF the selected slides file exceeds 104,857,600 bytes (100 MB), THEN THE Dashboard SHALL reject the file, retain any previously selected valid slides file, and display a message stating that the slides file exceeds the maximum allowed size.

### Requirement 5: Process Submission Control

**User Story:** As a student, I want a clear action button to start processing, so that I control when my materials are submitted.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Process_Button labeled "Process Lecture" in the action section.
2. WHILE either the audio file or the slides file is not selected, THE Dashboard SHALL disable the Process_Button such that the user cannot activate it.
3. WHILE the Processing_State is Uploading, Transcribing Audio, or Synthesizing Slides, THE Dashboard SHALL disable the Process_Button such that the user cannot activate it.
4. WHEN the user activates the Process_Button, THE Dashboard SHALL submit the selected audio file and slides file to the Process_API as multipart form data and set the Processing_State to Uploading.
5. IF the submission to the Process_API fails, THEN THE Dashboard SHALL retain the selected audio file and slides file, set the Processing_State to Error, re-enable the Process_Button, and display an error indication informing the user that the submission did not complete.

### Requirement 6: Processing State Indication

**User Story:** As a student, I want to see the current processing stage, so that I know the system is working and how far along it is.

#### Acceptance Criteria

1. WHILE no submission is in progress, THE Status_Indicator SHALL display the Idle state text "Ready".
2. WHEN the user submits the files, THE Status_Indicator SHALL display "Uploading..." within 1 second of the submission event.
3. WHILE the Process_API is transcribing audio, THE Status_Indicator SHALL display "Transcribing Audio...".
4. WHILE the Process_API is synthesizing slides, THE Status_Indicator SHALL display "Synthesizing Slides...".
5. WHEN the Process_API returns the Study_Guide successfully, THE Status_Indicator SHALL display "Complete!" and SHALL retain the "Complete!" text until the next submission begins.
6. THE Dashboard SHALL transition the Status_Indicator through the states in the forward-only order Idle, Uploading, Transcribing Audio, Synthesizing Slides, Complete, without skipping any state and without returning to a prior state during a single submission.
7. IF the Process_API fails or does not respond at any processing stage, THEN THE Status_Indicator SHALL stop displaying the current active-stage text and SHALL display an error state text indicating that processing failed.

### Requirement 7: Audio Transcription Pipeline

**User Story:** As a student, I want my lecture audio converted to text, so that its content can be synthesized into a study guide.

#### Acceptance Criteria

1. THE Process_API SHALL accept POST requests containing exactly one audio file and one slides file submitted as multipart form data.
2. IF a POST request is missing the audio file or is missing the slides file, THEN THE Process_API SHALL reject the request without contacting the Transcription_Service and return a response indicating which validation constraint failed with a client-error status code.
3. WHEN the Process_API receives a request that satisfies all validation constraints, THE Process_API SHALL send the audio file to the Transcription_Service at the OpenAI `v1/audio/transcriptions` endpoint.
4. WHEN the Transcription_Service returns a successful result, THE Process_API SHALL capture the returned text as the Transcript.
5. IF the Transcription_Service returns an error, THEN THE Process_API SHALL abort the transcription, retain no partial Transcript, and return a response indicating that transcription failed.
6. THE Process_API SHALL read the OpenAI API credentials from a server-side environment variable.
7. IF the server-side environment variable containing the OpenAI API credentials is absent or empty, THEN THE Process_API SHALL abort the request without contacting the Transcription_Service and return a response indicating that the service is unavailable.
8. THE Process_API SHALL exclude the OpenAI API credentials from every response returned to the Dashboard.

### Requirement 8: Multimodal Synthesis Pipeline

**User Story:** As a student, I want the transcript and slides combined into a single study guide, so that I get one coherent explanation of the lecture.

#### Acceptance Criteria

1. WHEN the Process_API obtains the Transcript, THE Process_API SHALL extract the Slide_Material from the uploaded PDF as text and/or images.
2. WHEN the Slide_Material is extracted, THE Process_API SHALL send a request to the Synthesis_Service using the OpenAI gpt-4o model that includes both the Transcript and the Slide_Material.
3. THE Process_API SHALL include the following system prompt verbatim in the Synthesis_Service request: "Act as an expert private tutor. You will receive a lecture transcript and the corresponding slide deck material. Synthesize this material into a dummy-proof study guide using the Feynman technique. Format your output strictly in Markdown with these sections: 1. Core Concept in Plain English. 2. Step-by-Step Formula Breakdown (with real-world numbers/units if applicable). 3. Real-World Analogy & Practical Example. 4. Slide Cross-Reference & Key Takeaways."
4. WHEN the Synthesis_Service returns a successful result, THE Process_API SHALL return the result to the Dashboard as the Study_Guide in Markdown format.
5. IF the Synthesis_Service returns an error, THEN THE Process_API SHALL return a response indicating that synthesis failed.

### Requirement 9: Study Guide Rendering

**User Story:** As a student, I want to read a well-formatted study guide, so that I can study directly from the dashboard.

#### Acceptance Criteria

1. WHEN the Dashboard receives the Study_Guide, THE Output_Container SHALL render the Study_Guide as formatted Markdown.
2. THE Output_Container SHALL render Markdown headings (levels 1 through 6), ordered and unordered lists, bold and italic emphasis, and fenced and inline code blocks present in the Study_Guide.
3. WHILE no Study_Guide has been received, THE Output_Container SHALL display placeholder text describing where the study guide will appear.
4. IF the received Study_Guide is empty or contains only whitespace, THEN THE Output_Container SHALL display a message indicating that no study guide content is available and SHALL retain the placeholder text.

### Requirement 10: Error Handling

**User Story:** As a student, I want clear feedback when something goes wrong, so that I understand the failure and can retry.

#### Acceptance Criteria

1. IF the Process_API receives a request missing the audio file or the slides file, THEN THE Process_API SHALL return an error response with a descriptive message and a client-error status code.
2. IF the Transcription_Service returns an error, THEN THE Process_API SHALL return an error response describing that transcription failed.
3. IF the Synthesis_Service returns an error, THEN THE Process_API SHALL return an error response describing that synthesis failed.
4. IF the Process_API returns an error response, THEN THE Dashboard SHALL set the Processing_State to Error and display the error message to the user.
5. WHEN the Processing_State is set to Error, THE Dashboard SHALL re-enable the Process_Button so that the user can retry while retaining the previously selected audio file and slides file.
6. IF a network failure prevents the submission from reaching the Process_API, THEN THE Dashboard SHALL set the Processing_State to Error and display a message stating that the request could not be completed.
