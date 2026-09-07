import {
  getProject,
  loadProjects,
  saveProjects,
  updateProject,
  newProject,
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
});
