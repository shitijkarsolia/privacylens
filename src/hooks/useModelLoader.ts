import { useState, useCallback, useEffect } from "react";
import type { ModelStatus, PIIEntity, PIICategory } from "../types";

const MODEL_ID = "Qwen3-4B-q4f16_1-MLC";

const SYSTEM_PROMPT = `You are a PII (Personally Identifiable Information) detection engine. Given text, identify ALL PII entities and return them as a JSON array.

Each entity must have:
- "type": one of "private_person", "private_email", "private_phone", "private_address", "private_date", "private_url", "account_number", "secret"
- "text": the exact text from the input that contains PII

Rules:
- Return ONLY a JSON array, no other text
- If no PII found, return []
- Be thorough — catch names, emails, phones, addresses, SSNs, credit cards, dates of birth, account numbers, API keys
- SSNs and credit card numbers are "account_number"
- API keys, passwords, tokens are "secret"

Example input: "Contact John Smith at john@test.com or 555-123-4567"
Example output: [{"type":"private_person","text":"John Smith"},{"type":"private_email","text":"john@test.com"},{"type":"private_phone","text":"555-123-4567"}]`;

export function useModelLoader() {
  const [status, setStatus] = useState<ModelStatus>({ state: "idle" });
  const [classifyFn, setClassifyFn] = useState<
    ((text: string) => Promise<PIIEntity[]>) | null
  >(null);

  const loadModel = useCallback(async () => {
    setStatus({ state: "downloading", progress: 0 });

    try {
      const webllm = await import("@mlc-ai/web-llm");

      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress?: number; text?: string }) => {
          const progress = report.progress !== undefined ? Math.round(report.progress * 100) : 0;
          setStatus({ state: "downloading", progress });
        },
      });

      setStatus({ state: "loading", progress: 100 });

      const fn = async (text: string): Promise<PIIEntity[]> => {
        await engine.resetChat(true);

        const chunks = chunkText(text, 1500, 200);
        const allEntities: PIIEntity[] = [];

        for (const chunk of chunks) {
          try {
            const response = await engine.chat.completions.create({
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: chunk.text },
              ],
              temperature: 0,
              max_tokens: 1024,
            });

            const content = response.choices[0]?.message?.content || "";
            const entities = parseModelResponse(content, chunk.text, chunk.offset);
            allEntities.push(...entities);

            await engine.resetChat(true);
          } catch (e) {
            console.error("Chunk inference error:", e);
          }
        }

        return deduplicateEntities(allEntities);
      };

      setClassifyFn(() => fn);
      setStatus({ state: "ready" });
    } catch (err: any) {
      console.error("Model load failed:", err);
      setStatus({
        state: "failed",
        error: err?.message || "Failed to load model",
      });
    }
  }, []);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  return { status, classifyFn, loadModel };
}

function chunkText(
  text: string,
  maxLen: number,
  overlap: number
): { text: string; offset: number }[] {
  if (text.length <= maxLen) return [{ text, offset: 0 }];

  const chunks: { text: string; offset: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push({ text: text.slice(start, end), offset: start });
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

function parseModelResponse(
  content: string,
  chunkText: string,
  offset: number
): PIIEntity[] {
  try {
    // Strip think blocks from Qwen3
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Strip markdown code fences
    cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Fix trailing commas
    cleaned = cleaned.replace(/,\s*]/g, "]");

    // Find JSON array
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];

    const entities: PIIEntity[] = [];

    for (const item of arr) {
      if (!item.type || !item.text) continue;

      const category = mapCategory(item.type);
      const entityText = item.text.trim();
      if (!entityText) continue;

      // Find position in chunk
      const idx = chunkText.indexOf(entityText);
      const start = idx !== -1 ? offset + idx : offset;
      const end = start + entityText.length;

      entities.push({
        category,
        text: entityText,
        start,
        end,
        confidence: 0.95,
        source: "model",
      });
    }

    return entities;
  } catch (e) {
    console.error("Failed to parse model response:", content, e);
    return [];
  }
}

function mapCategory(type: string): PIICategory {
  const t = type.toLowerCase();
  if (t.includes("person") || t.includes("name")) return "private_person";
  if (t.includes("email")) return "private_email";
  if (t.includes("phone")) return "private_phone";
  if (t.includes("address")) return "private_address";
  if (t.includes("date")) return "private_date";
  if (t.includes("url")) return "private_url";
  if (t.includes("account") || t.includes("ssn") || t.includes("credit")) return "account_number";
  if (t.includes("secret") || t.includes("key") || t.includes("password")) return "secret";
  return "secret";
}

function deduplicateEntities(entities: PIIEntity[]): PIIEntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    const key = `${e.start}-${e.end}-${e.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
