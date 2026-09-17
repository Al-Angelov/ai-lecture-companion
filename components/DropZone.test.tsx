import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "./DropZone";
import { AUDIO_CONFIG, SLIDES_CONFIG } from "@/lib/types";

function makeFile(name: string, size: number, type = "application/octet-stream") {
  const file = new File(["x"], name, { type });
  // jsdom File size is derived from content; override to the desired size.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function dropFiles(zone: HTMLElement, files: File[]) {
  fireEvent.drop(zone, {
    dataTransfer: { files },
  });
}

describe("DropZone", () => {
  it("shows the selected file name after acceptance (Requirements 3.3, 4.3)", () => {
    render(
      <DropZone
        label="Lecture Audio"
        config={AUDIO_CONFIG}
        selectedFile={makeFile("lecture.mp3", 100)}
        onFileAccepted={() => {}}
        onValidationError={() => {}}
      />,
    );
    expect(screen.getByTestId("selected-file-name")).toHaveTextContent(
      "lecture.mp3",
    );
  });

  it("accepts a valid dropped file", () => {
    const onFileAccepted = vi.fn();
    const onValidationError = vi.fn();
    render(
      <DropZone
        label="Lecture Audio"
        config={AUDIO_CONFIG}
        selectedFile={null}
        onFileAccepted={onFileAccepted}
        onValidationError={onValidationError}
      />,
    );
    dropFiles(screen.getByRole("button"), [makeFile("good.wav", 100)]);
    expect(onFileAccepted).toHaveBeenCalledTimes(1);
    expect(onFileAccepted.mock.calls[0][0].name).toBe("good.wav");
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("invalid file keeps prior selection and reports error (Requirement 3.4)", () => {
    const onFileAccepted = vi.fn();
    const onValidationError = vi.fn();
    render(
      <DropZone
        label="Lecture Audio"
        config={AUDIO_CONFIG}
        selectedFile={makeFile("prev.mp3", 100)}
        onFileAccepted={onFileAccepted}
        onValidationError={onValidationError}
      />,
    );
    dropFiles(screen.getByRole("button"), [makeFile("bad.txt", 100)]);
    expect(onFileAccepted).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(
      AUDIO_CONFIG.wrongFormatMessage,
    );
    // Prior selection still displayed.
    expect(screen.getByTestId("selected-file-name")).toHaveTextContent(
      "prev.mp3",
    );
  });

  it("audio rejects a multi-file drop with the single-file message (Requirement 3.6)", () => {
    const onFileAccepted = vi.fn();
    const onValidationError = vi.fn();
    render(
      <DropZone
        label="Lecture Audio"
        config={AUDIO_CONFIG}
        selectedFile={null}
        onFileAccepted={onFileAccepted}
        onValidationError={onValidationError}
      />,
    );
    dropFiles(screen.getByRole("button"), [
      makeFile("a.mp3", 100),
      makeFile("b.mp3", 100),
    ]);
    expect(onFileAccepted).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledWith(
      AUDIO_CONFIG.multiDropMessage,
    );
  });

  it("slides takes the first of many dropped files (Requirement 4.6)", () => {
    const onFileAccepted = vi.fn();
    const onValidationError = vi.fn();
    render(
      <DropZone
        label="Lecture Slides"
        config={SLIDES_CONFIG}
        selectedFile={null}
        onFileAccepted={onFileAccepted}
        onValidationError={onValidationError}
      />,
    );
    dropFiles(screen.getByRole("button"), [
      makeFile("first.pdf", 100),
      makeFile("second.pdf", 100),
    ]);
    expect(onFileAccepted).toHaveBeenCalledTimes(1);
    expect(onFileAccepted.mock.calls[0][0].name).toBe("first.pdf");
  });
});
