# BeatVision Demo & AI Provider Pitch

**Every Song Has a World. BeatVision Reveals It.**

## What to demonstrate

BeatVision is an AI-assisted music-visualization workflow that turns a song into a coherent visual world before production begins.

The demonstration path is:

1. Create a project with a song title, lyrics, visual style, and optional creative notes.
2. Generate the **Visual World Report**.
3. Review and approve the world.
4. Generate and approve the **World Assets**: World Style Bible, Character Sheet, and Environment Sheet.
5. Generate the **8-scene Storyboard** and approve it.
6. Generate scene prompts with character/environment consistency information.
7. Generate scene images through the configured image provider or use manual scene-image upload when provider access is unavailable.
8. Approve scene images.
9. Demonstrate the browser-native WebM motion/export pipeline using the approved scenes and a selected audio file.

## The product idea

BeatVision is not simply a prompt-to-video button.

It establishes a visual identity for a song first. The song becomes a visual world with a defined setting, characters, environment, style language, story beats, storyboard, and scene-level prompts. Those artifacts become the foundation for consistent visual production.

## What is already technically established

- Persistent project state with versioned browser storage.
- Explicit generation-job lifecycle: queued, running, succeeded, failed, and cancelled.
- Protection against stale asynchronous generation results.
- Workflow prerequisite validation.
- Generation-output validation before generated data is accepted.
- Generation provenance metadata identifying provider/fallback mode.
- Provider routing for text and image generation.
- Deterministic fallback generation for text-oriented stages when an external LLM is unavailable.
- Reference-photo workflow and scene-level reference selection.
- Cloudflare Worker/local proxy path for image-provider testing.
- Browser-native WebM rendering from approved scene images and a selected audio file.
- Automated frontend persistence tests, backend contract checks, Worker checks, proxy smoke checks, and production-build validation.

## What the demonstration should say honestly

The current recovered Phase 4A implementation does **not** claim that AI motion generation or server-side MP4 export is complete.

The browser renderer produces WebM locally. AI motion generation and production-grade server-side video/MP4 rendering are the next infrastructure integrations.

This distinction is intentional. The goal of the provider pitch is to demonstrate a working product workflow and a clear integration surface rather than pretend unfinished infrastructure is already production-grade.

## Provider pitch

> BeatVision is a working AI music-visualization platform built around a simple idea: every song has a world.
>
> Instead of generating disconnected clips, BeatVision first interprets the song and builds a consistent visual world: story direction, visual style, characters, environments, storyboard scenes, and scene prompts. That gives downstream image and video models structured context instead of isolated prompts.
>
> The core workflow is already implemented and tested. What I am looking for is AI infrastructure support to expand generation capacity and connect the next stage of production-grade image, motion, and video generation.
>
> I am specifically interested in API credits, startup/developer access, or a technical partnership that would let me demonstrate BeatVision at a larger scale while giving your models a real creative-production workload.

## Five-minute demonstration script

### 0:00-0:30 — The problem

"Most AI music-video tools jump straight from a song or prompt to individual clips. The problem is consistency. Characters change, environments drift, and the visual language can fall apart from scene to scene."

### 0:30-1:15 — The idea

"BeatVision takes a different approach. We reveal the visual world of the song first."

Create/open the demonstration project and show the song information and style.

### 1:15-2:00 — Reveal the World

Run Visual World Report generation.

Point out the logline, setting, visual direction, and story beats.

Say: "This is the creative contract for the rest of the production."

Approve it.

### 2:00-2:45 — Build the World

Generate World Assets.

Show the World Style Bible, Character Sheet, and Environment Sheet.

Approve all three.

Say: "Now the system has persistent references for the world rather than asking every scene to reinvent the characters and environment."

### 2:45-3:30 — Storyboard and prompts

Generate the 8-scene storyboard, approve it, then generate scene prompts.

Show two or three scenes rather than reading everything.

Say: "The same world definition now flows into individual scene production."

### 3:30-4:15 — Images

Generate one or two representative scene images using the configured provider. If provider access is unavailable, demonstrate the manual-image path and clearly identify it as such.

Approve the images.

### 4:15-5:00 — Video pipeline and ask

Open the motion/export stage, select the demonstration audio, and show the browser-native WebM render path.

Then make the provider request:

"The core product workflow is working. The next step is scale and production infrastructure: stronger image generation, AI motion generation, and server-side video rendering. That is where API credits or a provider partnership would directly accelerate BeatVision."

## Demo safety rules

- Use one prepared demonstration project rather than creating a project from scratch in front of an audience unless creation itself is part of the demonstration.
- Keep a known-good set of approved scene images available as a fallback.
- Keep the demonstration audio file local and ready before the demo.
- Do not claim that AI motion generation is connected if it is not.
- Do not claim server-side MP4 export if the demonstration is using browser WebM rendering.
- Do not expose API keys, Worker access keys, or environment variables on screen.
- If an external provider is unavailable, use the existing fallback/manual workflow and identify it accurately.

## Provider-readiness checklist

Before a live provider meeting, verify:

- [ ] Production frontend points to the intended backend URL.
- [ ] Image test/provider URL is configured only when intentionally used.
- [ ] Backend provider credentials exist only in deployment secrets/environment configuration.
- [ ] Worker access key is not exposed in frontend source.
- [ ] Credit-Safe Mode is enabled for rehearsals where paid calls are not required.
- [ ] The prepared project opens successfully after refresh.
- [ ] World Report generation succeeds or its fallback state is clearly visible.
- [ ] World Assets generation succeeds or its fallback state is clearly visible.
- [ ] Storyboard contains exactly 8 scenes.
- [ ] Scene prompts are generated.
- [ ] At least one scene image can be produced or manually uploaded.
- [ ] Approved scene images can be rendered through the browser WebM pipeline.
- [ ] The browser supports Canvas capture, Web Audio, and MediaRecorder/WebM.
- [ ] The latest GitHub checks are green before the meeting.

## Positioning

**BeatVision is demo-ready as a working AI-assisted visual-development MVP and is seeking provider infrastructure support for the next production stage.**

It should be presented as an existing technical foundation that needs more generation capacity and production video infrastructure, not as a generic app concept waiting to be built.
