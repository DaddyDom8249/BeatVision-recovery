# BeatVision

**Every Song Has a World. BeatVision Reveals It.**

BeatVision is an AI-assisted music-visualization workflow that turns a song into a consistent visual world, storyboard, scene prompts, scene images, and a persistent motion/video production pipeline.

## Demo / provider-pitch status

The `audit-stabilization` branch is the current demonstration and provider-pitch working branch. The proven provider execution pieces from `BeatVision-arena` are now integrated without modifying that source repository or pretending external providers are configured when they are not.

## Current repository status

This repository is the recovered **Phase 4A baseline** with stabilization work plus the promoted Arena provider pipeline.

The project currently contains:

- React frontend with the BeatVision project workflow
- Versioned browser persistence for project state
- Project revision tracking and generation-job state primitives
- World Report generation with deterministic fallback behavior
- World asset generation for the style bible, character sheet, and environment sheet
- Storyboard generation and scene prompt generation
- Scene image generation/provider routing
- Reference-photo support
- Browser-native rendering utilities
- Persistent server-side animation jobs using Cloudflare Durable Objects
- Pixazo Flux Schnell / SDXL / LTX provider routing
- Pollinations language and Whisper audio routing
- Shotstack Sandbox timeline assembly and MP4 rendering
- Provider/fallback tests and CI validation
- Frontend workflow-input and generation-output validation
- Generation provenance metadata

## Persistent motion pipeline

The integrated Arena path is:

`Approved scene images → persistent animation job → Pixazo LTX scene-by-scene motion → persisted clip results → Shotstack assembly → original song audio → final MP4`

The job state survives browser refresh/navigation. The UI polls persisted status every five seconds while the Durable Object independently advances provider work. Browser data-URL images are staged server-side before being written into the durable job, avoiding oversized Durable Object state records.

The project workflow exposes a **Persistent Animation** launcher at `/project/:id/animation` when the provider gateway is configured.

## Provider configuration

The Cloudflare Worker uses these server-side secrets:

- `GATEWAY_TOKEN`
- `PIXAZO_API_KEY`
- `LANGUAGE_PROVIDER_TOKEN`
- `AUDIO_PROVIDER_TOKEN` (optional if the language token is reused)
- `SHOTSTACK_API_KEY`
- `BEATVISION_ACCESS_KEY` for the legacy Recovery `/api/*` image route

Frontend configuration is documented in `frontend/.env.worker.example`.

## Architecture rules

1. Preserve the existing BeatVision workflow and visual product direction.
2. Do not replace working code with a generic AI-generated template.
3. Keep provider integrations behind explicit interfaces/routes.
4. Keep deterministic fallbacks available when external AI providers are unavailable.
5. Treat persisted project state as a first-class part of the workflow.
6. Project state is normalized through `frontend/src/lib/storage.js`; the storage envelope is versioned and legacy project arrays are migrated on read.
7. Project revisions increment on successful writes so stale state can be detected by future persistence layers.
8. Generation-job records have explicit `queued`, `running`, `succeeded`, `failed`, and `cancelled` states.
9. Never commit secrets, `.env` files, generated dependency folders, or build artifacts.

## Development

### Frontend

```bash
cd frontend
npm ci --legacy-peer-deps
npm start
```

Production build:

```bash
cd frontend
npm run build
```

Regression tests:

```bash
cd frontend
npm test -- --watchAll=false --runInBand
```

### Backend

Install the dependencies from `backend/requirements.txt`, configure the required environment variables locally, then run the FastAPI application with Uvicorn.

### Worker-backed local mode

Use `scripts/start-worker-backed-local.sh` when testing the Cloudflare Worker through the local proxy.

## CI

GitHub Actions validates Worker configuration, the Arena provider contract, backend Python syntax, the local worker proxy, frontend persistence regressions, provider routing tests, and the production frontend build.

## Capability boundary

The Arena integration is code-complete and provider-routable, but live motion/assembly still requires the corresponding provider secrets and a deployed Cloudflare Worker. Without those credentials BeatVision reports the provider as unavailable rather than fabricating completed media.

## Recovery documentation

See `RECOVERY_README.md` for recovery provenance and safety notes.
