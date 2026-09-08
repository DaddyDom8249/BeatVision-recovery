import { attachGenerationMetadata, validateGenerationInput, validateGenerationOutput } from "./api";

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

  test("rejects incomplete generation responses before they can be persisted", () => {
    expect(() => validateGenerationOutput("world-report", { logline: "x" })).toThrow(
      "Visual World Report generation returned incomplete data. Please regenerate."
    );

    expect(() => validateGenerationOutput("world-assets", { world_style_bible: {} })).toThrow(
      "World Assets generation returned incomplete data. Please regenerate."
    );

    expect(() => validateGenerationOutput("storyboard", { scenes: [] })).toThrow(
      "Storyboard generation did not return the required 8 scenes. Please regenerate."
    );

    expect(() => validateGenerationOutput("scene-prompts", { prompts: [] })).toThrow(
      "Scene prompt generation returned no prompts. Please regenerate."
    );

    expect(() => validateGenerationOutput("scene-image", { providerName: "test" })).toThrow(
      "Scene image generation returned no image. Please regenerate."
    );
  });

  test("accepts valid workflow generation responses", () => {
    expect(validateGenerationOutput("world-report", {
      logline: "A story",
      visual_world_setting: "A city",
      seven_story_beats: [],
    })).toBe(true);

    expect(validateGenerationOutput("world-assets", {
      world_style_bible: {},
      character_sheet: {},
      environment_sheet: {},
    })).toBe(true);

    expect(validateGenerationOutput("storyboard", {
      scenes: Array.from({ length: 8 }, (_, i) => ({ scene_number: i + 1 })),
    })).toBe(true);

    expect(validateGenerationOutput("scene-prompts", {
      prompts: [{ scene_number: 1, final_polished_prompt: "A shot" }],
    })).toBe(true);

    expect(validateGenerationOutput("scene-image", {
      generatedImageBase64: "data:image/png;base64,abc",
    })).toBe(true);
  });
});
