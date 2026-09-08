import { attachGenerationMetadata, validateGenerationInput } from "./api";

describe("BeatVision generation contracts", () => {
  test("attaches explicit provider metadata and preserves fallback reason", () => {
    const result = attachGenerationMetadata(
      {
        _fallback: true,
        _fallback_reason: "timeout",
        scenes: [{ scene_number: 1, scene_title: "Opening" }],
      },
      "storyboard"
    );

    expect(result._generation).toMatchObject({
      kind: "storyboard",
      provider: "BeatVision deterministic fallback",
      mode: "fallback",
      fallback: true,
      fallbackReason: "timeout",
    });
    expect(result.scenes[0]._generation).toEqual(result._generation);
  });

  test("propagates provider metadata to world assets", () => {
    const result = attachGenerationMetadata(
      {
        world_style_bible: { overall_look: "cinematic" },
        character_sheet: { name_role: "protagonist" },
        environment_sheet: { main_location: "warehouse" },
      },
      "world-assets",
      "Anthropic Claude Sonnet 4.5 (via Emergent)"
    );

    expect(result._generation.provider).toBe("Anthropic Claude Sonnet 4.5 (via Emergent)");
    expect(result.world_style_bible._generation).toEqual(result._generation);
    expect(result.character_sheet._generation).toEqual(result._generation);
    expect(result.environment_sheet._generation).toEqual(result._generation);
  });

  test("blocks generation when workflow prerequisites are missing", () => {
    expect(() => validateGenerationInput("world-assets", { worldReportApproved: false })).toThrow(
      "Approve the Visual World Report before generating World Assets."
    );

    expect(() => validateGenerationInput("storyboard", { worldReportApproved: true })).toThrow(
      "Approve the World Assets before generating the storyboard."
    );

    expect(() => validateGenerationInput("scene-prompts", { storyboardApproved: false })).toThrow(
      "Approve the storyboard before generating scene prompts."
    );

    expect(() => validateGenerationInput("scene-image", { scenePrompt: "" })).toThrow(
      "A scene prompt is required before generating a scene image."
    );
  });

  test("allows a fully gated workflow to proceed", () => {
    expect(validateGenerationInput("world-report", { title: "Test" })).toBe(true);
    expect(validateGenerationInput("world-assets", { worldReportApproved: true })).toBe(true);
    expect(validateGenerationInput("storyboard", {
      worldReportApproved: true,
      styleBibleApproved: true,
      characterSheetApproved: true,
      environmentSheetApproved: true,
    })).toBe(true);
    expect(validateGenerationInput("scene-prompts", { storyboardApproved: true })).toBe(true);
    expect(validateGenerationInput("scene-image", { scenePrompt: "A cinematic opening shot" })).toBe(true);
  });
});
