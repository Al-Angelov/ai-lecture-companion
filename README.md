# AI Lecture Companion

A Next.js (App Router) + TypeScript full-stack app that turns lecture audio and
slide PDFs into a Markdown study guide. Audio is transcribed with OpenAI Whisper
and synthesized with gpt-4o using the Feynman technique.

## Architecture

- **Client dashboard** (`app/page.tsx`): collects a lecture audio file and a
  slide-deck PDF, submits them as multipart form data to the API, and renders
  the returned Markdown study guide. Presentational components live in
  `components/`; shared client logic (validation, reducer, submission, UI
  decisions, theme) lives in `lib/`.
- **Process API** (`app/api/process/route.ts`, Node.js runtime): the only
  component that talks to OpenAI. It validates the request, guards credentials,
  transcribes the audio (Whisper), extracts slide material from the PDF, and
  synthesizes the study guide (gpt-4o). Server logic lives in `lib/server/`.

The client submission flow (`lib/submit.ts`) POSTs to `/api/process`, which is
implemented by the route above — this is the end-to-end wiring. In automated
tests OpenAI is always mocked, so tests run fast and offline.

## Environment

The API route reads the OpenAI API key from a server-side environment variable.
Copy `.env.example` to `.env.local` and set:

```
OPENAI_API_KEY=sk-...
```

If `OPENAI_API_KEY` is absent, empty, or whitespace-only, the route returns
`503 Service Unavailable` without contacting OpenAI. The key is never included
in any response returned to the client.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # run the production build
npm test        # run the full test suite once (vitest --run)
npm run test:watch  # watch mode
```

## Testing

- **Unit / example tests** cover components, theme behavior, and Markdown
  rendering.
- **Property-based tests** (fast-check, ≥ 100 iterations each) cover the 13
  correctness properties from the design. Each is tagged
  `// Feature: ai-lecture-companion, Property N: ...`.
- **Integration tests** (`app/api/process/route.test.ts`) drive the route
  end-to-end with mocked upstream calls.

## File size limits

- Audio (`.mp3`, `.wav`, `.m4a`): up to 500 MB (client-side selection ceiling).
- Slides (`.pdf`): up to 100 MB.

Note: OpenAI's Whisper endpoint enforces its own per-request upload limit; an
oversized-for-Whisper file is surfaced through the transcription-failed path.
