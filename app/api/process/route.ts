// Process_API route (app/api/process/route.ts). Node.js runtime because PDF
// parsing and large multipart handling rely on Node buffers/libraries.
//
// This handler is a thin adapter: it parses the multipart body, delegates to
// the pipeline orchestrator, and serializes the result. Credentials are read
// here from the server environment and never included in any response.

import { NextResponse } from "next/server";
import { runProcessPipeline } from "@/lib/server/pipeline";
import { createOpenAIPipeline } from "@/lib/server/openai";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // Wrap the entire processing pipeline so no unexpected error escapes as an
  // opaque runtime crash. Mapped stage errors (400/502/503) are returned by the
  // pipeline itself; anything unexpected is logged and returned as a 500 with
  // its actual message.
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: "A valid multipart form-data request is required.",
          code: "MISSING_FILES",
        },
        { status: 400 },
      );
    }

    const result = await runProcessPipeline(formData, {
      apiKey: process.env.OPENAI_API_KEY,
      createPipeline: createOpenAIPipeline,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    // Log the exact error object to the server terminal for debugging.
    console.error("[/api/process] Unhandled pipeline error:", error);

    let message =
      error instanceof Error && error.message
        ? error.message
        : "Unknown error occurred";

    // Never leak the credential into a response, even in an unexpected error
    // (Property 9).
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      message = message.split(apiKey).join("[REDACTED]");
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
