import { z } from "zod";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";
import { generateCaption } from "@/lib/ai/caption";

const schema = z.object({
  mode: z.enum(["write", "shorter", "longer", "hashtags"]),
  idea: z.string().trim().min(3, "Tell me a little about the post first.").max(2000),
  current: z.string().trim().max(5000).optional(),
  tone: z.enum(["casual", "friendly", "professional", "bold", "funny"]).default("friendly"),
  platforms: z.array(z.string().max(32)).max(15).default([]),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const dailyLimit = user.plan === "free" ? 10 : 100;
    await enforceRateLimit(request, "ai-caption-minute", 6, 60, user.id);
    await enforceRateLimit(request, "ai-caption-day", dailyLimit, 24 * 60 * 60, user.id);
    const input = await parseJson(request, schema);
    if ((input.mode === "shorter" || input.mode === "longer") && !input.current) {
      return jsonResponse({ message: "Write or generate a caption first." }, 400);
    }
    const result = await generateCaption({
      mode: input.mode,
      idea: input.idea,
      current: input.current,
      tone: input.tone ?? "friendly",
      platforms: input.platforms ?? [],
    });
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
