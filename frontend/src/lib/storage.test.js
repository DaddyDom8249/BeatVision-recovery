import {
  getProject,
  loadProjects,
  saveProjects,
  updateProject,
  setGenerationJob,
  newProject,
  upsertProject,
  deleteProject,
} from "./storage";

describe("BeatVision project persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("migrates the legacy project array into the versioned store", () => {
    window.localStorage.setItem(
      "beatvision.projects.v1",
      JSON.stringify([
        {
          id: "legacy-1",
          title: "Legacy Project",
          referencePhotos: [],
        },
      ])
    );

    const projects = loadProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].schemaVersion).toBe(2);
    expect(projects[0].revision).toBe(0);
    expect(projects[0].generationJobs).toEqual({});
  });

  test("updates one project without changing its id", () => {
    const project = newProject({ title: "Revision Test" });
    saveProjects([project]);

    const updated = updateProject(project.id, (current) => ({
      title: "Revision Test Updated",
    }));

    expect(updated.id).toBe(project.id);
    expect(updated.title).toBe("Revision Test Updated");
    expect(updated.revision).toBe(1);
    expect(getProject(project.id).title).toBe("Revision Test Updated");
  });

  test("keeps scene image payloads out of localStorage and restores them from session storage", () => {
    const project = newProject({ title: "Scene Image Storage" });
    const sceneImage = {
      sourceType: "generated_from_reference",
      imageDataUrl: "data:image/png;base64," + "A".repeat(5000),
      approved: true,
      providerName: "Test Provider",
      generatedAt: "2026-09-08T12:00:00.000Z",
      referencePhotoIdsUsed: ["ref-1"],
    };

    saveProjects([
      {
        ...project,
        sceneImages: { "1": sceneImage },
      },
    ]);

    const localStore = window.localStorage.getItem("beatvision.projects.v1");
    const sessionStore = window.sessionStorage.getItem(
      `beatvision.scene-images.v1:${project.id}`
    );

    expect(localStore).not.toContain(sceneImage.imageDataUrl);
    expect(localStore).toContain('"hasImageData":true');
    expect(sessionStore).toContain(sceneImage.imageDataUrl);
    expect(getProject(project.id).sceneImages["1"]).toEqual(sceneImage);
  });

  test("deletes a project's session scene images with the project", () => {
    const project = newProject({ title: "Delete Scene Images" });
    saveProjects([
      {
        ...project,
        sceneImages: {
          "1": {
            imageDataUrl: "data:image/png;base64,test",
            approved: true,
          },
        },
      },
    ]);

    expect(
      window.sessionStorage.getItem(`beatvision.scene-images.v1:${project.id}`)
    ).toBeTruthy();

    deleteProject(project.id);

    expect(
      window.sessionStorage.getItem(`beatvision.scene-images.v1:${project.id}`)
    ).toBeNull();
    expect(getProject(project.id)).toBeNull();
  });

  test("preserves generation job records through normalization", () => {
    const project = newProject({ title: "Job Test" });
    saveProjects([
      {
        ...project,
        generationJobs: {
          storyboard: {
            kind: "storyboard",
            status: "running",
            startedAt: "2026-09-07T12:00:00.000Z",
          },
        },
      },
    ]);

    const stored = getProject(project.id);
    expect(stored.generationJobs.storyboard.id).toBe("storyboard");
    expect(stored.generationJobs.storyboard.status).toBe("running");
    expect(stored.generationJobs.storyboard.attempt).toBe(1);
  });

  test("persists generation job transitions without replacing the project", () => {
    const project = newProject({ title: "Job Lifecycle" });
    saveProjects([project]);

    const queued = setGenerationJob(project.id, "storyboard", {
      status: "queued",
      startedAt: null,
      finishedAt: null,
      error: null,
    });
    expect(queued.generationJobs.storyboard.status).toBe("queued");
    expect(queued.generationJobs.storyboard.attempt).toBe(1);
    expect(queued.generationJobs.storyboard.queuedAt).toBeTruthy();

    const running = setGenerationJob(project.id, "storyboard", {
      status: "running",
    });
    expect(running.generationJobs.storyboard.status).toBe("running");
    expect(running.generationJobs.storyboard.id).toBe(
      queued.generationJobs.storyboard.id
    );
    expect(running.generationJobs.storyboard.attempt).toBe(1);
    expect(running.generationJobs.storyboard.startedAt).toBeTruthy();

    // Simulate the generated storyboard being successfully persisted before
    // the job is allowed to transition to succeeded.
    upsertProject({
      ...running,
      storyboardScenes: [{ scene_number: 1, title: "Persisted Scene" }],
    });

    const finished = setGenerationJob(project.id, "storyboard", {
      status: "succeeded",
      finishedAt: "2026-09-07T12:00:10.000Z",
    });
    expect(finished.id).toBe(project.id);
    expect(finished.generationJobs.storyboard.status).toBe("succeeded");
    expect(finished.generationJobs.storyboard.finishedAt).toBe(
      "2026-09-07T12:00:10.000Z"
    );
    expect(getProject(project.id).generationJobs.storyboard.status).toBe(
      "succeeded"
    );
  });

  test("marks generation failed when the generated result cannot be persisted", () => {
    const project = newProject({ title: "Quota Lifecycle" });
    saveProjects([project]);

    const originalSetItem = window.localStorage.setItem;
    const quotaError = new Error("quota exceeded");
    quotaError.name = "QuotaExceededError";
    window.localStorage.setItem = jest.fn(() => {
      throw quotaError;
    });

    try {
      const queued = setGenerationJob(project.id, "scene-image:1", {
        status: "queued",
      });
      const running = setGenerationJob(project.id, "scene-image:1", {
        status: "running",
      });
      const finished = setGenerationJob(project.id, "scene-image:1", {
        status: "succeeded",
        finishedAt: "2026-09-07T12:00:10.000Z",
      });

      expect(queued.generationJobs["scene-image:1"].status).toBe("queued");
      expect(running.generationJobs["scene-image:1"].status).toBe("running");
      expect(finished.generationJobs["scene-image:1"].status).toBe("failed");
      expect(
        finished.generationJobs["scene-image:1"].error
      ).toBe("Generated result could not be persisted to browser storage.");
      expect(getProject(project.id).generationJobs["scene-image:1"].status).toBe(
        "failed"
      );
      expect(
        getProject(project.id).generationJobs["scene-image:1"].id
      ).toBe(queued.generationJobs["scene-image:1"].id);
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });

  test("starts a new generation attempt with a new job id", () => {
    const project = newProject({ title: "Retry Lifecycle" });
    saveProjects([project]);

    const first = setGenerationJob(project.id, "world-report", {
      status: "queued",
    });
    const firstRunning = setGenerationJob(project.id, "world-report", {
      status: "running",
    });
    const failed = setGenerationJob(project.id, "world-report", {
      status: "failed",
      error: "temporary provider failure",
      finishedAt: "2026-09-07T12:00:10.000Z",
    });

    const retry = setGenerationJob(project.id, "world-report", {
      status: "queued",
    });

    expect(first.generationJobs["world-report"].attempt).toBe(1);
    expect(firstRunning.generationJobs["world-report"].id).toBe(
      first.generationJobs["world-report"].id
    );
    expect(failed.generationJobs["world-report"].status).toBe("failed");
    expect(retry.generationJobs["world-report"].status).toBe("queued");
    expect(retry.generationJobs["world-report"].attempt).toBe(2);
    expect(retry.generationJobs["world-report"].id).not.toBe(
      first.generationJobs["world-report"].id
    );
    expect(retry.generationJobs["world-report"].startedAt).toBeNull();
    expect(retry.generationJobs["world-report"].finishedAt).toBeNull();
    expect(retry.generationJobs["world-report"].error).toBeNull();
  });

  test("merges a stale workflow snapshot without erasing newer fields", () => {
    const project = newProject({ title: "Stale Snapshot" });
    const first = upsertProject(project);

    const staleSnapshot = { ...first, title: "Title Changed By Older Callback" };
    upsertProject({ ...first, notes: "Newer saved result" });

    const merged = upsertProject(staleSnapshot);

    expect(merged.title).toBe("Title Changed By Older Callback");
    expect(merged.notes).toBe("Newer saved result");
    expect(merged.revision).toBe(3);
    expect(getProject(project.id).notes).toBe("Newer saved result");
  });
});
