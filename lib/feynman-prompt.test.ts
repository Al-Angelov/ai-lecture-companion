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
  it("uses the world-class-tutor persona and keeps the {provided_materials} placeholder", () => {
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "You are a world-class tutor",
    );
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "You are receiving {provided_materials}.",
    );
  });

  it("encodes the strict teaching & formatting rules", () => {
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("TARGET AUDIENCE");
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("DUMMY-PROOF MATH");
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("MATH FORMATTING");
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("VISUAL STRUCTURE");
    // LaTeX delimiters are mandated so the KaTeX renderer has math to format.
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("$...$");
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain("$$...$$");
  });

  it("mandates the strict Markdown section headers", () => {
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "# 🎯 Core Concepts Explained Simply",
    );
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "# 📐 Step-by-Step Mathematical Foundations",
    );
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "# 📝 Realistic Exam Question & Full Solution",
    );
    expect(FEYNMAN_SYSTEM_PROMPT_TEMPLATE).toContain(
      "# 💡 Key Takeaways & Slide Cross-References",
    );
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
