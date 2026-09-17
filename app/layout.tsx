import type { Metadata } from "next";
import "./globals.css";
// KaTeX stylesheet: required so rehype-katex output renders as formatted math
// rather than unstyled markup. Imported once at the root.
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "AI Lecture Companion",
  description:
    "Transform lecture audio and slides into an AI-generated study guide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="theme-transition min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
