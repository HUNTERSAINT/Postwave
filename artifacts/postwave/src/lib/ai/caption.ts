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

export async function generateCaption(input: CaptionRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "The AI assistant is not set up yet. Please contact support.");
  }
  const { system, user } = buildPrompt(input);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
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
  } catch {
    throw new HttpError(503, "The AI assistant is busy right now. Please try again.");
  }
  if (!response.ok) {
    logger.warn({ aiStatus: response.status }, "AI caption request was rejected");
    throw new HttpError(503, "The AI assistant is unavailable right now. Please try again.");
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).map((part) => part.text ?? "").join("");
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
