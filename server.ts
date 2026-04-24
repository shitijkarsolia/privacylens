import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const client = new Anthropic();

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
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
    res.json({ content });
  } catch (err: any) {
    console.error("Claude API error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

const distPath = join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PrivacyLens API server running on port ${PORT}`);
});
