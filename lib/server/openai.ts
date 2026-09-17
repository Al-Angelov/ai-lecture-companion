// OpenAI pipeline wrapper (Requirements 7.3, 8.2, 8.3). Defines a small
// interface so the route can be exercised with a mocked client in tests, and a
// default implementation backed by the `openai` package.

import OpenAI, { toFile } from "openai";
import { FEYNMAN_SYSTEM_PROMPT, type SlideMaterial } from "@/lib/types";

export interface OpenAIPipeline {
  transcribe(audio: File): Promise<string>;
  synthesize(transcript: string, slides: SlideMaterial): Promise<string>;
}

/**
 * Builds the user message content parts for synthesis: always the transcript
 * and slide text, plus any best-effort page images as image_url parts.
 */
export function buildSynthesisUserContent(
  transcript: string,
  slides: SlideMaterial,
): Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
> {
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text:
        `LECTURE TRANSCRIPT:\n${transcript}\n\n` +
        `SLIDE DECK MATERIAL (text):\n${slides.text || "(no text extracted)"}`,
    },
  ];
  for (const image of slides.pageImages) {
    parts.push({ type: "image_url", image_url: { url: image } });
  }
  return parts;
}

/**
 * Default OpenAI-backed pipeline. Constructed with a validated API key. Any
 * error thrown by an upstream call propagates to the caller, which maps it to
 * the defined error contract (the raw error is never forwarded to the client).
 */
export function createOpenAIPipeline(apiKey: string): OpenAIPipeline {
  const client = new OpenAI({ apiKey });

  return {
    async transcribe(audio: File): Promise<string> {
      // Adapt the incoming File to a form the SDK accepts.
      const buffer = Buffer.from(await audio.arrayBuffer());
      const file = await toFile(buffer, audio.name);
      const result = await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });
      return result.text;
    },

    async synthesize(
      transcript: string,
      slides: SlideMaterial,
    ): Promise<string> {
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: FEYNMAN_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildSynthesisUserContent(transcript, slides),
          },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
  };
}
