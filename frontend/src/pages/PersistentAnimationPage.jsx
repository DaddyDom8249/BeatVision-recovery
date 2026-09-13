import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, upsertProject } from '@/lib/storage';
import PersistentAnimationPanel from '@/components/PersistentAnimationPanel';
import Layout from '@/components/Layout';

export default function PersistentAnimationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);

  useEffect(() => {
    const current = getProject(id);
    if (!current) { navigate('/dashboard'); return; }
    setProject(current);
  }, [id, navigate]);

  if (!project) return null;

  function patchProject(patch) {
    const next = { ...project, ...patch };
    setProject(next);
    try { upsertProject(next); } catch (error) { console.error('Persistent animation project persistence failed', error); }
  }

  return <Layout>
    <main className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="mb-8">
        <div className="overline text-neutral-500">BeatVision / Motion Production</div>
        <h1 className="font-display text-4xl md:text-5xl uppercase mt-2">Persistent Animation</h1>
        <p className="font-body text-neutral-400 mt-3 max-w-3xl">{project.title || 'Untitled project'} · Server-persistent scene animation followed by real MP4 assembly.</p>
      </div>
      <PersistentAnimationPanel project={project} approvedImagesCount={Object.values(project.sceneImages || {}).filter((s) => s?.approved).length} totalScenes={(project.storyboardScenes || []).length} onProjectPatch={patchProject} />
      <button type="button" className="btn-ghost mt-6" onClick={() => navigate(`/project/${id}`)}>Back to Project Workflow</button>
    </main>
  </Layout>;
}