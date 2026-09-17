"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Header } from "@/components/Header";
import { DropZone } from "@/components/DropZone";
import { ProcessButton } from "@/components/ProcessButton";
import { StatusIndicator } from "@/components/StatusIndicator";
import { OutputContainer } from "@/components/OutputContainer";
import {
  AUDIO_CONFIG,
  SLIDES_CONFIG,
  type Theme,
} from "@/lib/types";
import {
  initialProcessingState,
  processingReducer,
} from "@/lib/reducer";
import {
  applyThemeClass,
  readStoredTheme,
  storeTheme,
} from "@/lib/theme";
import { submitLecture } from "@/lib/submit";

export default function Dashboard() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [slidesFile, setSlidesFile] = useState<File | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const [proc, dispatch] = useReducer(
    processingReducer,
    initialProcessingState,
  );

  // Theme: default light, restore stored preference on mount (Requirement 2).
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyThemeClass(stored);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyThemeClass(next);
      storeTheme(next);
      return next;
    });
  }, []);

  const handleProcess = useCallback(() => {
    // A submission is valid when at least one file is present.
    if (!audioFile && !slidesFile) return;
    setSelectionError(null);
    void submitLecture({ audioFile, slidesFile, dispatch });
  }, [audioFile, slidesFile]);

  // The status indicator shows the reducer's error message, or a selection
  // (validation) error when no submission is in progress.
  const statusError = proc.errorMessage ?? selectionError;

  return (
    <main className="theme-transition mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-10">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* Upload section: two-column grid (audio left, slides right),
          stacks to a single column below 768px (Requirements 1.3, 1.4). */}
      <section
        aria-label="Upload materials"
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        <DropZone
          label="Lecture Audio"
          config={AUDIO_CONFIG}
          selectedFile={audioFile}
          onFileAccepted={(file) => {
            setSelectionError(null);
            setAudioFile(file);
          }}
          onValidationError={(message) => setSelectionError(message)}
        />
        <DropZone
          label="Lecture Slides"
          config={SLIDES_CONFIG}
          selectedFile={slidesFile}
          onFileAccepted={(file) => {
            setSelectionError(null);
            setSlidesFile(file);
          }}
          onValidationError={(message) => setSelectionError(message)}
        />
      </section>

      {/* Action section (Requirement 5.1). */}
      <section aria-label="Actions" className="flex items-center gap-4">
        <ProcessButton
          audioSelected={audioFile !== null}
          slidesSelected={slidesFile !== null}
          processingState={proc.processingState}
          onClick={handleProcess}
        />
      </section>

      <StatusIndicator state={proc.processingState} errorMessage={statusError} />

      <OutputContainer studyGuide={proc.studyGuide} />
    </main>
  );
}
