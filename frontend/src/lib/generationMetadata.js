export function buildGenerationMetadata({ kind, data = null, provider = null }) {
  const fallback = Boolean(data?._fallback);
  return {
    kind,
    provider:
      provider ||
      data?.providerName ||
      data?.provider ||
      (fallback ? "BeatVision deterministic fallback" : "Anthropic Claude Sonnet 4.5 (via Emergent)"),
    mode: fallback ? "fallback" : "provider",
    fallback,
    fallbackReason: data?._fallback_reason || null,
    generatedAt: new Date().toISOString(),
  };
}

export function attachGenerationMetadata(data, kind, provider = null) {
  if (!data || typeof data !== "object") return data;
  const metadata = buildGenerationMetadata({ kind, data, provider });
  const next = { ...data, _generation: metadata };

  if (kind === "world-assets") {
    for (const key of ["world_style_bible", "character_sheet", "environment_sheet"]) {
      if (next[key] && typeof next[key] === "object") {
        next[key] = { ...next[key], _generation: metadata };
      }
    }
  }

  if (kind === "storyboard" && Array.isArray(next.scenes)) {
    next.scenes = next.scenes.map((scene) => ({ ...scene, _generation: metadata }));
  }

  if (kind === "scene-prompts" && Array.isArray(next.prompts)) {
    next.prompts = next.prompts.map((prompt) => ({ ...prompt, _generation: metadata }));
  }

  return next;
}
