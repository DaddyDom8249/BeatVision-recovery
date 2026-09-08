"""Provider-routing contract tests that run without live provider credentials."""
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "backend" / "server.py"
FALLBACKS = ROOT / "backend" / "fallbacks.py"
API = ROOT / "frontend" / "src" / "lib" / "api.js"
METADATA = ROOT / "frontend" / "src" / "lib" / "generationMetadata.js"


def test_provider_routing_is_strict():
    src = SERVER.read_text()
    anthropic = list(re.finditer(r'with_model\(\s*"anthropic"', src))
    gemini = list(re.finditer(r'with_model\(\s*"gemini"', src))
    assert len(anthropic) == 1
    assert len(gemini) == 1

    claude_start = src.index("async def _claude_json(")
    claude_end = src.index("async def _claude_json_safe(")
    image_start = src.index("async def generate_scene_image(")
    assert claude_start < anthropic[0].start() < claude_end
    assert image_start < gemini[0].start()


def test_fallbacks_never_emit_image_payloads():
    src = FALLBACKS.read_text()
    for forbidden in ("generatedImageBase64", "data:image/", "imageDataUrl"):
        assert forbidden not in src


def test_frontend_context_does_not_send_reference_pixels_to_text_providers():
    src = API.read_text()
    start = src.index("function projectContext(")
    end = src.index("export async function fetchProviderStatus", start)
    context = src[start:end]
    assert "imageDataUrl" not in context
    assert "referencePhotos" in context


def test_frontend_preserves_creative_notes_aliases():
    src = API.read_text()
    assert "project.notes ?? project.creativeNotes" in src


def test_scene_image_contract_includes_consistency_notes():
    src = API.read_text()
    assert "characterConsistencyNotes" in src
    assert "environmentConsistencyNotes" in src


def test_generation_metadata_contract():
    src = METADATA.read_text()
    for field in ("kind", "provider", "mode", "fallback", "fallbackReason", "generatedAt"):
        assert field in src
    assert "world_style_bible" in src
    assert "character_sheet" in src
    assert "environment_sheet" in src
    assert "next.scenes.map" in src
    assert "next.prompts.map" in src
