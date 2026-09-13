const GATEWAY_URL = String(process.env.REACT_APP_PROVIDER_GATEWAY_URL || '').replace(/\/$/, '');

function requireGateway() {
  if (!GATEWAY_URL) {
    const error = new Error('BeatVision provider gateway is not configured.');
    error.code = 'BEATVISION_GATEWAY_UNAVAILABLE';
    throw error;
  }
  return GATEWAY_URL;
}

function requestHeaders(requestId) {
  const headers = { 'Content-Type': 'application/json', 'X-BeatVision-Contract': '1.1', 'X-BeatVision-Request': requestId };
  const token = process.env.REACT_APP_PROVIDER_GATEWAY_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gatewayFetch(path, options = {}) {
  const response = await fetch(`${requireGateway()}${path}`, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(String(data?.error || data?.detail || `BeatVision gateway returned HTTP ${response.status}`));
  return data;
}

export function isPersistentAnimationAvailable() { return Boolean(GATEWAY_URL); }

export function createAnimationJobId(projectId) {
  const safeProject = String(projectId || 'project').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `beatvision-${safeProject}-${random}`;
}

export async function startPersistentAnimation({ jobId, storyboard, images }) {
  if (!jobId) throw new Error('A persistent animation job ID is required.');
  return gatewayFetch(`/v1/video/animate/jobs/${encodeURIComponent(jobId)}`, {
    method: 'POST',
    headers: requestHeaders(jobId),
    body: JSON.stringify({ contract_version: '1.1', operation: 'animate', job_id: jobId, storyboard, images })
  });
}

export async function getPersistentAnimation(jobId) {
  return gatewayFetch(`/v1/video/animate/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: requestHeaders(jobId)
  });
}

export async function waitForPersistentAnimation(jobId, { onStatus, intervalMs = 5000, signal } = {}) {
  let latest = await getPersistentAnimation(jobId);
  if (onStatus) onStatus(latest);
  while (!['completed', 'partial', 'failed'].includes(String(latest?.status || '').toLowerCase())) {
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs);
      if (signal) {
        if (signal.aborted) { window.clearTimeout(timer); reject(new DOMException('Animation polling cancelled.', 'AbortError')); return; }
        signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Animation polling cancelled.', 'AbortError')); }, { once: true });
      }
    });
    latest = await getPersistentAnimation(jobId);
    if (onStatus) onStatus(latest);
  }
  if (String(latest.status).toLowerCase() !== 'completed') throw new Error(`Persistent animation finished with status ${latest.status}. Failed scenes: ${latest.failed?.length || 0}.`);
  return latest;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('The selected audio file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function assemblePersistentVideo({ animation, audioFile, audioDuration, analysisDuration }) {
  const jobId = animation?.job_id || 'beatvision-assembly';
  const audioBase64 = audioFile ? await fileToDataUrl(audioFile) : null;
  const payload = {
    motion: { clips: Array.isArray(animation?.clips) ? animation.clips : [] },
    audio: { duration_seconds: Number(audioDuration || analysisDuration || 0) || undefined },
    ...(audioBase64 ? { audio_base64: audioBase64 } : {})
  };
  return gatewayFetch('/v1/video/assemble', {
    method: 'POST',
    headers: requestHeaders(jobId),
    body: JSON.stringify({ contract_version: '1.1', operation: 'assemble', payload })
  });
}

export { GATEWAY_URL };