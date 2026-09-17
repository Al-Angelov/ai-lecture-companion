// OpenAI pipeline wrapper (Requirements 7.3, 8.2, 8.3). Defines a small
// interface so the route can be exercised with a mocked client in tests, and a
// default implementation backed by the `openai` package.

import OpenAI, { toFile } from "openai";
import { buildFeynmanSystemPrompt, type SlideMaterial } from "@/lib/types";

export interface SynthesisInputs {
  transcript: string;
  slides: SlideMaterial;
  hasAudio: boolean;
  hasSlides: boolean;
}

export interface OpenAIPipeline {
  transcribe(audio: File): Promise<string>;
  synthesize(inputs: SynthesisInputs): Promise<string>;
}

/**
 * Builds the user message content parts for synthesis. Only the channels that
 * were actually provided are included, so an audio-only or pdf-only submission
 * does not send empty placeholder sections.
 */
export function buildSynthesisUserContent(
  inputs: SynthesisInputs,
): Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
> {
  const { transcript, slides, hasAudio, hasSlides } = inputs;
  const sections: string[] = [];
  if (hasAudio) {
    sections.push(`LECTURE TRANSCRIPT:\n${transcript}`);
  }
  if (hasSlides) {
    sections.push(
      `SLIDE DECK MATERIAL (text):\n${slides.text || "(no text extracted)"}`,
    );
  }

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: sections.join("\n\n") }];

  if (hasSlides) {
    for (const image of slides.pageImages) {
      parts.push({ type: "image_url", image_url: { url: image } });
    }
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

    async synthesize(inputs: SynthesisInputs): Promise<string> {
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: buildFeynmanSystemPrompt(inputs.hasAudio, inputs.hasSlides),
          },
          {
            role: "user",
            content: buildSynthesisUserContent(inputs),
          },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
  };
}
