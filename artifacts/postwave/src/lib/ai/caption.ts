import { HttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { platformCharacterLimit } from "@/lib/social/platform-limits";

export type CaptionMode = "write" | "shorter" | "longer" | "hashtags";
export type CaptionTone = "casual" | "friendly" | "professional" | "bold" | "funny";

export type CaptionRequest = {
  mode: CaptionMode;
  idea: string;
  current?: string;
  tone: CaptionTone;
  platforms: string[];
};

const HASHTAG_COUNTS: Record<string, string> = {
  instagram: "5 to 10",
  tiktok: "3 to 6",
  facebook: "2 to 3",
  linkedin: "3 to 5",
  twitter: "1 to 2",
  threads: "1 to 3",
  youtube: "3 to 5",
  pinterest: "3 to 6",
  bluesky: "1 to 3",
};

const STYLE_RULES = `You write social media captions that read like a real person typed them, not like an AI.

Voice rules:
- Sound like a specific person talking to people they know. Use contractions. Vary sentence length. Short sentences are fine. Fragments are fine.
- Be concrete. Use the details the user gave you. Never invent facts, numbers, prices, quotes, testimonials, results, locations or offers that were not in the user's text.
- Avoid the usual AI giveaways: em dashes, "Unlock", "Elevate", "Discover", "game-changer", "dive into", "in today's fast-paced world", "whether you're X or Y", "Let's", "Ready to...?", "Say goodbye to", tidy lists of three, and stacked rhetorical questions.
- No emoji walls. Use at most one or two emoji, and only if the tone suits it. None is often better.
- No hype words like "amazing", "incredible", "stunning" unless the user used them.
- Do not start with a greeting like "Hey everyone" or "Attention".
- No hashtags inside the caption body unless the user asks for them.
- Plain text only. No markdown, no asterisks, no headings.
- Match the language the user wrote in.`;

function lengthGuidance(mode: CaptionMode, limit: number | undefined) {
  const cap = limit ? ` Never exceed ${limit} characters in total.` : "";
  if (mode === "shorter") return `Make it clearly shorter, about half the current length, keeping the main point and the voice.${cap}`;
  if (mode === "longer") return `Make it longer and richer, roughly 1.5 to 2 times the current length, by adding useful detail the user already gave. Do not pad.${cap}`;
  return `Aim for a natural length for the platform, usually 1 to 4 short lines.${cap}`;
}

function buildPrompt(input: CaptionRequest) {
  const platforms = input.platforms.length ? input.platforms.join(", ") : "general social media";
  const limits = input.platforms
    .map((platform) => platformCharacterLimit(platform))
    .filter((value): value is number => typeof value === "number");
  const tightest = limits.length ? Math.min(...limits) : undefined;
  const hashtagTarget = input.platforms.length
    ? input.platforms.map((platform) => HASHTAG_COUNTS[platform]).filter(Boolean)[0] ?? "3 to 5"
    : "3 to 5";

  if (input.mode === "hashtags") {
    return {
      system: `${STYLE_RULES}\n\nYou are suggesting hashtags only.`,
      user: `Post text:\n"""${input.current || input.idea}"""\n\nPlatforms: ${platforms}\nTone: ${input.tone}\n\nSuggest ${hashtagTarget} hashtags that fit this post. Mix a few widely used tags with a few specific, niche ones. Only tags that genuinely relate to the post. No banned, spammy or misleading tags. Return JSON only: {"hashtags":["#tag1","#tag2"]}`,
    };
  }

  const base =
    input.mode === "write"
      ? `Write one caption.\n\nWhat the post is about / rough draft:\n"""${input.idea}"""`
      : `Rewrite this caption.\n\nCurrent caption:\n"""${input.current}"""\n\nOriginal idea for reference:\n"""${input.idea}"""`;
  return {
    system: STYLE_RULES,
    user: `${base}\n\nPlatforms: ${platforms}\nTone: ${input.tone}\n${lengthGuidance(input.mode, tightest)}\n\nReturn JSON only: {"caption":"..."}`,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanCaption(value: string) {
  return value
    .replace(/—|–/g, ", ")
    .replace(/\*\*?/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

let geminiModelCache: { models: string[]; at: number } | null = null;

async function geminiCandidates(apiKey: string): Promise<string[]> {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  if (geminiModelCache && Date.now() - geminiModelCache.at < 60 * 60 * 1000) {
    return geminiModelCache.models;
  }
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.warn({ aiStatus: response.status }, "Could not list Gemini models");
    throw new HttpError(503, "The AI assistant is unavailable right now. Please try again.");
  }
  const data = (await response.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  const names = (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => (model.name ?? "").replace(/^models\//, ""))
    .filter(
      (name) =>
        /^gemini-[\d.]+-flash(-lite)?(-latest)?$/.test(name) ||
        name === "gemini-flash-latest" ||
        name === "gemini-flash-lite-latest",
    );
  // Prefer stable flash models; newest version first, lite after regular.
  names.sort((a, b) => {
    const rank = (name: string) => (name.includes("lite") ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return b.localeCompare(a, undefined, { numeric: true });
  });
  logger.info({ geminiModels: names.slice(0, 6) }, "Gemini models available");
  if (!names.length) throw new HttpError(503, "The AI assistant is unavailable right now. Please try again.");
  geminiModelCache = { models: names.slice(0, 4), at: Date.now() };
  return geminiModelCache.models;
}

async function callGemini(apiKey: string, system: string, user: string): Promise<Response> {
  const models = await geminiCandidates(apiKey);
  let last: Response | undefined;
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.ok) return response;
    logger.warn({ aiStatus: response.status, aiModel: model }, "Gemini model request failed");
    last = response;
    if (response.status !== 404 && response.status !== 429 && response.status !== 400) break;
  }
  return last as Response;
}

async function callModel(system: string, user: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !anthropicKey) {
    throw new HttpError(503, "The AI assistant is not set up yet. Please contact support.");
  }

  let response: Response;
  try {
    if (geminiKey) {
      response = await callGemini(geminiKey, system, user);
    } else {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: 700,
          temperature: 0.9,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
    }
  } catch (error) {
    logger.warn(
      {
        aiProvider: geminiKey ? "gemini" : "anthropic",
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message.slice(0, 200) : "",
        errorCause: error instanceof Error && error.cause instanceof Error ? error.cause.message.slice(0, 200) : "",
      },
      "AI caption request threw",
    );
    throw new HttpError(503, "The AI assistant is busy right now. Please try again.");
  }
  if (!response.ok) {
    logger.warn(
      { aiStatus: response.status, aiProvider: geminiKey ? "gemini" : "anthropic" },
      "AI caption request was rejected",
    );
    if (response.status === 429) {
      throw new HttpError(429, "The AI assistant is busy right now. Please try again in a minute.");
    }
    throw new HttpError(503, "The AI assistant is unavailable right now. Please try again.");
  }

  if (geminiKey) {
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
  }
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).map((part) => part.text ?? "").join("");
}

export async function generateCaption(input: CaptionRequest) {
  const { system, user } = buildPrompt(input);
  const text = await callModel(system, user);
  const parsed = extractJson(text);

  if (input.mode === "hashtags") {
    const tags = Array.isArray(parsed?.hashtags) ? parsed.hashtags : [];
    const hashtags = tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`).replace(/\s+/g, ""))
      .filter((tag) => /^#[\p{L}\p{N}_]{2,40}$/u.test(tag))
      .slice(0, 12);
    if (!hashtags.length) throw new HttpError(502, "Could not suggest hashtags. Please try again.");
    return { hashtags };
  }

  const caption = typeof parsed?.caption === "string" ? cleanCaption(parsed.caption) : cleanCaption(text);
  if (!caption) throw new HttpError(502, "Could not write a caption. Please try again.");
  return { caption };
}
