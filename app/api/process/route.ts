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
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "A valid multipart form-data request is required.", code: "MISSING_AUDIO" },
      { status: 400 },
    );
  }

  const result = await runProcessPipeline(formData, {
    apiKey: process.env.OPENAI_API_KEY,
    createPipeline: createOpenAIPipeline,
  });

  return NextResponse.json(result.body, { status: result.status });
}
