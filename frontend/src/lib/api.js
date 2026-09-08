import axios from "axios";
import { attachGenerationMetadata } from "./generationMetadata";

export { attachGenerationMetadata } from "./generationMetadata";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const IMAGE_TEST_URL = process.env.REACT_APP_IMAGE_TEST_URL || "";

export const API = `${BACKEND_URL}/api`;
const IMAGE_API = IMAGE_TEST_URL ? `${IMAGE_TEST_URL}/api` : API;

const client = axios.create({ baseURL: API, timeout: 120000 });
const imageClient = axios.create({ baseURL: IMAGE_API, timeout: 210000 });

let imageTestAvailable = Boolean(IMAGE_TEST_URL);

function workflowGuard(message) {
  const error = new Error(message);
  error.code = "BEATVISION_WORKFLOW_GUARD";
  return error;
}

export function validateGenerationInput(kind, project) {
  if (!project) throw workflowGuard("A BeatVision project is required.");

  switch (kind) {
    case "world-report":
      if (!project.title && !project.lyrics) {
        throw workflowGuard("Add a song title or lyrics before revealing the world.");
      }
      break;
    case "world-assets":
      if (!project.worldReportApproved) {
        throw workflowGuard("Approve the Visual World Report before generating World Assets.");
      }
      break;
    case "storyboard":
      if (!project.worldReportApproved) {
        throw workflowGuard("Approve the Visual World Report before generating the storyboard.");
      }
      if (!(project.styleBibleApproved && project.characterSheetApproved && project.environmentSheetApproved)) {
        throw workflowGuard("Approve the World Assets before generating the storyboard.");
      }
      break;
    case "scene-prompts":
      if (!project.storyboardApproved) {
        throw workflowGuard("Approve the storyboard before generating scene prompts.");
      }
      break;
    case "scene-image":
      if (!project.scenePrompt || !String(project.scenePrompt).trim()) {
        throw workflowGuard("A scene prompt is required before generating a scene image.");
      }
      break;
    default:
      throw workflowGuard(`Unknown BeatVision generation stage: ${kind}`);
  }

  return true;
}

function projectContext(project) {
  const lyrics = (project.lyrics || "").slice(0, 1200);
  const notesSource =
    typeof project.notes === "string" && project.notes.trim()
      ? project.notes
      : typeof project.creativeNotes === "string"
        ? project.creativeNotes
        : "";
  const notes = notesSource.slice(0, 500);

  return {
    title: (project.title || "").slice(0, 120),
    artist: (project.artist || "").slice(0, 80),
    lyrics,
    style: project.style,
    notes,
    referencePhotos: (project.referencePhotos || []).map((reference) => ({
      id: reference.id,
      type: reference.type,
      description: (reference.description || "").slice(0, 160),
      fileName: (reference.fileName || "").slice(0, 80),
    })),
  };
}

export async function fetchProviderStatus() {
  const { data: primaryStatus } = await client.get("/provider-status");
  if (!IMAGE_TEST_URL) {
    imageTestAvailable = false;
    return primaryStatus;
  }

  try {
    const { data: imageStatus } = await imageClient.get("/provider-status");
    imageTestAvailable = true;
    return {
      ...primaryStatus,
      image_generation: imageStatus.image_generation || primaryStatus.image_generation,
      reference_photo_image_generation:
        imageStatus.reference_photo_image_generation ||
        primaryStatus.reference_photo_image_generation,
    };
  } catch (error) {
    imageTestAvailable = false;
    console.warn("Free image test provider is unavailable", error);
    return primaryStatus;
  }
}

export async function generateWorldReport(project) {
  validateGenerationInput("world-report", project);
  const { data } = await client.post("/generate-world-report", projectContext(project));
  return attachGenerationMetadata(data, "world-report");
}

export async function generateWorldAssets(project) {
  validateGenerationInput("world-assets", project);
  const { data } = await client.post("/generate-world-assets", {
    ...projectContext(project),
    worldReport: project.worldReport,
  });
  return attachGenerationMetadata(data, "world-assets");
}

export async function generateStoryboard(project) {
  validateGenerationInput("storyboard", project);
  const { data } = await client.post("/generate-storyboard", {
    ...projectContext(project),
    worldReport: project.worldReport,
    styleBible: project.styleBible,
    characterSheet: project.characterSheet,
    environmentSheet: project.environmentSheet,
  });
  return attachGenerationMetadata(data, "storyboard");
}

export async function generateScenePrompts(project) {
  validateGenerationInput("scene-prompts", project);
  const { data } = await client.post("/generate-scene-prompts", {
    ...projectContext(project),
    worldReport: project.worldReport,
    styleBible: project.styleBible,
    characterSheet: project.characterSheet,
    environmentSheet: project.environmentSheet,
    storyboard: project.storyboardScenes || [],
  });
  return attachGenerationMetadata(data, "scene-prompts");
}

export async function generateSceneImage({
  projectId,
  sceneId,
  scenePrompt,
  stylePreset,
  negativePrompt,
  characterConsistencyNotes,
  environmentConsistencyNotes,
  referenceImages,
}) {
  validateGenerationInput("scene-image", { scenePrompt });
  const useImageTestProvider = Boolean(IMAGE_TEST_URL && imageTestAvailable);
  const selectedClient = useImageTestProvider ? imageClient : client;

  const { data } = await selectedClient.post("/generate-scene-image", {
    projectId,
    sceneId,
    scenePrompt,
    stylePreset,
    negativePrompt: negativePrompt || "",
    characterConsistencyNotes: characterConsistencyNotes || "",
    environmentConsistencyNotes: environmentConsistencyNotes || "",
    referenceImages: (referenceImages || []).map((reference) => ({
      id: reference.id,
      type: reference.type,
      description: reference.description || "",
      fileName: reference.fileName || "",
      imageDataUrl: useImageTestProvider ? undefined : reference.imageDataUrl,
    })),
  });

  return attachGenerationMetadata(
    data,
    "scene-image",
    data?.providerName ||
      (useImageTestProvider
        ? "Cloudflare Worker image provider"
        : "Google Gemini Nano Banana (via Emergent)")
  );
}
