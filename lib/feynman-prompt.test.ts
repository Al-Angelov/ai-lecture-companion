import { describe, it, expect } from "vitest";
import {
  FEYNMAN_SYSTEM_PROMPT_TEMPLATE,
  PROVIDED_MATERIALS,
  buildFeynmanSystemPrompt,
} from "./types";

// Guard test protecting Property 11's premise: the dynamic synthesis system
// prompt must match the mandated template character-for-character, and the
// {provided_materials} placeholder must resolve to the correct phrase for each
// combination of inputs.
describe("FEYNMAN_SYSTEM_PROMPT_TEMPLATE", () => {
  it("matches the exact dynamic template string", () => {
    const expected =
      "Act as an expert private tutor. You are receiving {provided_materials}. Synthesize this material into a dummy-proof study guide using the Feynman technique. Format your output strictly in Markdown with these sections: 1. Core Concept in Plain English. 2. Step-by-Step Breakdown (with real-world numbers/units if applicable). 3. Real-World Analogy & Practical Example. 4. Source Cross-Reference & Key Takeaways.";

    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toBe(expected);
  });
});

describe("buildFeynmanSystemPrompt", () => {
  it("swaps {provided_materials} for the transcript phrase when only audio is present", () => {
    const prompt = buildFeynmanSystemPrompt(true, false);
    expect(prompt).toContain(`You are receiving ${PROVIDED_MATERIALS.audioOnly}.`);
    expect(prompt).not.toContain("{provided_materials}");
    expect(PROVIDED_MATERIALS.audioOnly).toBe("a lecture transcript");
  });

  it("swaps {provided_materials} for the slide-deck phrase when only slides are present", () => {
    const prompt = buildFeynmanSystemPrompt(false, true);
    expect(prompt).toContain(`You are receiving ${PROVIDED_MATERIALS.slidesOnly}.`);
    expect(prompt).not.toContain("{provided_materials}");
    expect(PROVIDED_MATERIALS.slidesOnly).toBe("a slide deck");
  });

  it("swaps {provided_materials} for the combined phrase when both are present", () => {
    const prompt = buildFeynmanSystemPrompt(true, true);
    expect(prompt).toContain(`You are receiving ${PROVIDED_MATERIALS.both}.`);
    expect(prompt).not.toContain("{provided_materials}");
    expect(PROVIDED_MATERIALS.both).toBe(
      "a lecture transcript and the corresponding slide deck",
    );
  });
});
