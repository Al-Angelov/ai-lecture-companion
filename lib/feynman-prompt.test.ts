import { describe, it, expect } from "vitest";
import { FEYNMAN_SYSTEM_PROMPT } from "./types";

// Guard test protecting Property 11's premise: the synthesis system prompt must
// match Requirement 8.3 character-for-character. This literal is copied
// verbatim from requirements.md Requirement 8.3.
describe("FEYNMAN_SYSTEM_PROMPT", () => {
  it("matches the exact string mandated by Requirement 8.3", () => {
    const expected =
      "Act as an expert private tutor. You will receive a lecture transcript and the corresponding slide deck material. Synthesize this material into a dummy-proof study guide using the Feynman technique. Format your output strictly in Markdown with these sections: 1. Core Concept in Plain English. 2. Step-by-Step Formula Breakdown (with real-world numbers/units if applicable). 3. Real-World Analogy & Practical Example. 4. Slide Cross-Reference & Key Takeaways.";

    expect(FEYNMAN_SYSTEM_PROMPT).toBe(expected);
  });
});
