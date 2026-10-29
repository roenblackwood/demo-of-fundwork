import "server-only";

import { connection } from "next/server";
import { acceptGuideRewrite, type StarterGuide, type WorkerGuide } from "@/lib/ai";

type Guide = StarterGuide | WorkerGuide;

const memory = new Map<string, Guide>();

const VOICE = [
  "You rewrite a Fundwork guide.",
  "Return the same JSON shape.",
  "You may change only summary, why, standOut, and draftMessage.",
  "Keep every other field exactly, including names, amounts, and order.",
  "Use short sentences.",
  "Do not use an em dash or an en dash.",
  "Do not add facts, offices, checks, steps, skills, prices, times, or digits.",
  "Do not give legal or investment advice.",
  "Do not say capital is verified.",
  "Do not say shares or stock.",
].join(" ");

function secret(name: string): string {
  const env = process.env;
  const value = env[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Rewrite prose when both server env vars are set. Otherwise return the template. */
export async function rewriteGuide<T extends Guide>(key: string, template: T): Promise<T> {
  await connection();
  const saved = memory.get(key);
  if (saved) return saved as T;
  const apiKey = secret("XAI_API_KEY");
  const model = secret("FUNDWORK_AI_MODEL");
  if (!apiKey || !model) return template;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VOICE },
          { role: "user", content: JSON.stringify(template) },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return template;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") return template;
    const accepted = acceptGuideRewrite(template, JSON.parse(content) as unknown);
    const result = (accepted ?? template) as T;
    memory.set(key, result);
    return result;
  } catch {
    return template;
  }
}
