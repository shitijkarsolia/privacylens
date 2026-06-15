# PrivacyLens demo video

A ~70s product demo built from **real screen recordings** of the working app and
extension, wrapped in motion-graphics rendered with
[HyperFrames](https://github.com/heygen-com/hyperframes).

## Output

- `privacylens-demo.mp4` — the finished 1080p / 30fps video.

## How it's made (reproducible)

```bash
# 1. Record the product flows (needs the API server on :3001 and a fresh build)
npm run build && npm run server        # in the repo root, separate terminal
node scripts/record-demo.mjs           # -> demo-video/clips/*.webm + timings.json

# 2. Build the video (pre-process clips, render graphics, composite, concat)
node scripts/build-demo-video.mjs      # -> demo-video/privacylens-demo.mp4
```

### Pipeline

`scripts/build-demo-video.mjs` runs a hybrid pipeline chosen for reliability on
CPU-only machines:

1. **ffmpeg** trims/normalizes the raw Playwright recordings
   (`clips/*.webm` → `hyperframes/assets/clips/*.mp4`).
2. **HyperFrames** renders all motion graphics — the intro/section/outro cards
   and animated lower-third captions — as video-free compositions
   (`hyperframes/compositions/*.html`). Caption overlays render as ProRes-4444
   MOV with alpha. This is the part HyperFrames owns.
3. **ffmpeg** composites the caption overlays over the product footage, builds
   the side-panel scene (rounded panel + shadow + caption), and concatenates
   every segment with crossfades into the final MP4.

Re-run individual phases with `SKIP_PRE=1`, `SKIP_GFX=1`, or `SKIP_COMP=1`.

## What's committed vs generated

Committed (source):

- `scripts/record-demo.mjs`, `scripts/build-demo-video.mjs`
- `hyperframes/compositions/*.html` (generated, but small and reviewable)
- `hyperframes/assets/gsap.min.js`, `hyperframes/assets/fonts/*` (vendored)

Generated / git-ignored (heavy, rebuildable):

- `clips/`, `hyperframes/assets/clips/`, `renders/`, `segments/`
