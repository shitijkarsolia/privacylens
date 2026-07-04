import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { generateChatReply, activeChatProvider } from "./src/lib/chat-providers";
import { toEntities } from "./src/lib/model-entities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Chat provider is resolved from env (Gemini by default, then Claude, then the
// built-in demo assistant). PII scanning is unaffected by chat configuration.
const chatProvider = activeChatProvider();
if (chatProvider === "demo") {
  console.warn(
    "No GEMINI_API_KEY / ANTHROPIC_API_KEY set - /api/chat will answer with the built-in demo assistant."
  );
} else {
  console.log(`/api/chat will use the ${chatProvider} provider.`);
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

    const reply = await generateChatReply(messages);
    res.json(reply);
  } catch (err: any) {
    console.error("Chat error:", err?.message || err);
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
