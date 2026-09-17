"use client";

import ReactMarkdown from "react-markdown";
import { outputMode } from "@/lib/ui-logic";

interface OutputContainerProps {
  studyGuide: string | null;
}

const PLACEHOLDER_TEXT =
  "Your generated study guide will appear here after you process a lecture.";
const EMPTY_CONTENT_MESSAGE = "No study guide content is available.";

/**
 * Renders the study guide as Markdown, or a placeholder / empty-content notice
 * (Requirements 1.5, 9.1-9.4 — Property 12).
 */
export function OutputContainer({ studyGuide }: OutputContainerProps) {
  const mode = outputMode(studyGuide);

  return (
    <section
      aria-label="Study guide output"
      data-testid="output-container"
      className="theme-transition min-h-48 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
    >
      {mode === "render" ? (
        <div
          data-testid="study-guide-markdown"
          className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold"
        >
          <ReactMarkdown>{studyGuide}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {mode === "empty" && (
            <p
              data-testid="empty-content-message"
              className="text-sm font-medium text-amber-700 dark:text-amber-400"
            >
              {EMPTY_CONTENT_MESSAGE}
            </p>
          )}
          <p
            data-testid="placeholder-text"
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {PLACEHOLDER_TEXT}
          </p>
        </div>
      )}
    </section>
  );
}
