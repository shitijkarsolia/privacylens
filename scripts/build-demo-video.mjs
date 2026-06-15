#!/usr/bin/env node
// Builds the PrivacyLens demo video.
//
// Hybrid pipeline (reliable on CPU-only machines):
//   • HyperFrames renders all MOTION GRAPHICS — title/section/outro cards and
//     animated lower-third caption overlays (video-free → fast & deterministic).
//     Overlays render as ProRes-4444 MOV with alpha.
//   • ffmpeg composites the real product screen-recordings under those overlays
//     and concatenates everything with crossfades.
//
// Phases (skip with SKIP_PRE / SKIP_GFX / SKIP_COMP env vars):
//   0. pre-process raw clips            -> hyperframes/assets/clips/<id>.mp4
//   1. generate HyperFrames comps       -> hyperframes/compositions/*.html
//   2. render comps (cards + overlays)  -> demo-video/renders/*.{mp4,mov}
//   3. composite + concat (ffmpeg)      -> demo-video/privacylens-demo.mp4

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clipsSrc = resolve(root, "demo-video/clips");
const project = resolve(root, "demo-video/hyperframes");
const comps = resolve(project, "compositions");
const assetsClips = resolve(project, "assets/clips");
const renders = resolve(root, "demo-video/renders");
const segments = resolve(root, "demo-video/segments");
const finalOut = resolve(root, "demo-video/privacylens-demo.mp4");
for (const d of [comps, assetsClips, renders, segments]) mkdirSync(d, { recursive: true });

const W = 1920, H = 1080, FPS = 30, XF = 0.4; // crossfade seconds
const TEAL = "#079B8E", TEAL_DARK = "#05655C", INK = "#0E1B22", CREAM = "#FDFCFB";
const HF = "hyperframes@0.6.98";

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"], ...opts });
const probe = (f) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration", "-of", "default=nokey=1:noprint_wrappers=1", f], { encoding: "utf8" }).trim()
  );
const round = (n) => Math.round(n * 1000) / 1000;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------- scene model
const scenes = [
  { kind: "card", id: "intro", dur: 3.6, variant: "intro" },
  { kind: "video", id: "landing", src: "01-landing.webm", in: 0.4, out: 6.9, speed: 1.0,
    captions: [{ text: "A privacy-first layer for any AI chat", from: 0.7, to: 6.0, kicker: "Web demo" }] },
  { kind: "video", id: "text", src: "02-text-flow.webm", in: 1.4, out: 19.0, speed: 1.0,
    captions: [
      { text: "Detection runs locally — as you type", from: 1.0, to: 8.6, kicker: "Real-time" },
      { text: "Personal data found → the send is hard-blocked", from: 9.0, to: 14.6, kicker: "Ethics gate", tone: "alert" },
      { text: "Pick what to redact, then send safely", from: 14.9, to: 17.4, kicker: "Your call" },
    ] },
  { kind: "video", id: "file", src: "03-file-flow.webm", in: 3.0, out: 24.8, speed: 1.2,
    captions: [
      { text: "Drop in a PDF, resume, or screenshot", from: 0.4, to: 4.2, kicker: "Files too" },
      { text: "Compare the safe copy with the original", from: 4.5, to: 9.9, kicker: "Before / after" },
      { text: "Attach the redacted copy — never the original", from: 10.2, to: 17.4, kicker: "Safe by default" },
    ] },
  { kind: "card", id: "section", dur: 3.0, variant: "section",
    title: "Use it in your real AI chats",
    subtitle: "A Chrome extension guards ChatGPT, Claude, Gemini, Perplexity & Copilot" },
  { kind: "video", id: "ext", src: "04-extension-page.webm", in: 1.0, out: 18.4, speed: 1.15,
    captions: [
      { text: "PrivacyLens watches the composer on every supported site", from: 0.4, to: 4.6, kicker: "Extension" },
      { text: "Sensitive text → the send is paused on the page", from: 4.9, to: 10.8, kicker: "Blocked", tone: "alert" },
      { text: "Redacted inline, then sent", from: 11.1, to: 14.6, kicker: "Done" },
    ] },
  { kind: "panel", id: "panel", src: "05-extension-panel.webm", in: 0.2, out: 5.0, speed: 1.0,
    caption: { text: "Review & redact in the side panel", kicker: "Side panel",
      sub: "Mask, keep, or redact each item — then send the safe version." } },
  { kind: "card", id: "outro", dur: 5.6, variant: "outro" },
];

// Panel video placement within the 1920x1080 frame
const PANEL = { x: 1170, y: 70, w: 470, h: 940, r: 34 };

// ------------------------------------------------------- 0. preprocess clips
function preprocess(s) {
  const srcPath = resolve(clipsSrc, s.src);
  if (!existsSync(srcPath)) throw new Error(`Missing ${srcPath} (run scripts/record-demo.mjs)`);
  const out = resolve(assetsClips, `${s.id}.mp4`);
  const speed = s.speed || 1;
  const vf =
    s.kind === "panel"
      ? `setpts=PTS/${speed},scale=${PANEL.w}:${PANEL.h}:force_original_aspect_ratio=increase,crop=${PANEL.w}:${PANEL.h}:0:0,fps=${FPS},format=yuv420p`
      : `setpts=PTS/${speed},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${CREAM},fps=${FPS},format=yuv420p`;
  sh("ffmpeg", ["-y", "-ss", String(s.in), "-i", srcPath, "-t", String(s.out - s.in), "-an",
    "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  s.clipFile = out;
  s.clipDur = probe(out);
  console.log(`  clip ${s.id}: ${s.clipDur.toFixed(2)}s`);
}

if (!process.env.SKIP_PRE) {
  console.log("Phase 0: pre-processing clips...");
  for (const s of scenes) if (s.kind === "video" || s.kind === "panel") preprocess(s);
} else {
  for (const s of scenes) if (s.kind === "video" || s.kind === "panel") {
    s.clipFile = resolve(assetsClips, `${s.id}.mp4`);
    s.clipDur = probe(s.clipFile);
  }
}
for (const s of scenes) if (s.kind === "card") s.clipDur = s.dur;

// ------------------------------------------------------- shared comp styling
const STYLE = `
  @font-face{font-family:"Geist";font-weight:400;src:url("../assets/fonts/geist-sans-latin-400-normal.woff2") format("woff2")}
  @font-face{font-family:"Geist";font-weight:500;src:url("../assets/fonts/geist-sans-latin-500-normal.woff2") format("woff2")}
  @font-face{font-family:"Geist";font-weight:600;src:url("../assets/fonts/geist-sans-latin-600-normal.woff2") format("woff2")}
  @font-face{font-family:"Geist";font-weight:700;src:url("../assets/fonts/geist-sans-latin-700-normal.woff2") format("woff2")}
  @font-face{font-family:"Geist";font-weight:800;src:url("../assets/fonts/geist-sans-latin-800-normal.woff2") format("woff2")}
  @font-face{font-family:"Geist Mono";font-weight:500;src:url("../assets/fonts/geist-mono-latin-500-normal.woff2") format("woff2")}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{font-family:"Geist",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .clip{position:absolute;top:0;left:0}
  .bg-glow{position:absolute;inset:0;background:
    radial-gradient(640px 380px at 22% 80%,rgba(7,155,142,0.30),transparent 60%),
    radial-gradient(520px 320px at 82% 16%,rgba(7,155,142,0.18),transparent 60%);}
  .brand-lockup{display:flex;align-items:center;justify-content:center;gap:22px;color:#fff}
  .brand-lockup.small{gap:16px}
  .shield{color:${TEAL};display:grid;place-items:center;background:rgba(7,155,142,0.12);
    border:2px solid rgba(7,155,142,0.5);border-radius:22px;padding:18px}
  .brand-lockup.small .shield{border-radius:14px;padding:11px}
  .wordmark{font-size:76px;font-weight:800;letter-spacing:-0.03em}
  .brand-lockup.small .wordmark{font-size:50px}
  /* caption pill (top:auto so .clip's top:0 doesn't stretch it vertically) */
  .caption{left:96px;bottom:90px;top:auto;width:max-content;max-width:1240px;display:flex;flex-direction:column;gap:14px;
    padding:24px 32px;border-radius:22px;background:rgba(14,27,34,0.82);
    box-shadow:0 24px 60px rgba(0,0,0,0.34);border:1px solid rgba(255,255,255,0.08)}
  .caption.alert{background:rgba(120,26,14,0.86);border-color:rgba(255,170,150,0.20)}
  .cap-kicker{align-self:flex-start;font-family:"Geist Mono",monospace;font-weight:500;font-size:19px;
    letter-spacing:0.16em;text-transform:uppercase;color:${TEAL};padding:5px 12px;border-radius:999px;
    background:rgba(7,155,142,0.14);border:1px solid rgba(7,155,142,0.34)}
  .caption.alert .cap-kicker{color:#FF9B85;background:rgba(255,120,90,0.16);border-color:rgba(255,120,90,0.4)}
  .cap-text{color:#fff;font-weight:600;font-size:47px;line-height:1.16;letter-spacing:-0.01em}
  /* brand chip (continuity) — left:auto so .clip's left:0 doesn't stretch it */
  .chip{right:60px;left:auto;top:54px;display:flex;align-items:center;gap:12px;color:#fff;
    padding:14px 22px;border-radius:999px;background:rgba(14,27,34,0.72);border:1px solid rgba(255,255,255,0.10);
    font-weight:700;font-size:28px;box-shadow:0 12px 30px rgba(0,0,0,0.25)}
  .chip .shield{padding:7px;border-radius:10px}
`;

function shield(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
}

function compDoc(id, dur, bg, bodyHtml, tlBody) {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=${W}, height=${H}"/>
<script src="../assets/gsap.min.js"></script>
<style>${STYLE} html,body{background:${bg}}</style></head>
<body><div id="root" data-composition-id="${id}" data-start="0" data-duration="${round(dur)}" data-width="${W}" data-height="${H}">
${bodyHtml}
</div>
<script>
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
${tlBody}
window.__timelines["${id}"]=tl;
</script></body></html>`;
}

// ------------------------------------------------------- 1. generate comps
function genCard(s) {
  const dur = s.clipDur;
  let inner = "", tl = "";
  if (s.variant === "intro") {
    inner = `<div class="bg-glow"></div>
      <div class="clip" data-start="0" data-duration="${round(dur)}" data-track-index="0" style="display:grid;place-items:center;width:${W}px;height:${H}px;color:#fff;text-align:center">
        <div>
          <div class="brand-lockup"><div class="shield">${shield(64)}</div><div class="wordmark">PrivacyLens</div></div>
          <div class="intro-tag" style="margin-top:46px;font-size:60px;font-weight:700;letter-spacing:-0.02em">See what AI sees — <em style="color:${TEAL};font-style:italic">before</em> AI sees it</div>
          <div class="intro-sub" style="margin-top:26px;font-size:30px;color:rgba(255,255,255,0.66);font-family:'Geist Mono',monospace">On-device personal-data detection for every AI chat</div>
        </div>
      </div>`;
    tl = `tl.from(".shield",{scale:0.6,opacity:0,duration:0.7,ease:"back.out(1.7)"},0.15);
tl.from(".wordmark",{y:24,opacity:0,duration:0.6,ease:"power3.out"},0.4);
tl.from(".intro-tag",{y:24,opacity:0,duration:0.6,ease:"power3.out"},0.7);
tl.from(".intro-sub",{y:18,opacity:0,duration:0.6,ease:"power3.out"},1.0);
tl.to("#root",{opacity:1,duration:0.01},${round(dur - XF)});tl.to("#root",{opacity:0,duration:${XF},ease:"power1.in"},${round(dur - XF)});`;
    return compDoc(`card-${s.id}`, dur, `radial-gradient(1200px 700px at 50% 28%, ${TEAL_DARK} 0%, ${INK} 60%, #060d11 100%)`, inner, tl);
  }
  if (s.variant === "section") {
    const pills = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot"].map((n) => `<span class="logo-pill" style="font-size:26px;font-weight:600;color:#fff;padding:12px 24px;border-radius:14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14)">${n}</span>`).join("");
    inner = `<div class="bg-glow"></div>
      <div class="clip" data-start="0" data-duration="${round(dur)}" data-track-index="0" style="display:grid;place-items:center;width:${W}px;height:${H}px;color:#fff;text-align:center">
        <div>
          <div class="section-chip" style="display:inline-flex;align-items:center;gap:10px;color:${TEAL};font-family:'Geist Mono',monospace;font-size:22px;letter-spacing:0.12em;text-transform:uppercase;padding:10px 18px;border-radius:999px;background:rgba(7,155,142,0.12);border:1px solid rgba(7,155,142,0.4)">${shield(22)} PrivacyLens Extension</div>
          <div class="section-title" style="margin-top:30px;font-size:72px;font-weight:800;letter-spacing:-0.03em">${esc(s.title)}</div>
          <div class="section-sub" style="margin-top:22px;font-size:28px;color:rgba(255,255,255,0.7);max-width:1200px;margin-left:auto;margin-right:auto;line-height:1.4">${esc(s.subtitle)}</div>
          <div class="logo-row" style="margin-top:44px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap">${pills}</div>
        </div>
      </div>`;
    tl = `tl.from(".section-chip",{y:18,opacity:0,duration:0.5,ease:"power3.out"},0.15);
tl.from(".section-title",{y:26,opacity:0,duration:0.6,ease:"power3.out"},0.35);
tl.from(".section-sub",{y:18,opacity:0,duration:0.5,ease:"power3.out"},0.6);
tl.from(".logo-pill",{y:16,opacity:0,duration:0.5,stagger:0.07,ease:"power3.out"},0.8);
tl.to("#root",{opacity:0,duration:${XF},ease:"power1.in"},${round(dur - XF)});`;
    return compDoc(`card-${s.id}`, dur, `linear-gradient(160deg, ${INK} 0%, #0a151b 100%)`, inner, tl);
  }
  // outro
  inner = `<div class="bg-glow"></div>
    <div class="clip" data-start="0" data-duration="${round(dur)}" data-track-index="0" style="display:grid;place-items:center;width:${W}px;height:${H}px;color:#fff;text-align:center">
      <div>
        <div class="brand-lockup small"><div class="shield">${shield(44)}</div><div class="wordmark">PrivacyLens</div></div>
        <div class="outro-line" style="margin-top:48px;font-size:58px;font-weight:700;line-height:1.22;letter-spacing:-0.02em">Your data never leaves your device<br/>until <em style="color:${TEAL};font-style:italic">you</em> approve it.</div>
        <div class="outro-cta" style="margin-top:46px;display:flex;gap:20px;justify-content:center">
          <span class="cta" style="font-size:30px;font-weight:700;padding:20px 38px;border-radius:16px;background:${TEAL};color:#fff;box-shadow:0 18px 40px rgba(7,155,142,0.4)">Try the live demo</span>
          <span class="cta" style="font-size:30px;font-weight:700;padding:20px 38px;border-radius:16px;color:#fff;border:2px solid rgba(255,255,255,0.3)">Get the Chrome extension</span>
        </div>
        <div class="outro-foot" style="margin-top:40px;font-family:'Geist Mono',monospace;font-size:24px;color:rgba(255,255,255,0.5);letter-spacing:0.04em">Runs on-device · openai/privacy-filter · No telemetry</div>
      </div>
    </div>`;
  tl = `tl.from(".brand-lockup",{y:20,opacity:0,duration:0.6,ease:"power3.out"},0.2);
tl.from(".outro-line",{y:24,opacity:0,duration:0.6,ease:"power3.out"},0.5);
tl.from(".cta",{y:18,opacity:0,duration:0.5,stagger:0.12,ease:"power3.out"},0.9);
tl.from(".outro-foot",{opacity:0,duration:0.6,ease:"power1.out"},1.3);`;
  return compDoc(`card-${s.id}`, dur, `radial-gradient(1200px 700px at 50% 32%, ${TEAL_DARK} 0%, ${INK} 60%, #060d11 100%)`, inner, tl);
}

function genOverlay(s) {
  const dur = s.clipDur;
  const els = [];
  const tl = [];
  // persistent brand chip
  els.push(`<div class="clip chip" data-start="0" data-duration="${round(dur)}" data-track-index="40"><div class="shield">${shield(22)}</div>PrivacyLens</div>`);
  tl.push(`tl.from(".chip",{opacity:0,y:-12,duration:0.5,ease:"power2.out"},0.1);`);
  s.captions.forEach((c, i) => {
    const id = `cap${i}`;
    const start = round(c.from), d = round(c.to - c.from);
    els.push(`<div id="${id}" class="clip caption ${c.tone === "alert" ? "alert" : ""}" data-start="${start}" data-duration="${d}" data-track-index="${10 + i}">
      ${c.kicker ? `<span class="cap-kicker">${esc(c.kicker)}</span>` : ""}<span class="cap-text">${esc(c.text)}</span></div>`);
    tl.push(`tl.fromTo("#${id}",{opacity:0},{opacity:1,duration:0.32,ease:"power1.out"},${start});`);
    tl.push(`tl.from("#${id} .cap-text",{y:18,opacity:0,duration:0.45,ease:"power3.out"},${start});`);
    if (c.kicker) tl.push(`tl.from("#${id} .cap-kicker",{y:10,opacity:0,duration:0.4,ease:"power3.out"},${start});`);
    tl.push(`tl.to("#${id}",{opacity:0,duration:0.32,ease:"power1.in"},${round(start + d - 0.32)});`);
  });
  return compDoc(`ov-${s.id}`, dur, "transparent", els.join("\n"), tl.join("\n"));
}

function genPanelOverlay(s) {
  const dur = s.clipDur;
  const c = s.caption;
  const els = `<div class="clip chip" data-start="0" data-duration="${round(dur)}" data-track-index="40"><div class="shield">${shield(22)}</div>PrivacyLens</div>
    <div id="pc" class="clip" data-start="0" data-duration="${round(dur)}" data-track-index="10" style="left:120px;top:362px;width:760px;display:flex;flex-direction:column;gap:22px;color:#fff">
      <span class="cap-kicker" style="align-self:flex-start">${esc(c.kicker)}</span>
      <span style="font-size:62px;font-weight:800;letter-spacing:-0.02em;line-height:1.08">${esc(c.text)}</span>
      <span style="font-size:28px;color:rgba(255,255,255,0.7);line-height:1.45">${esc(c.sub)}</span>
    </div>`;
  const tl = `tl.from(".chip",{opacity:0,y:-12,duration:0.5,ease:"power2.out"},0.1);
tl.from("#pc",{x:-50,opacity:0,duration:0.6,ease:"power3.out"},0.2);
tl.to("#pc",{opacity:1,duration:0.01},${round(dur - XF)});`;
  return compDoc(`ov-${s.id}`, dur, "transparent", els, tl);
}

console.log("Phase 1: generating compositions...");
for (const s of scenes) {
  if (s.kind === "card") writeFileSync(resolve(comps, `card-${s.id}.html`), genCard(s));
  else if (s.kind === "video") writeFileSync(resolve(comps, `ov-${s.id}.html`), genOverlay(s));
  else if (s.kind === "panel") {
    writeFileSync(resolve(comps, `ov-${s.id}.html`), genPanelOverlay(s));
    // opaque panel background card
    const bg = `<div class="bg-glow"></div>`;
    writeFileSync(resolve(comps, `panel-bg.html`),
      compDoc("panel-bg", s.clipDur, `linear-gradient(160deg, ${INK} 0%, #0a151b 100%)`, bg, ""));
  }
}

// rounded-corner alpha mask + soft shadow for the panel video
function genPanelMasks() {
  const mask = createCanvas(PANEL.w, PANEL.h);
  const m = mask.getContext("2d");
  m.fillStyle = "#000"; m.fillRect(0, 0, PANEL.w, PANEL.h);
  roundRect(m, 0, 0, PANEL.w, PANEL.h, PANEL.r); m.fillStyle = "#fff"; m.fill();
  writeFileSync(resolve(renders, "panel-mask.png"), mask.toBuffer("image/png"));

  const shadow = createCanvas(W, H);
  const sx = shadow.getContext("2d");
  sx.shadowColor = "rgba(0,0,0,0.55)"; sx.shadowBlur = 70; sx.shadowOffsetY = 30;
  roundRect(sx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, PANEL.r); sx.fillStyle = "rgba(0,0,0,0.9)"; sx.fill();
  // border ring
  sx.shadowColor = "transparent";
  roundRect(sx, PANEL.x - 1, PANEL.y - 1, PANEL.w + 2, PANEL.h + 2, PANEL.r + 1);
  sx.lineWidth = 2; sx.strokeStyle = "rgba(255,255,255,0.14)"; sx.stroke();
  writeFileSync(resolve(renders, "panel-shadow.png"), shadow.toBuffer("image/png"));
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
genPanelMasks();

// ------------------------------------------------------- 2. render comps
function render(compFile, outFile, format) {
  const args = ["-y", HF, "render", "-c", `compositions/${compFile}`, "-f", String(FPS),
    "-q", "high", "--low-memory-mode", "--format", format, "-o", outFile];
  execFileSync("npx", args, { cwd: project, stdio: ["ignore", "ignore", "inherit"] });
}

if (!process.env.SKIP_GFX) {
  console.log("Phase 2: rendering motion graphics (HyperFrames)...");
  for (const s of scenes) {
    if (s.kind === "card") {
      render(`card-${s.id}.html`, resolve(renders, `card-${s.id}.mp4`), "mp4");
      console.log(`  rendered card-${s.id}.mp4`);
    } else if (s.kind === "video") {
      render(`ov-${s.id}.html`, resolve(renders, `ov-${s.id}.mov`), "mov");
      console.log(`  rendered ov-${s.id}.mov`);
    } else if (s.kind === "panel") {
      render(`ov-${s.id}.html`, resolve(renders, `ov-${s.id}.mov`), "mov");
      render(`panel-bg.html`, resolve(renders, `panel-bg.mp4`), "mp4");
      console.log(`  rendered ov-${s.id}.mov + panel-bg.mp4`);
    }
  }
}

// ------------------------------------------------------- 3. composite + concat
console.log("Phase 3: compositing segments + concat (ffmpeg)...");
const orderedSegments = [];

for (const s of scenes) {
  const seg = resolve(segments, `seg-${s.id}.mp4`);
  if (s.kind === "card") {
    // already a finished mp4
    orderedSegments.push({ id: s.id, file: resolve(renders, `card-${s.id}.mp4`) });
    continue;
  }
  if (s.kind === "video") {
    const ov = resolve(renders, `ov-${s.id}.mov`);
    sh("ffmpeg", ["-y", "-i", s.clipFile, "-i", ov,
      "-filter_complex", `[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
      "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), seg]);
    orderedSegments.push({ id: s.id, file: seg });
    continue;
  }
  if (s.kind === "panel") {
    const bg = resolve(renders, `panel-bg.mp4`);
    const ov = resolve(renders, `ov-${s.id}.mov`);
    const mask = resolve(renders, "panel-mask.png");
    const shadow = resolve(renders, "panel-shadow.png");
    // bg <- shadow <- rounded video <- caption overlay
    sh("ffmpeg", ["-y", "-i", bg, "-i", shadow, "-i", s.clipFile, "-i", mask, "-i", ov,
      "-filter_complex",
      `[0:v][1:v]overlay=0:0[b1];` +
      `[2:v][3:v]alphamerge[pv];` +
      `[b1][pv]overlay=${PANEL.x}:${PANEL.y}[b2];` +
      `[b2][4:v]overlay=0:0,format=yuv420p[v]`,
      "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(FPS), "-t", String(round(s.clipDur)), seg]);
    orderedSegments.push({ id: s.id, file: seg });
    continue;
  }
}

// xfade chain
const durs = orderedSegments.map((s) => probe(s.file));
const inputs = orderedSegments.flatMap((s) => ["-i", s.file]);
let filter = "";
let prev = "0:v";
let acc = durs[0];
for (let i = 1; i < orderedSegments.length; i++) {
  const off = round(acc - XF);
  const out = i === orderedSegments.length - 1 ? "vout" : `x${i}`;
  filter += `[${prev}][${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}[${out}];`;
  prev = out;
  acc = round(acc + durs[i] - XF);
}
filter = filter.replace(/;$/, "");

console.log(`  final duration ~${acc.toFixed(1)}s`);
sh("ffmpeg", ["-y", ...inputs, "-filter_complex", filter, "-map", "[vout]",
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", finalOut]);

console.log(`\nDone -> ${finalOut}`);
console.log(`Duration: ${probe(finalOut).toFixed(1)}s`);
