// Pure file-validation logic shared by the client DropZone and the server route.
// No DOM or React dependencies so it can run in any environment.

import type { FileValidationConfig, ValidationResult } from "./types";

// Minimal shape needed to validate a file: name + size. `File` satisfies this,
// which lets the same logic run on the client (browser File) and the server
// (FormData File) as well as in tests with plain objects.
export interface ValidatableFile {
  name: string;
  size: number;
}

/**
 * Extract the lowercased extension (including the leading dot) from a filename.
 * Returns "" when the name has no extension (no dot, or a trailing/leading dot
 * that yields an empty segment).
 */
export function getExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  // No dot, or dot is the first char (e.g. ".env" is treated as no extension
  // segment here only when there is nothing before it), or dot is the last char.
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return "";
  }
  return name.slice(lastDot).toLowerCase();
}

/**
 * Property 1 core: a file is valid iff its extension is in the accepted list
 * (case-insensitive) AND its size is <= maxSizeBytes. Otherwise it returns the
 * config's wrong-format message (format failure takes precedence) or oversize
 * message.
 */
export function validateFile(
  file: ValidatableFile,
  config: FileValidationConfig,
): ValidationResult {
  const ext = getExtension(file.name);
  const accepted = config.acceptedExtensions.map((e) => e.toLowerCase());
  const extensionOk = accepted.includes(ext);

  if (!extensionOk) {
    return { ok: false, message: config.wrongFormatMessage };
  }

  if (file.size > config.maxSizeBytes) {
    return { ok: false, message: config.oversizeMessage };
  }

  return { ok: true };
}

/**
 * Applies a newly offered file against the current selection: returns the
 * offered file when it is valid, otherwise keeps `current` unchanged.
 * (Requirements 3.4, 3.5, 4.4, 4.5 — Property 2.)
 */
export function applySelection<T extends ValidatableFile>(
  current: T | null,
  offered: T,
  config: FileValidationConfig,
): { file: T | null; result: ValidationResult } {
  const result = validateFile(offered, config);
  if (result.ok) {
    return { file: offered, result };
  }
  return { file: current, result };
}

export interface MultiDropResolution<T extends ValidatableFile> {
  // The file the zone should attempt to select (subject to validation by the
  // caller), or null when the drop is rejected outright.
  candidate: T | null;
  // True when a multi-file drop was rejected by policy "reject".
  rejected: boolean;
  // Message to surface when rejected.
  message?: string;
}

/**
 * Resolves a drop of one or more files according to the zone's multi-drop
 * policy (Property 3):
 *  - "reject":    two or more files => reject the whole drop with a message.
 *  - "firstOnly": take the first file, ignore the rest.
 * A single-file drop is always passed through as the candidate regardless of
 * policy.
 */
export function resolveMultiDrop<T extends ValidatableFile>(
  files: T[],
  config: FileValidationConfig,
): MultiDropResolution<T> {
  if (files.length === 0) {
    return { candidate: null, rejected: false };
  }

  if (files.length >= 2 && config.multiDropPolicy === "reject") {
    return {
      candidate: null,
      rejected: true,
      message: config.multiDropMessage,
    };
  }

  // "firstOnly" (or a single-file drop): take the first, ignore the rest.
  return { candidate: files[0], rejected: false };
}
