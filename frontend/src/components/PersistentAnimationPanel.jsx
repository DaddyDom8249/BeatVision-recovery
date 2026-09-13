import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Film, Loader2, Play, RotateCcw, XCircle } from 'lucide-react';
import { getStoredAudioFile } from '@/lib/audioStorage';
import { assemblePersistentVideo, createAnimationJobId, getPersistentAnimation, isPersistentAnimationAvailable, startPersistentAnimation } from '@/lib/persistentAnimation';

const JOB_KEY_PREFIX = 'beatvision:persistent-animation:';
const statusKey = (projectId) => `${JOB_KEY_PREFIX}${projectId}`;
const sceneNumber = (scene, fallback) => Number(scene?.scene_number ?? scene?.scene ?? fallback);

function readSavedJobId(projectId) {
  try { return window.localStorage.getItem(statusKey(projectId)) || ''; } catch { return ''; }
}
function saveJobId(projectId, jobId) {
  try { window.localStorage.setItem(statusKey(projectId), jobId); } catch {}
}
function clearJobId(projectId) {
  try { window.localStorage.removeItem(statusKey(projectId)); } catch {}
}

export default function PersistentAnimationPanel({ project, approvedImagesCount, totalScenes, onProjectPatch }) {
  const [jobId, setJobId] = useState(() => readSavedJobId(project?.id));
  const [job, setJob] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [assembly, setAssembly] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const mounted = useRef(true);

  const scenes = useMemo(() => (project?.storyboardScenes || []).map((scene, index) => ({
    scene: sceneNumber(scene, index + 1),
    duration_seconds: Number(scene?.duration_seconds || 4),
    ...scene,
  })), [project?.storyboardScenes]);

  const images = useMemo(() => scenes.map((scene) => {
    const image = project?.sceneImages?.[scene.scene];
    return {
      scene: scene.scene,
      image_url: image?.imageDataUrl || image?.image_url || image?.url || image?.data_url || '',
      status: image?.approved ? 'approved' : 'unapproved',
    };
  }).filter((image) => image.image_url && image.status === 'approved'), [project?.sceneImages, scenes]);

  const canStart = isPersistentAnimationAvailable() && scenes.length > 0 && images.length === scenes.length && approvedImagesCount === totalScenes;
  const terminal = ['completed', 'partial', 'failed'].includes(String(job?.status || '').toLowerCase());
  const completed = Number(job?.clips?.length || job?.completed || 0);
  const failed = Number(job?.failed?.length || job?.failed_count || 0);
  const total = Number(job?.scenes?.length || scenes.length || totalScenes || 0);
  const currentScene = Number(job?.active_scene || job?.index + 1 || 1);

  useEffect(() => {
    mounted.current = true;
    getStoredAudioFile(project?.id).then((file) => { if (mounted.current && file) setAudioFile(file); }).catch(() => {});
    return () => { mounted.current = false; };
  }, [project?.id]);

  useEffect(() => {
    if (!jobId || !isPersistentAnimationAvailable()) return undefined;
    let cancelled = false;
    async function recover() {
      try {
        const current = await getPersistentAnimation(jobId);
        if (cancelled || !mounted.current) return;
        setJob(current);
        if (['completed', 'partial', 'failed'].includes(String(current?.status || '').toLowerCase())) {
          setPhase(String(current.status).toLowerCase() === 'completed' ? 'completed' : 'error');
          return;
        }
        setPhase('running');
      } catch (e) {
        if (!cancelled && mounted.current) setError(e.message || 'Persistent animation status could not be recovered.');
      }
    }
    recover();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    if (!jobId || phase !== 'running') return undefined;
    let cancelled = false;
    let timer = null;
    async function poll() {
      try {
        const current = await getPersistentAnimation(jobId);
        if (cancelled || !mounted.current) return;
        setJob(current);
        const status = String(current?.status || '').toLowerCase();
        if (status === 'completed') {
          setPhase('assembling');
          try {
            const result = await assemblePersistentVideo({ animation: current, audioFile, audioDuration: project?.audio?.duration, analysisDuration: project?.audioAnalysis?.duration_seconds });
            if (cancelled || !mounted.current) return;
            setAssembly(result?.result || result);
            setPhase('completed');
            onProjectPatch?.({ persistentAnimationJobId: jobId, persistentAnimationStatus: 'completed', persistentAnimationResult: result?.result || result });
          } catch (assemblyError) {
            if (!cancelled && mounted.current) { setError(assemblyError.message || 'Video assembly failed.'); setPhase('error'); }
          }
          return;
        }
        if (status === 'partial' || status === 'failed') { setPhase('error'); setError(`Animation finished with status ${status}. ${current?.failed?.length || 0} scene(s) failed.`); return; }
        timer = window.setTimeout(poll, 5000);
      } catch (e) {
        if (!cancelled && mounted.current) { setError(e.message || 'Persistent animation status could not be read.'); timer = window.setTimeout(poll, 5000); }
      }
    }
    poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [jobId, phase, audioFile, project?.audio?.duration, project?.audioAnalysis?.duration_seconds, onProjectPatch]);

  async function handleStart() {
    if (!canStart || phase === 'running' || phase === 'assembling') return;
    setError(''); setAssembly(null);
    const nextJobId = jobId && !terminal ? jobId : createAnimationJobId(project.id);
    try {
      setJobId(nextJobId); saveJobId(project.id, nextJobId); setPhase('running');
      const initial = await startPersistentAnimation({ jobId: nextJobId, storyboard: { scenes }, images: { images } });
      if (!mounted.current) return;
      setJob(initial);
      onProjectPatch?.({ persistentAnimationJobId: nextJobId, persistentAnimationStatus: initial?.status || 'queued' });
    } catch (e) {
      setPhase('error'); setError(e.message || 'Persistent animation could not be started.');
    }
  }

  function handleReset() {
    clearJobId(project.id); setJobId(''); setJob(null); setAssembly(null); setError(''); setPhase('idle');
    onProjectPatch?.({ persistentAnimationJobId: null, persistentAnimationStatus: null, persistentAnimationResult: null });
  }

  if (!isPersistentAnimationAvailable()) return null;

  return <div className="bv-card p-5 mt-5" data-testid="persistent-animation-panel">
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <div className="overline text-[#34D399]">Persistent Animation Pipeline</div>
        <h3 className="font-display text-xl mt-1 uppercase">Arena Motion Engine</h3>
        <p className="font-body text-sm text-neutral-400 mt-2">Scenes run on the server-side persistent job. Leaving or refreshing this page does not restart completed scenes.</p>
      </div>
      {phase === 'running' || phase === 'assembling' ? <Loader2 className="w-5 h-5 animate-spin text-[#E5B83B]" /> : phase === 'completed' ? <CheckCircle2 className="w-5 h-5 text-[#34D399]" /> : <Film className="w-5 h-5 text-neutral-500" />}
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="border border-white/5 p-3"><div className="overline text-neutral-600">Scene</div><div className="font-mono text-lg mt-1">{currentScene}</div></div>
      <div className="border border-white/5 p-3"><div className="overline text-neutral-600">Total</div><div className="font-mono text-lg mt-1">{total}</div></div>
      <div className="border border-white/5 p-3"><div className="overline text-neutral-600">Completed</div><div className="font-mono text-lg mt-1 text-[#34D399]">{completed}</div></div>
      <div className="border border-white/5 p-3"><div className="overline text-neutral-600">Failed</div><div className="font-mono text-lg mt-1 text-[#F87171]">{failed}</div></div>
    </div>

    {(phase === 'running' || phase === 'assembling') && <div className="mb-5"><div className="flex justify-between text-xs font-mono text-neutral-500 mb-2"><span>{phase === 'assembling' ? 'Assembly' : 'Persistent animation status: running'}</span><span>{total ? Math.round((completed / total) * 100) : 0}%</span></div><div className="h-2 bg-neutral-900 overflow-hidden"><div className="h-full bg-[#E5B83B] transition-[width] duration-500" style={{ width: `${total ? Math.min(100, (completed / total) * 100) : 0}%` }} /></div></div>}

    {error && <div className="mb-4 p-3 border border-[#F87171]/30 bg-[#EF4444]/5 text-sm text-[#FCA5A5] flex gap-2"><XCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

    {assembly?.video_url && <div className="mb-5 space-y-3"><div className="overline text-[#34D399]">Pipeline Complete</div><video controls playsInline src={assembly.video_url} className="w-full aspect-video bg-black border border-white/10" /><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono text-neutral-400"><div><span className="block text-neutral-600">Duration</span>{Number(assembly.duration_seconds || 0).toFixed(2)}s</div><div><span className="block text-neutral-600">Source clips</span>{assembly.source_clips || completed}</div><div><span className="block text-neutral-600">Timeline clips</span>{assembly.timeline_clips || '-'}</div><div><span className="block text-neutral-600">Audio</span>{assembly.source_audio ? 'Included' : 'Missing'}</div></div><a href={assembly.video_url} target="_blank" rel="noreferrer" className="btn-gold inline-flex items-center gap-2"><Film className="w-4 h-4" /> Open final MP4</a></div>}

    <div className="flex flex-wrap gap-2">
      {phase === 'idle' || phase === 'error' || phase === 'completed' ? <button type="button" className="btn-gold inline-flex items-center gap-2" onClick={handleStart} disabled={!canStart}><Play className="w-4 h-4" /> {phase === 'completed' ? 'Run Again' : 'Start Persistent Animation'}</button> : null}
      {jobId ? <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={handleReset} disabled={phase === 'running' || phase === 'assembling'}><RotateCcw className="w-4 h-4" /> Clear Job Record</button> : null}
    </div>

    {!canStart && !jobId && <p className="mt-3 text-xs font-mono text-neutral-600">Requires every storyboard scene to have an approved image and a configured provider gateway.</p>}
  </div>;
}