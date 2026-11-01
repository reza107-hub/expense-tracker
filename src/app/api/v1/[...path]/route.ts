import { getDb } from "@/db";
import { createGeminiClient } from "@/lib/advice/gemini";
import { handleApi } from "@/lib/api/routes";
import { getAuth } from "@/lib/auth/instance";

/**
 * JSON API for the mobile app. All logic lives in src/lib/api so tests can run it
 * against an in-memory database. Reading the request headers first keeps this route
 * dynamic, so the build never tries to prerender it.
 */
async function handle(request: Request): Promise<Response> {
  const headers = request.headers;
  void headers;
  return handleApi(request, {
    get db() {
      return getDb();
    },
    getAuth,
    adviceClient: createGeminiClient,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
