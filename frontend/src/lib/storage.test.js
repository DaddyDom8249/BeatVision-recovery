import {
  getProject,
  loadProjects,
  saveProjects,
  updateProject,
  setGenerationJob,
  newProject,
  upsertProject,
} from "./storage";

describe("BeatVision project persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    const running = setGenerationJob(project.id, "storyboard", {
      status: "running",
    });
    expect(running.generationJobs.storyboard.status).toBe("running");
    expect(running.generationJobs.storyboard.id).toBe(
      queued.generationJobs.storyboard.id
    );

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
