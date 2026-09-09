import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STYLE_PRESETS } from "@/lib/constants";
import { newProject, upsertProject, StorageQuotaError } from "@/lib/storage";
import { saveStoredAudioFile, validateAudioFile } from "@/lib/audioStorage";
import ReferencePhotoUploader from "@/components/ReferencePhotoUploader";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function CreateProject() {
  const nav = useNavigate();
  const [form, setForm] = useState({ title: "", artist: "", lyrics: "", notes: "", style: "dark_cinematic_surreal", referencePhotos: [] });
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleAudioChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setAudioError("");
    setAudioDuration(0);
    setAudioFile(null);
    if (!file) return;
    try { validateAudioFile(file); } catch (error) { setAudioError(error.message); toast.error(error.message); return; }
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0); URL.revokeObjectURL(objectUrl); };
    audio.onerror = () => { URL.revokeObjectURL(objectUrl); setAudioError("The audio file could not be read by this browser."); };
    audio.src = objectUrl;
    setAudioFile(file);
  }

  function removeAudio() { setAudioFile(null); setAudioDuration(0); setAudioError(""); }

  async function handleReveal() {
    if (!form.title.trim()) { toast.error("Please enter a song title"); return; }
    if (isSaving) return;
    setIsSaving(true);
    try {
      const project = newProject(form);
      const saved = upsertProject(project);
      if (audioFile) {
        try {
          const metadata = await saveStoredAudioFile(saved.id, audioFile, { duration: audioDuration });
          const updated = upsertProject({ ...saved, audio: { name: metadata.name, type: metadata.type, size: metadata.size, duration: metadata.duration, lastModified: metadata.lastModified, storageType: metadata.storageType, persistence: "local" } });
          toast.success("Project created with song audio saved");
          nav(`/project/${updated.id}`);
          return;
        } catch (error) {
          console.error(error);
          toast.error(`Project created, but the song audio could not be saved: ${error.message}`);
          nav(`/project/${saved.id}`);
          return;
        }
      }
      toast.success("Project created");
      nav(`/project/${saved.id}`);
    } catch (error) {
      console.error(error);
      if (error instanceof StorageQuotaError || error?.code === "BEATVISION_STORAGE_QUOTA") { toast.error("Browser storage is full. Remove large reference or scene images before adding more."); return; }
      toast.error("Could not save project to browser storage.");
    } finally { setIsSaving(false); }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-12 md:py-16">
      <div className="mb-10">
        <div className="overline text-neutral-500 mb-2">New Project</div>
        <h1 className="font-display text-4xl md:text-5xl uppercase leading-none">Reveal a <span className="font-serif-italic italic font-normal">world.</span></h1>
        <p className="mt-3 font-body text-neutral-400 max-w-2xl">Give BeatVision a song, a style, and optional reference photos. It will build the world, storyboard, and scene prompts. You approve every step.</p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="bv-label">Song Title *</label><input className="bv-input" placeholder="e.g. Wolves in the Rain" value={form.title} onChange={(e) => set("title", e.target.value)} data-testid="create-title" /></div>
          <div><label className="bv-label">Artist Name</label><input className="bv-input" placeholder="e.g. Nara Kova" value={form.artist} onChange={(e) => set("artist", e.target.value)} data-testid="create-artist" /></div>
        </div>

        <div>
          <label className="bv-label">Song Audio</label>
          <div className="text-xs text-neutral-500 font-body mb-3">Upload the song here with the title and lyrics. MP3, WAV, M4A, AAC, OGG, or FLAC, maximum 25 MB. The audio is stored locally with this project for later export.</div>
          <input data-testid="create-audio-select" className="block w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={handleAudioChange} />
          {audioFile && <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium truncate">{audioFile.name}</p><p className="text-xs text-neutral-500">{(audioFile.size / 1024 / 1024).toFixed(2)} MB{audioDuration ? ` • ${Math.round(audioDuration)} sec` : ""}</p></div><button type="button" className="text-sm underline shrink-0" onClick={removeAudio}>Remove</button></div>}
          {audioError && <p className="text-sm text-red-400 mt-2">{audioError}</p>}
        </div>

        <div><label className="bv-label">Lyrics</label><textarea className="bv-textarea" rows={8} placeholder="Paste your lyrics here..." value={form.lyrics} onChange={(e) => set("lyrics", e.target.value)} data-testid="create-lyrics" /></div>
        <div><label className="bv-label">Creator Notes (optional)</label><textarea className="bv-textarea" rows={3} placeholder="Tone, memories, references, forbidden imagery..." value={form.notes} onChange={(e) => set("notes", e.target.value)} data-testid="create-notes" /></div>
        <div><label className="bv-label">Style Preset</label><select className="bv-select" value={form.style} onChange={(e) => set("style", e.target.value)} data-testid="create-style">{STYLE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label className="bv-label">Reference Photos (optional)</label><div className="text-xs text-neutral-500 font-body mb-3">Upload photos of your main character, environment, wardrobe, symbols, and mood. These influence the world report, prompts, and scene image generation.</div><ReferencePhotoUploader photos={form.referencePhotos} onChange={(photos) => set("referencePhotos", photos)} testidPrefix="create-ref" /></div>
        <div className="pt-6 border-t border-white/5"><button type="button" disabled={isSaving} className="btn-gold inline-flex items-center gap-2 text-base px-6 py-3 disabled:opacity-60" onClick={handleReveal} data-testid="create-reveal-btn"><Sparkles className="w-4 h-4" /> {isSaving ? "Saving…" : "Reveal World"}</button></div>
      </div>
    </div>
  );
}
