const KEY = "beatvision.projects.v1";
const STORE_VERSION = 2;

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanIdArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === "string" && id))]
    : [];
}

function normalizeJob(job) {
  if (!isObject(job) || !job.kind) return null;
  return {
    id: String(job.id || job.kind),
    kind: String(job.kind),
    status: ["queued", "running", "succeeded", "failed", "cancelled"].includes(job.status)
      ? job.status
      : "failed",
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    error: job.error || null,
  };
}

export class StorageQuotaError extends Error {
  constructor(message = "Browser storage is full.") {
    super(message);
    this.name = "StorageQuotaError";
    this.code = "BEATVISION_STORAGE_QUOTA";
  }
}

export function isStorageQuotaError(error) {
  return (
    error instanceof StorageQuotaError ||
    error?.name === "QuotaExceededError" ||
    error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error?.code === 22 ||
    error?.code === 1014 ||
    error?.code === "BEATVISION_STORAGE_QUOTA"
  );
}

export function normalizeProject(project) {
  if (!isObject(project)) return project;

  const referencePhotos = Array.isArray(project.referencePhotos)
    ? project.referencePhotos.filter(Boolean)
    : [];

  const sceneImages = isObject(project.sceneImages)
    ? project.sceneImages
    : {};

  const sceneReferencePhotoIds = isObject(project.sceneReferencePhotoIds)
    ? Object.fromEntries(
        Object.entries(project.sceneReferencePhotoIds).map(([key, ids]) => [
          String(key),
          cleanIdArray(ids),
        ])
      )
    : {};

  for (const scene of Array.isArray(project.storyboardScenes)
    ? project.storyboardScenes
    : []) {
    const key = String(scene?.scene_number ?? scene?.id ?? "");
    if (!key) continue;

    if (
      !Object.prototype.hasOwnProperty.call(sceneReferencePhotoIds, key) &&
      Array.isArray(scene?.reference_photo_overrides)
    ) {
      sceneReferencePhotoIds[key] = cleanIdArray(
        scene.reference_photo_overrides
      );
    }
  }

  const jobs = isObject(project.generationJobs)
    ? Object.fromEntries(
        Object.entries(project.generationJobs)
          .map(([key, job]) => [String(key), normalizeJob({ ...job, kind: job?.kind || key })])
          .filter(([, job]) => job)
      )
    : {};

  return {
    ...project,
    schemaVersion: STORE_VERSION,
    revision: Number.isInteger(project.revision) && project.revision >= 0
      ? project.revision
      : 0,
    referencePhotos,
    sceneImages,
    sceneReferencePhotoIds,
    generationJobs: jobs,
  };
}

function readStore() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { version: STORE_VERSION, projects: [] };

  const parsed = JSON.parse(raw);

  // Migrate the original v1 array format in memory. The next successful write
  // persists the versioned envelope without changing the project workflow.
  if (Array.isArray(parsed)) {
    return {
      version: STORE_VERSION,
      projects: parsed.map(normalizeProject).filter(Boolean),
    };
  }

  if (!isObject(parsed) || !Array.isArray(parsed.projects)) {
    return { version: STORE_VERSION, projects: [] };
  }

  return {
    version: STORE_VERSION,
    projects: parsed.projects.map(normalizeProject).filter(Boolean),
  };
}

export function loadProjects() {
  try {
    return readStore().projects;
  } catch (error) {
    console.error("loadProjects failed", error);
    return [];
  }
}

export function saveProjects(projects) {
  const normalized = Array.isArray(projects)
    ? projects.map(normalizeProject).filter(Boolean)
    : [];

  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: STORE_VERSION, projects: normalized })
    );
    return true;
  } catch (error) {
    console.error("saveProjects failed", error);

    if (isStorageQuotaError(error)) {
      throw new StorageQuotaError(
        "Browser storage is full. Remove large reference or scene images before adding more."
      );
    }

    throw error;
  }
}

export function getProject(id) {
  return loadProjects().find((project) => project.id === id) || null;
}

export function upsertProject(project) {
  const now = new Date().toISOString();
  const projects = loadProjects();
  const normalized = normalizeProject(project);
  const index = projects.findIndex((item) => item.id === normalized.id);
  const previous = index >= 0 ? projects[index] : null;

  const next = normalizeProject({
    ...normalized,
    revision: (previous?.revision || normalized.revision || 0) + 1,
    updatedAt: now,
  });

  if (index >= 0) {
    projects[index] = next;
  } else {
    projects.unshift({
      ...next,
      createdAt: next.createdAt || now,
    });
  }

  saveProjects(projects);
  return next;
}

export function updateProject(id, updater) {
  const current = getProject(id);
  if (!current) return null;

  const candidate = typeof updater === "function"
    ? updater(current)
    : { ...current, ...updater };

  return upsertProject({ ...current, ...candidate, id: current.id });
}

export function setGenerationJob(id, kind, patch) {
  const now = new Date().toISOString();
  return updateProject(id, (project) => ({
    generationJobs: {
      ...(project.generationJobs || {}),
      [kind]: normalizeJob({
        ...(project.generationJobs?.[kind] || {}),
        id: project.generationJobs?.[kind]?.id || `${kind}-${Date.now()}`,
        kind,
        ...patch,
        startedAt: patch?.startedAt || project.generationJobs?.[kind]?.startedAt || now,
      }),
    },
  }));
}

export function deleteProject(id) {
  const projects = loadProjects().filter(
    (project) => project.id !== id
  );
  return saveProjects(projects);
}

export function newProject(fields) {
  return normalizeProject({
    id: crypto.randomUUID(),
    title: fields.title || "Untitled",
    artist: fields.artist || "",
    lyrics: fields.lyrics || "",
    style: fields.style || "dark_cinematic_surreal",
    notes: fields.notes || "",
    referencePhotos: Array.isArray(fields.referencePhotos)
      ? fields.referencePhotos
      : [],
    worldReport: null,
    worldReportApproved: false,
    styleBible: null,
    styleBibleApproved: false,
    characterSheet: null,
    characterSheetApproved: false,
    environmentSheet: null,
    environmentSheetApproved: false,
    worldAssetsFallback: null,
    storyboardScenes: null,
    storyboardApproved: false,
    storyboardFallback: null,
    scenePrompts: null,
    scenePromptsApproved: false,
    scenePromptsFallback: null,
    sceneImages: {},
    sceneReferencePhotoIds: {},
    motionPlan: null,
    generationJobs: {},
    revision: 0,
    createdAt: null,
    updatedAt: null,
  });
}

export async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function projectStatus(project) {
  if (!project) return "missing";

  if (
    Object.keys(project.sceneImages || {}).some(
      (key) => project.sceneImages[key]?.approved
    )
  ) {
    return "in_production";
  }

  if (project.scenePromptsApproved) return "prompts_ready";
  if (project.storyboardApproved) return "storyboard_ready";
  if (project.worldReportApproved) return "world_ready";
  return "draft";
}
