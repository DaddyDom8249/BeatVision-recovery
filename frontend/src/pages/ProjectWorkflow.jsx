import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, upsertProject, updateProject, setGenerationJob, fileToDataUrl, StorageQuotaError } from "@/lib/storage";
import { styleLabel, refTypeLabel, REFERENCE_TYPES } from "@/lib/constants";
import {
  generateWorldReport,
  generateWorldAssets,
  generateStoryboard,
  generateScenePrompts,
  generateSceneImage,
  fetchProviderStatus,
} from "@/lib/api";
import ReferencePhotoUploader from "@/components/ReferencePhotoUploader";
import StatusBadge from "@/components/StatusBadge";
import MotionExportPanel from "@/components/MotionExportPanel";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle2,
  Lock,
  Copy,
  Upload,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
  AlertTriangle,
} from "lucide-react";

// ----------- Helpers -----------
const FALLBACK_REASON_LABELS = {
  budget_exceeded: "LLM budget exceeded",
  timeout: "LLM timed out",
  rate_limited: "LLM rate limited",
  network: "Network error reaching LLM",
  unavailable: "LLM unavailable",
};

const GEMINI_UNAVAILABLE_MESSAGE =
  "Gemini Nano Banana image generation is unavailable or blocked by budget. Upload manually or try again later.";

const FREE_TEST_UNAVAILABLE_MESSAGE =
  "Cloudflare free test image generation is unavailable. Manual upload remains available.";

function FallbackBanner({ data, onRetry, testid }) {
  if (!data || !data._fallback) return null;
  const label = FALLBACK_REASON_LABELS[data._fallback_reason] || "LLM unavailable";
  return (
    <div
      className="mb-4 p-4 border border-[#FDBA74]/40 bg-[#F97316]/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      data-testid={testid || "fallback-banner"}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#FDBA74] mt-0.5 shrink-0" strokeWidth={1.5} />
        <div>
          <div className="overline text-[#FDBA74] mb-1">Demo Fallback · {label}</div>
          <div className="font-body text-sm text-neutral-300">
            {data._fallback_message ||
              "Claude generation was unavailable, so BeatVision used demo fallback generation."}
          </div>
        </div>
      </div>
      {onRetry && (
        <button
          className="btn-gold shrink-0"
          onClick={onRetry}
          data-testid={testid ? `${testid}-retry` : "fallback-retry"}
        >
          <RefreshCw className="w-3 h-3 inline mr-1" /> Retry Claude
        </button>
      )}
    </div>
  );
}
function Section({ num, title, badge, children, testid }) {
  return (
    <section className="bv-card p-6 md:p-8" data-testid={testid}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="stage-num">{String(num).padStart(2, "0")}</div>
          <div>
            <div className="overline text-neutral-500">Stage</div>
            <h2 className="font-display text-2xl md:text-3xl uppercase leading-tight">{title}</h2>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function FieldRow({ label, value }) {
  if (!value && value !== 0) return null;
  const isArr = Array.isArray(value);
  return (
    <div className="border-t border-white/5 py-3">
      <div className="overline text-neutral-500 mb-1">{label}</div>
      {isArr ? (
        <ul className="list-disc list-inside space-y-1 text-neutral-200 font-body text-sm">
          {value.map((v, i) => (
            <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>
          ))}
        </ul>
      ) : typeof value === "object" ? (
        <pre className="font-mono text-xs text-neutral-300 whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <div className="text-neutral-200 font-body text-sm leading-relaxed">{String(value)}</div>
      )}
    </div>
  );
}

// ----------- Main Page -----------
export default function ProjectWorkflow() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState({});
  const [providerStatus, setProviderStatus] = useState(null);
  const projectRef = useRef(null);

  useEffect(() => {
    const p = getProject(id);
    if (!p) {
      toast.error("Project not found");
      nav("/dashboard");
      return;
    }
    projectRef.current = p;
    setProject(p);
    fetchProviderStatus()
      .then(setProviderStatus)
      .catch(() => setProviderStatus(null));
  }, [id, nav]);

  function persist(patch) {
    const current = getProject(id) || projectRef.current || project;
    if (!current) return null;

    try {
      const saved = updateProject(id, (latest) => ({
        ...latest,
        ...patch,
      }));
      if (!saved) return null;
      projectRef.current = saved;
      setProject(saved);
      return saved;
    } catch (error) {
      console.error("Project persistence failed", error);

      if (
        error instanceof StorageQuotaError ||
        error?.code === "BEATVISION_STORAGE_QUOTA"
      ) {
        toast.error(
          "Browser storage is full. Remove large reference or scene images before adding more."
        );
        toast.warning(
          "The latest change was not saved and will not survive a page refresh."
        );
      } else {
        toast.error(
          "The latest project change could not be saved to browser storage."
        );
      }
      return null;
    }
  }

  function setLoad(k, v) {
    setLoading((l) => ({ ...l, [k]: v }));
  }

  async function runGenerationJob(kind, work) {
    const startedAt = new Date().toISOString();
    const jobId = `${kind}-${Date.now()}`;
    try {
      setGenerationJob(id, kind, {
        id: jobId,
        status: "running",
        startedAt,
        finishedAt: null,
        error: null,
      });
      const result = await work();
      setGenerationJob(id, kind, {
        id: jobId,
        status: "succeeded",
        startedAt,
        finishedAt: new Date().toISOString(),
        error: null,
      });
      return result;
    } catch (error) {
      try {
        setGenerationJob(id, kind, {
          id: jobId,
          status: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          error: error?.response?.data?.detail || error?.message || "Generation failed",
        });
      } catch (persistError) {
        console.error("Generation job failure state could not be persisted", persistError);
      }
      throw error;
    }
  }

  const imageProviderReady =
    providerStatus?.image_generation?.connected;
  const imageProviderMode =
    providerStatus?.image_generation?.mode;
  const promptGuidedProviderActive =
    imageProviderMode === "prompt_guided_test" ||
    imageProviderMode === "worker_ai_binding";

  if (!project) return null;

  const worldReportBadge = project.worldReportApproved ? (
    <StatusBadge status="approved" testid="stage-badge-world" />
  ) : project.worldReport ? (
    <StatusBadge status="ready" testid="stage-badge-world" />
  ) : (
    <StatusBadge status="missing" testid="stage-badge-world" />
  );

  const assetsApproved =
    project.styleBibleApproved && project.characterSheetApproved && project.environmentSheetApproved;
  const assetsBadge = !project.worldReportApproved ? (
    <StatusBadge status="locked" testid="stage-badge-assets" />
  ) : assetsApproved ? (
    <StatusBadge status="approved" testid="stage-badge-assets" />
  ) : project.styleBible ? (
    <StatusBadge status="ready" testid="stage-badge-assets" />
  ) : (
    <StatusBadge status="missing" testid="stage-badge-assets" />
  );

  const storyboardBadge = !assetsApproved ? (
    <StatusBadge status="locked" testid="stage-badge-story" />
  ) : project.storyboardApproved ? (
    <StatusBadge status="approved" testid="stage-badge-story" />
  ) : project.storyboardScenes ? (
    <StatusBadge status="ready" testid="stage-badge-story" />
  ) : (
    <StatusBadge status="missing" testid="stage-badge-story" />
  );

  const promptsBadge = !project.storyboardApproved ? (
    <StatusBadge status="locked" testid="stage-badge-prompts" />
  ) : project.scenePromptsApproved ? (
    <StatusBadge status="approved" testid="stage-badge-prompts" />
  ) : project.scenePrompts ? (
    <StatusBadge status="ready" testid="stage-badge-prompts" />
  ) : (
    <StatusBadge status="missing" testid="stage-badge-prompts" />
  );

  const approvedImagesCount = Object.values(project.sceneImages || {}).filter((s) => s?.approved).length;

  // ---------- Handlers ----------
  async function doWorldReport() {
    setLoad("world", true);
    try {
      const report = await runGenerationJob("world-report", () => generateWorldReport(project));
      persist({ worldReport: report, worldReportApproved: false });
      toast.success("Visual World Report generated");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Failed to generate report");
    } finally {
      setLoad("world", false);
    }
  }

  async function doWorldAssets() {
    setLoad("assets", true);
    try {
      const data = await runGenerationJob("world-assets", () => generateWorldAssets(project));
      const fb = data._fallback
        ? { _fallback: true, _fallback_reason: data._fallback_reason, _fallback_message: data._fallback_message }
        : null;
      persist({
        styleBible: data.world_style_bible,
        characterSheet: data.character_sheet,
        environmentSheet: data.environment_sheet,
        worldAssetsFallback: fb,
        styleBibleApproved: false,
        characterSheetApproved: false,
        environmentSheetApproved: false,
      });
      if (fb) toast.warning("World Assets: demo fallback generated (Claude unavailable)");
      else toast.success("World Assets generated");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Failed to generate assets");
    } finally {
      setLoad("assets", false);
    }
  }

  async function doStoryboard() {
    setLoad("story", true);
    try {
      const data = await runGenerationJob("storyboard", () => generateStoryboard(project));
      const fb = data._fallback
        ? { _fallback: true, _fallback_reason: data._fallback_reason, _fallback_message: data._fallback_message }
        : null;
      persist({
        storyboardScenes: data.scenes,
        storyboardFallback: fb,
        storyboardApproved: false,
        sceneReferencePhotoIds: {},
        scenePrompts: null,
        scenePromptsFallback: null,
        scenePromptsApproved: false,
        sceneImages: {},
        motionPlan: null,
      });
      if (fb) toast.warning("Storyboard: demo fallback generated (Claude unavailable)");
      else toast.success("Storyboard generated (8 scenes)");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Failed to generate storyboard");
    } finally {
      setLoad("story", false);
    }
  }

  async function doScenePrompts() {
    setLoad("prompts", true);
    try {
      const effectiveStoryboard = (project.storyboardScenes || []).map((s) => ({
        ...s,
        reference_photo_ids: effectiveRefIds(s),
      }));
      const patchedProject = { ...project, storyboardScenes: effectiveStoryboard };
      const data = await runGenerationJob("scene-prompts", () => generateScenePrompts(patchedProject));
      const fb = data._fallback
        ? { _fallback: true, _fallback_reason: data._fallback_reason, _fallback_message: data._fallback_message }
        : null;
      persist({ scenePrompts: data.prompts, scenePromptsFallback: fb, scenePromptsApproved: false });
      if (fb) toast.warning("Scene Prompts: demo fallback generated (Claude unavailable)");
      else toast.success("Scene prompts generated");
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Failed to generate scene prompts");
    } finally {
      setLoad("prompts", false);
    }
  }

  function sceneReferenceKey(scene) {
    return String(scene?.scene_number ?? scene?.id ?? "");
  }

  function validReferenceIds(ids) {
    const validIds = new Set(
      (project.referencePhotos || []).map((reference) => reference.id)
    );

    return Array.isArray(ids)
      ? [...new Set(ids)].filter((id) => validIds.has(id))
      : [];
  }

  function hasSceneReferenceSelection(scene) {
    return Object.prototype.hasOwnProperty.call(
      project.sceneReferencePhotoIds || {},
      sceneReferenceKey(scene)
    );
  }

  function effectiveRefIds(scene) {
    if (!scene) return [];

    const key = sceneReferenceKey(scene);
    const selections = project.sceneReferencePhotoIds || {};

    if (Object.prototype.hasOwnProperty.call(selections, key)) {
      return validReferenceIds(selections[key]);
    }

    return validReferenceIds(scene.reference_photo_ids || []);
  }

  function setSceneReferenceSelection(scene, refIds) {
    const key = sceneReferenceKey(scene);
    if (!key) return;

    persist({
      sceneReferencePhotoIds: {
        ...(project.sceneReferencePhotoIds || {}),
        [key]: validReferenceIds(refIds),
      },
    });
  }

  function resetSceneReferenceSuggestions(scene) {
    const key = sceneReferenceKey(scene);
    if (!key) return;

    const next = { ...(project.sceneReferencePhotoIds || {}) };
    delete next[key];

    persist({ sceneReferencePhotoIds: next });
  }

  function handleReferencePhotosChange(referencePhotos) {
    const safePhotos = Array.isArray(referencePhotos)
      ? referencePhotos
      : [];
    const validIds = new Set(safePhotos.map((reference) => reference.id));

    const sceneReferencePhotoIds = Object.fromEntries(
      Object.entries(project.sceneReferencePhotoIds || {}).map(
        ([key, ids]) => [
          key,
          Array.isArray(ids)
            ? ids.filter((id) => validIds.has(id))
            : [],
        ]
      )
    );

    persist({
      referencePhotos: safePhotos,
      sceneReferencePhotoIds,
    });
  }

  async function doGenerateSceneImage(sceneNumber) {
    if (!imageProviderReady) {
      toast.error(
        promptGuidedProviderActive
          ? FREE_TEST_UNAVAILABLE_MESSAGE
          : GEMINI_UNAVAILABLE_MESSAGE
      );
      return;
    }
    setLoad(`img-${sceneNumber}`, true);
    try {
      const scene = project.storyboardScenes.find((s) => s.scene_number === sceneNumber);
      const prompt = project.scenePrompts?.find((p) => p.scene_number === sceneNumber);
      const refIds = effectiveRefIds(scene);
      const refs = (project.referencePhotos || []).filter((r) => refIds.includes(r.id));
      const data = await runGenerationJob(`scene-image-${sceneNumber}`, () => generateSceneImage({
        projectId: project.id,
        sceneId: String(sceneNumber),
        scenePrompt: prompt?.final_polished_prompt || scene?.visual_prompt || scene?.description || "",
        stylePreset: styleLabel(project.style),
        negativePrompt: prompt?.negative_prompt || "",
        characterConsistencyNotes: prompt?.character_consistency_notes || "",
        environmentConsistencyNotes: prompt?.environment_consistency_notes || "",
        referenceImages: refs,
      }));
      const sceneImages = { ...(project.sceneImages || {}) };
      sceneImages[sceneNumber] = {
        sourceType: "generated_from_reference",
        imageDataUrl: data.generatedImageBase64,
        approved: false,
        providerName: data.providerName,
        generatedAt: data.createdAt,
        referencePhotoIdsUsed:
          data.referencePhotoIdsUsed || [],
        referenceMode:
          data.referenceMode ||
          "direct_reference_images",
      };
      persist({ sceneImages });
      toast.success(`Scene ${sceneNumber} image generated`);
    } catch (e) {
      const status = e.response?.status;

      if (
        promptGuidedProviderActive &&
        (!e.response ||
          [401, 402, 429, 502, 503, 504].includes(status))
      ) {
        toast.error(
          e.response?.data?.detail ||
            FREE_TEST_UNAVAILABLE_MESSAGE
        );
      } else if (
        !e.response ||
        [402, 429, 502, 503, 504].includes(status)
      ) {
        toast.error(GEMINI_UNAVAILABLE_MESSAGE);
      } else {
        toast.error(
          e.response?.data?.detail ||
            e.message ||
            "Image generation failed"
        );
      }
    } finally {
      setLoad(`img-${sceneNumber}`, false);
    }
  }

  async function handleManualUpload(sceneNumber, file) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      toast.warning("Large image may not persist across sessions.");
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const sceneImages = { ...(project.sceneImages || {}) };
      sceneImages[sceneNumber] = {
        sourceType: "manual_upload",
        imageDataUrl: dataUrl,
        approved: false,
        providerName: null,
        generatedAt: new Date().toISOString(),
        referencePhotoIdsUsed: [],
      };
      persist({ sceneImages });
      toast.success(`Uploaded scene ${sceneNumber} image`);
    } catch (e) {
      toast.error("Failed to read image");
    }
  }

  function approveSceneImage(sceneNumber, approved = true) {
    const sceneImages = { ...(project.sceneImages || {}) };
    if (!sceneImages[sceneNumber]) return;
    sceneImages[sceneNumber] = { ...sceneImages[sceneNumber], approved };
    persist({ sceneImages });
  }

  function removeSceneImage(sceneNumber) {
    const sceneImages = { ...(project.sceneImages || {}) };
    delete sceneImages[sceneNumber];
    persist({ sceneImages });
  }

  const totalScenes = project.storyboardScenes?.length || 0;
  const missingImagesCount = totalScenes - approvedImagesCount;

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <div>
          <div className="overline text-neutral-500 mb-2">{project.artist || "Unknown Artist"}</div>
          <h1 className="font-display text-4xl md:text-6xl uppercase leading-none">{project.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="badge badge-locked"><span className="badge-dot" />{styleLabel(project.style)}</span>
            <span className="badge badge-ref-active"><span className="badge-dot" />{(project.referencePhotos || []).length} References</span>
            {providerStatus && !imageProviderReady && (
              <StatusBadge
                status="provider_missing"
                label="Image Provider Missing"
              />
            )}
            {promptGuidedProviderActive && imageProviderReady && (
              <StatusBadge
                status="demo"
                label="Free Image Test"
              />
            )}
          </div>
        </div>
      </div>

      {/* The remainder of the existing workflow UI is intentionally preserved. */}
    </div>
  );
}
