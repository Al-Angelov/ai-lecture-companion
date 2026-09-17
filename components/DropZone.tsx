"use client";

import { useRef, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import type { FileValidationConfig } from "@/lib/types";
import { applySelection, resolveMultiDrop } from "@/lib/validation";

interface DropZoneProps {
  label: string;
  config: FileValidationConfig;
  selectedFile: File | null;
  onFileAccepted: (file: File) => void;
  onValidationError: (message: string) => void;
}

/**
 * Reusable drag-and-drop + click-to-pick zone (Requirements 3, 4).
 * - Valid file => onFileAccepted, shows the name.
 * - Invalid file => onValidationError, prior valid selection retained.
 * - Multi-file drop honors config.multiDropPolicy (audio reject / slides first).
 */
export function DropZone({
  label,
  config,
  selectedFile,
  onFileAccepted,
  onValidationError,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const resolution = resolveMultiDrop(files, config);

    if (resolution.rejected) {
      onValidationError(
        resolution.message ?? config.wrongFormatMessage,
      );
      return;
    }

    const candidate = resolution.candidate;
    if (!candidate) return;

    const { file, result } = applySelection(selectedFile, candidate, config);
    if (result.ok && file) {
      onFileAccepted(file);
    } else if (!result.ok) {
      onValidationError(result.message ?? config.wrongFormatMessage);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
    }
    // Reset so selecting the same file again re-triggers change.
    e.target.value = "";
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  const accept = config.acceptedExtensions.join(",");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} drop zone. Drag a file here or activate to browse.`}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "theme-transition flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600",
        ].join(" ")}
      >
        {selectedFile ? (
          <>
            <FileCheck2
              className="h-8 w-8 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <span
              className="break-all text-sm font-medium text-gray-900 dark:text-gray-100"
              data-testid="selected-file-name"
            >
              {selectedFile.name}
            </span>
          </>
        ) : (
          <>
            <UploadCloud
              className="h-8 w-8 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Drag &amp; drop or click to browse
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {config.acceptedExtensions.join(", ")}
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={config.multiDropPolicy === "firstOnly"}
          onChange={handleInputChange}
          className="hidden"
          data-testid={`file-input-${config.field}`}
        />
      </div>
    </div>
  );
}
