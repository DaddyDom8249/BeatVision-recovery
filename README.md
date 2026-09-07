# BeatVision

**Every Song Has a World. BeatVision Reveals It.**

BeatVision is an AI-assisted music-visualization workflow that turns a song into a consistent visual world, storyboard, scene prompts, scene images, and an eventual motion/video production pipeline.

## Current repository status

This repository is the recovered **Phase 4A baseline**. It is intentionally treated as the working recovery source, not as a claim that it contains every change from later BeatVision exports.

The project currently contains:

- React frontend with the BeatVision project workflow
- Versioned browser persistence for project state
- Project revision tracking and generation-job state primitives
- World Report generation with deterministic fallback behavior
- World asset generation for the style bible, character sheet, and environment sheet
- Storyboard generation
- Scene prompt generation
- Scene image generation/provider routing
- Reference-photo support
- Motion/export planning and browser-side rendering utilities
- FastAPI backend
- Cloudflare Worker and local worker proxy support
- Provider/fallback tests and CI validation

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

GitHub Actions validates Worker syntax/configuration, backend Python syntax, the local worker proxy, frontend persistence regressions, and the production frontend build on pushes and pull requests affecting the application.

## Important limitation

The recovered baseline is not the newest Replit/TRUE_COMPLETE export. Later exports may contain additional functionality that should only be merged after code-level comparison and validation. Do not blindly overwrite this repository with a later snapshot.

## Recovery documentation

See `RECOVERY_README.md` for recovery provenance and safety notes.
