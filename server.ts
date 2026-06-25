import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { generateDemoReply } from "./src/lib/demo-assistant";
import { toEntities } from "./src/lib/model-entities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Without a key the server still runs: chat uses the local demo assistant
// (clearly labeled in the UI) and PII scanning is unaffected.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
if (!client) {
  console.warn(
    "ANTHROPIC_API_KEY not set - /api/chat will answer with the built-in demo assistant."
  );
}

// --- PII Detection Model (loaded once at startup) ---
let classifier: any = null;
let modelReady = false;
let modelError: string | null = null;

async function loadPIIModel() {
  try {
    console.log("Loading openai/privacy-filter model...");
    const { pipeline, env } = await import("@huggingface/transformers");
    env.backends.onnx.wasm.numThreads = 4;

    classifier = await pipeline("token-classification", "openai/privacy-filter", {
      dtype: "q4",
      device: "cpu",
    });

    modelReady = true;
    console.log("PII model loaded and ready.");
  } catch (err: any) {
    modelError = err?.message || "Failed to load model";
    console.error("PII model load failed:", modelError);
  }
}

loadPIIModel();

// --- PII Scan Endpoint ---
app.get("/api/model-status", (_req, res) => {
  if (modelReady) {
    res.json({ state: "ready" });
  } else if (modelError) {
    res.json({ state: "failed", error: modelError });
  } else {
    res.json({ state: "loading" });
  }
});

app.post("/api/scan", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text string required" });
      return;
    }

    if (!modelReady || !classifier) {
      res.status(503).json({ error: "Model not ready yet" });
      return;
    }

    const results = await classifier(text, { aggregation_strategy: "simple" });
    const entities = toEntities(results as any[], text);

    res.json({ entities });
  } catch (err: any) {
    console.error("Scan error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Scan failed" });
  }
});

// --- Chat Endpoint ---
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    if (!client) {
      res.json({ content: generateDemoReply(messages), via: "demo" });
      return;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are a helpful assistant. The user may send messages with redacted personal information (shown as [NAME], [EMAIL], [PHONE], etc.). Respond helpfully while respecting that the user has chosen to protect their privacy. Never ask for the redacted information.",
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    const content = textBlock && "text" in textBlock ? textBlock.text : "";
    res.json({ content, via: "claude" });
  } catch (err: any) {
    console.error("Claude API error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

// --- Static Files ---
const distPath = join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`PrivacyLens API server running on port ${PORT}`);
});
