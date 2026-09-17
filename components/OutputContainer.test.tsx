import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutputContainer } from "./OutputContainer";

describe("OutputContainer states", () => {
  it("shows placeholder when studyGuide is null (Requirement 9.3)", () => {
    render(<OutputContainer studyGuide={null} />);
    expect(screen.getByTestId("placeholder-text")).toBeInTheDocument();
    expect(screen.queryByTestId("study-guide-markdown")).not.toBeInTheDocument();
  });

  it("shows no-content message and retains placeholder for whitespace (Requirement 9.4)", () => {
    render(<OutputContainer studyGuide={"   \n\t  "} />);
    expect(screen.getByTestId("empty-content-message")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-text")).toBeInTheDocument();
    expect(screen.queryByTestId("study-guide-markdown")).not.toBeInTheDocument();
  });

  it("renders markdown when content is present (Requirement 9.1)", () => {
    render(<OutputContainer studyGuide={"# Hello world"} />);
    expect(screen.getByTestId("study-guide-markdown")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Hello world" }),
    ).toBeInTheDocument();
  });
});

describe("OutputContainer Markdown element coverage (Requirement 9.2)", () => {
  it("renders headings h1-h6", () => {
    const md = ["# H1", "## H2", "### H3", "#### H4", "##### H5", "###### H6"].join(
      "\n\n",
    );
    render(<OutputContainer studyGuide={md} />);
    for (let level = 1; level <= 6; level++) {
      expect(
        screen.getByRole("heading", { level, name: `H${level}` }),
      ).toBeInTheDocument();
    }
  });

  it("renders unordered and ordered lists", () => {
    const md = "- alpha\n- beta\n\n1. one\n2. two";
    const { container } = render(<OutputContainer studyGuide={md} />);
    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(container.querySelector("ol")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
  });

  it("renders bold and italic emphasis", () => {
    const { container } = render(
      <OutputContainer studyGuide={"**bold** and *italic*"} />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
  });

  it("renders fenced and inline code", () => {
    const md = "Inline `code` here\n\n```\nfenced block\n```";
    const { container } = render(<OutputContainer studyGuide={md} />);
    const codeEls = container.querySelectorAll("code");
    expect(codeEls.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("pre")).toBeInTheDocument();
  });
});

describe("OutputContainer KaTeX math rendering", () => {
  it("renders inline math ($...$) as KaTeX markup (not visible $-delimited text)", () => {
    const { container } = render(
      <OutputContainer studyGuide={"The relation is $E = mc^2$ exactly."} />,
    );
    // rehype-katex emits a `.katex` element with the rendered math.
    expect(container.querySelector(".katex")).toBeInTheDocument();
    // The visible math (KaTeX HTML layer) must not still show the `$` delimiters
    // as literal characters.
    const visible = container.querySelector(".katex-html");
    expect(visible?.textContent ?? "").not.toContain("$");
  });

  it("renders display math ($$...$$) as KaTeX markup", () => {
    // Display math needs to be its own block for remark-math to treat it as a
    // display equation.
    const { container } = render(
      <OutputContainer
        studyGuide={"Here:\n\n$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$\n\nDone."}
      />,
    );
    // Math rendered by KaTeX (the source LaTeX lives only in a hidden MathML
    // annotation for accessibility, which is expected — not a visible artifact).
    const katex = container.querySelector(".katex");
    expect(katex).toBeInTheDocument();
    expect(katex?.querySelector("annotation")?.textContent).toContain(
      "\\int_0^1",
    );
  });
});
