import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "./page";
import {
  submitLecture,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/submit";
import { ProcessingState } from "@/lib/types";
import { processingReducer, initialProcessingState } from "@/lib/reducer";
import type { ProcessingAction } from "@/lib/reducer";

function makeFile(name: string, size = 100) {
  const file = new File(["x"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// Replays dispatched actions through the real reducer to get the final state.
function finalStateFrom(actions: ProcessingAction[]) {
  return actions.reduce(processingReducer, initialProcessingState);
}

describe("Dashboard initial render", () => {
  it("idle load shows 'Ready' and an empty OutputContainer (Requirement 1.5)", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("status-indicator")).toHaveTextContent("Ready");
    expect(screen.getByTestId("placeholder-text")).toBeInTheDocument();
    expect(screen.queryByTestId("study-guide-markdown")).not.toBeInTheDocument();
  });

  it("disables the Process button while neither file is selected", () => {
    render(<Dashboard />);
    expect(
      screen.getByRole("button", { name: "Process Lecture" }),
    ).toBeDisabled();
  });
});

describe("submitLecture flow (Requirement 5.4, 5.5, 10.4-10.6)", () => {
  it("happy path reaches Complete with the returned study guide", async () => {
    const actions: ProcessingAction[] = [];
    const dispatch = (a: ProcessingAction) => actions.push(a);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ studyGuide: "# Guide" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await submitLecture({
      audioFile: makeFile("a.mp3"),
      slidesFile: makeFile("s.pdf"),
      dispatch,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const state = finalStateFrom(actions);
    expect(state.processingState).toBe(ProcessingState.Complete);
    expect(state.studyGuide).toBe("# Guide");

    // Verify the POST target and multipart body.
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/process",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchImpl.mock.calls[0][1].body as FormData;
    expect(body.get("audio")).toBeInstanceOf(File);
    expect(body.get("slides")).toBeInstanceOf(File);
  });

  it("error response reaches Error state with the server message", async () => {
    const actions: ProcessingAction[] = [];
    const dispatch = (a: ProcessingAction) => actions.push(a);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await submitLecture({
      audioFile: makeFile("a.mp3"),
      slidesFile: makeFile("s.pdf"),
      dispatch,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const state = finalStateFrom(actions);
    expect(state.processingState).toBe(ProcessingState.Error);
    expect(state.errorMessage).toBe("Transcription failed");
  });

  it("network failure reaches Error state with the network message (Requirement 10.6)", async () => {
    const actions: ProcessingAction[] = [];
    const dispatch = (a: ProcessingAction) => actions.push(a);
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));

    await submitLecture({
      audioFile: makeFile("a.mp3"),
      slidesFile: makeFile("s.pdf"),
      dispatch,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const state = finalStateFrom(actions);
    expect(state.processingState).toBe(ProcessingState.Error);
    expect(state.errorMessage).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("audio-only submission: sends only audio, skips the synthesizing stage, reaches Complete", async () => {
    const actions: ProcessingAction[] = [];
    const dispatch = (a: ProcessingAction) => actions.push(a);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ studyGuide: "# Audio Guide" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await submitLecture({
      audioFile: makeFile("a.mp3"),
      slidesFile: null,
      dispatch,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // Only the audio field is sent.
    const body = fetchImpl.mock.calls[0][1].body as FormData;
    expect(body.get("audio")).toBeInstanceOf(File);
    expect(body.get("slides")).toBeNull();

    // The synthesizing-stage advance is not dispatched (no PDF).
    expect(actions.some((a) => a.type === "ADVANCE_TRANSCRIBING")).toBe(true);
    expect(actions.some((a) => a.type === "ADVANCE_SYNTHESIZING")).toBe(false);

    const state = finalStateFrom(actions);
    expect(state.processingState).toBe(ProcessingState.Complete);
    expect(state.studyGuide).toBe("# Audio Guide");
  });

  it("pdf-only submission: sends only slides, skips the transcribing stage, reaches Complete", async () => {
    const actions: ProcessingAction[] = [];
    const dispatch = (a: ProcessingAction) => actions.push(a);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ studyGuide: "# PDF Guide" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await submitLecture({
      audioFile: null,
      slidesFile: makeFile("s.pdf"),
      dispatch,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const body = fetchImpl.mock.calls[0][1].body as FormData;
    expect(body.get("slides")).toBeInstanceOf(File);
    expect(body.get("audio")).toBeNull();

    // The transcribing-stage advance is not dispatched (no audio).
    expect(actions.some((a) => a.type === "ADVANCE_TRANSCRIBING")).toBe(false);
    expect(actions.some((a) => a.type === "ADVANCE_SYNTHESIZING")).toBe(true);

    const state = finalStateFrom(actions);
    expect(state.processingState).toBe(ProcessingState.Complete);
    expect(state.studyGuide).toBe("# PDF Guide");
  });
});
