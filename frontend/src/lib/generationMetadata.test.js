import { attachGenerationMetadata, buildGenerationMetadata } from "./generationMetadata";

describe("BeatVision generation metadata", () => {
  test("marks provider output as provider-generated", () => {
    const metadata = buildGenerationMetadata({
      kind: "world-report",
      data: { providerName: "Claude" },
    });

    expect(metadata.kind).toBe("world-report");
    expect(metadata.provider).toBe("Claude");
    expect(metadata.mode).toBe("provider");
    expect(metadata.fallback).toBe(false);
    expect(metadata.fallbackReason).toBeNull();
    expect(metadata.generatedAt).toBeTruthy();
  });

  test("marks fallback output and propagates metadata to generated children", () => {
    const result = attachGenerationMetadata(
      {
        _fallback: true,
        _fallback_reason: "timeout",
        world_style_bible: { overall_look: "test" },
        character_sheet: { name_role: "test" },
        environment_sheet: { main_location: "test" },
      },
      "world-assets"
    );

    expect(result._generation.fallback).toBe(true);
    expect(result._generation.mode).toBe("fallback");
    expect(result._generation.fallbackReason).toBe("timeout");
    expect(result.world_style_bible._generation).toEqual(result._generation);
    expect(result.character_sheet._generation).toEqual(result._generation);
    expect(result.environment_sheet._generation).toEqual(result._generation);
  });

  test("propagates one generation record to storyboard scenes and prompts", () => {
    const storyboard = attachGenerationMetadata(
      { scenes: [{ scene_number: 1 }, { scene_number: 2 }] },
      "storyboard"
    );
    const prompts = attachGenerationMetadata(
      { prompts: [{ scene_number: 1 }, { scene_number: 2 }] },
      "scene-prompts"
    );

    expect(storyboard.scenes[0]._generation).toEqual(storyboard._generation);
    expect(storyboard.scenes[1]._generation).toEqual(storyboard._generation);
    expect(prompts.prompts[0]._generation).toEqual(prompts._generation);
    expect(prompts.prompts[1]._generation).toEqual(prompts._generation);
  });
});
