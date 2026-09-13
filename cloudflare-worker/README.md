# BeatVision Cloudflare Provider Worker

This Worker now integrates the proven BeatVision Arena provider pipeline into the Recovery application without replacing the existing `/api/*` image routes.

## Provider pipeline

- **Pollinations**: language/world direction and Whisper audio analysis.
- **Pixazo**: Flux Schnell for world concepts, SDXL for scene imagery, and LTX Video for image-to-video motion.
- **Shotstack Sandbox**: deterministic assembly, transitions, timeline extension, soundtrack and final MP4 rendering.
- **Cloudflare Durable Objects**: persistent scene-by-scene animation jobs that survive page refreshes and continue independently of the browser.

## Persistent animation routes

- `GET /v1/capabilities`
- `POST /v1/video/animate/jobs/:jobId`
- `GET /v1/video/animate/jobs/:jobId`
- `POST /v1/video/assemble`
- `POST /v1/image/world-assets`
- `POST /v1/image/scenes`
- `POST /v1/language/world`
- `POST /v1/language/storyboard`
- `POST /v1/audio/analyze`

The animation Durable Object persists the current scene, completed clips, failed scenes, provider request IDs, retry state and event history. Provider polling runs from the Durable Object alarm rather than from the browser, with a seven-second provider poll interval and a five-second UI polling target.

## Secrets

Configure these as Cloudflare Worker secrets. Never commit values:

- `GATEWAY_TOKEN`
- `PIXAZO_API_KEY`
- `LANGUAGE_PROVIDER_TOKEN`
- `AUDIO_PROVIDER_TOKEN` (optional if the language token is reused)
- `SHOTSTACK_API_KEY`
- `BEATVISION_ACCESS_KEY` for the legacy `/api/*` image route

## Legacy Recovery routes

The original Recovery Worker remains available under:

- `GET /api/health`
- `GET /api/provider-status`
- `POST /api/generate-scene-image`

This keeps the existing Recovery workflow compatible while the Arena provider contract is promoted into the same Worker.

## Final assembly behavior

When all animation scenes are complete, the client submits the persisted clip list and the original song to `/v1/video/assemble`. Shotstack builds the timeline to the source-song duration, varies the ordering of repeated cycles, applies alternating camera effects and transitions, attaches the actual source audio, and returns the render URL when complete.
