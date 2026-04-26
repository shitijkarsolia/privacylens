import type { PIIEntity, PIICategory } from "../types";

type Classifier = (text: string, options: Record<string, unknown>) => Promise<any[]>;

let classifierPromise: Promise<Classifier> | null = null;

const CATEGORY_MAP: Array<[string, PIICategory]> = [
  ["person", "private_person"],
  ["email", "private_email"],
  ["phone", "private_phone"],
  ["address", "private_address"],
  ["date", "private_date"],
  ["url", "private_url"],
  ["account", "account_number"],
  ["secret", "secret"],
];

export async function scanWithPrivacyFilter(text: string): Promise<PIIEntity[]> {
  const classifier = await getClassifier();
  const results = await classifier(text, { aggregation_strategy: "simple" });

  return results
    .map((result) => toEntity(result, text))
    .filter((entity): entity is PIIEntity => Boolean(entity))
    .sort((a, b) => a.start - b.start);
}

Object.assign(globalThis, {
  privacyLensModelScanner: {
    scanWithPrivacyFilter,
  },
});

async function getClassifier(): Promise<Classifier> {
  if (!classifierPromise) {
    classifierPromise = loadClassifier();
  }

  return classifierPromise;
}

async function loadClassifier(): Promise<Classifier> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }

  return pipeline("token-classification", "openai/privacy-filter", {
    dtype: "q4",
    device: "cpu",
  }) as Promise<Classifier>;
}

function toEntity(result: any, text: string): PIIEntity | null {
  const entityText = String(result.word || "").trim();
  if (!entityText) return null;

  const group = String(result.entity_group || result.entity || "").toLowerCase();
  const category = CATEGORY_MAP.find(([key]) => group.includes(key))?.[1] || "secret";
  const start = typeof result.start === "number" ? result.start : text.indexOf(entityText);
  if (start < 0) return null;
  const end = typeof result.end === "number" ? result.end : start + entityText.length;

  return {
    category,
    text: text.slice(start, end),
    start,
    end,
    confidence: result.score ?? 0.5,
    source: "model",
  };
}
