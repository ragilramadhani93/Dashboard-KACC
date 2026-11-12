/**
 * Minimal Google Gemini REST client for KACC AI insights (zero external SDK deps).
 * Reads GEMINI_API_KEY (or fallback GOOGLE_API_KEY) and optional GEMINI_MODEL.
 */

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined;
}

function repairJson(s: string): string {
  let repaired = s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/,\s*([\]}])/g, "$1");

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;

  if (quoteCount % 2 !== 0) repaired += '"';
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
  return repaired;
}

export function extractJsonObject<T extends Record<string, unknown>>(
  raw: string,
  truncated = false,
): T {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (trimmed) candidates.push(trimmed);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    candidates.push(jsonMatch[0], repairJson(jsonMatch[0]));
  }
  if (raw.includes("{")) {
    candidates.push(repairJson(raw.slice(raw.indexOf("{"))));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // Try next repair candidate
    }
  }

  const fallbackText = truncated
    ? `${raw}\n\n[Catatan: output AI terpotong karena limit token. Data item tetap tersedia di tabel di bawah.]`
    : raw;
  return { narrative: fallbackText } as unknown as T;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

export async function generateGeminiJson<T extends Record<string, unknown>>({
  systemPrompt,
  userPrompt,
  temperature = 0.4,
  maxOutputTokens = 2048,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<{ parsed: T; raw: string; truncated: boolean }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum disetel. Tambahkan GEMINI_API_KEY di environment variables Vercel atau .env.",
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const payload = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (!res.ok) {
    const detail = payload?.error?.message || res.statusText || "Request gagal";
    throw new Error(`Gemini API HTTP ${res.status}: ${detail}`);
  }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const raw = parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const truncated = candidate?.finishReason === "MAX_TOKENS";

  return {
    parsed: extractJsonObject<T>(raw, truncated),
    raw,
    truncated,
  };
}
