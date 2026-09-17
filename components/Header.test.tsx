import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Header } from "./Header";
import { ThemeController } from "./ThemeController";
import type { Theme } from "@/lib/types";
import {
  readStoredTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

describe("Header", () => {
  it("renders the application title (Requirement 1.1)", () => {
    render(<Header theme="light" onToggleTheme={() => {}} />);
    expect(
      screen.getByRole("heading", { name: "AI Lecture Companion" }),
    ).toBeInTheDocument();
  });
});

describe("ThemeController", () => {
  it("invokes onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThemeController theme="light" onToggle={onToggle} />);
    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("switches label/icon based on theme (toggle switches) (Requirement 2.3)", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [theme, setTheme] = useState<Theme>("light");
      return (
        <ThemeController
          theme={theme}
          onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        />
      );
    }

    render(<Harness />);
    // Light mode shows a control that switches to dark.
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    // After toggle, control switches to light.
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });
});

describe("theme persistence helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults to light when no stored preference exists (Requirement 2.2)", () => {
    expect(readStoredTheme()).toBe("light");
  });

  it("restores a stored preference (Requirements 2.4, 2.5)", () => {
    storeTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("falls back to light when storage is unreadable (Requirement 2.6)", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(
      () => {
        throw new Error("storage blocked");
      },
    );
    expect(readStoredTheme()).toBe("light");
  });
});
