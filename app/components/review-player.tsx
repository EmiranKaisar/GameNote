'use client';

import { ChangeEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FilePlus2, FolderOpen, Maximize2, Menu, Pause, PenLine, Play, Redo2, RotateCcw, Save, SkipBack, SkipForward, Trash2, Undo2, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { AnnotationOrganizer } from '@/components/annotation-organizer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { Annotation, createPortableProject, Point, ProjectData, readPortableProject, readProjectFolder, sanitizeAnnotations, saveProjectFolder, Stroke } from '@/lib/project-file';
import { NativeProject, pickAndOpenNativeProject, pickNativeVideo, prepareNativeVideo, runsNatively, saveNativeProject } from '@/lib/native-project';
import { addAnnotationAtTop, AnnotationOrganization, defaultOrganization, flattenAnnotationIds, normalizeOrganization, removeAnnotation } from '@/lib/annotation-organization';

const COLORS = ['#ffffff', '#171717', '#ff4d4f', '#ffd43b', '#49d17d', '#55a7ff'];

type ModelContext = {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute(input: unknown): unknown;
  }, options?: { signal?: AbortSignal }): void | Promise<void>;
};

declare global { interface Document { readonly modelContext?: ModelContext } }

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '00:00';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function emptyDraft(timeUs: number): Annotation {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), timeUs, note: '', drawing: { coordinateSpace: 'normalized-video-v1', strokes: [] }, createdAt: now, updatedAt: now };
}

const clone = (annotation: Annotation) => structuredClone(annotation);

function BrandGlyph() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="1" y="1" width="62" height="62" rx="15" fill="#080D0B"/><g stroke="#CAFF45" strokeWidth="3.5" strokeLinecap="round"><path d="M12 28V17a5 5 0 0 1 5-5h11M36 12h11a5 5 0 0 1 5 5v11M12 36v11a5 5 0 0 0 5 5h11M36 52h11a5 5 0 0 0 5-5V36"/><path d="M18 43c8-10 16-15 27-19"/><path d="m39 22 7 1-3 6"/></g><circle cx="48" cy="20" r="4.5" fill="#FFB33E"/></svg>;
}

export function ReviewPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), stageRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null), projectInputRef = useRef<HTMLInputElement>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const latestHasVideoRef = useRef(false), latestTimeRef = useRef(0);
  const [videoFile, setVideoFile] = useState<File | null>(null), [nativeVideoPath, setNativeVideoPath] = useState<string | null>(null), [nativeProjectDir, setNativeProjectDir] = useState<string | null>(null), [videoUrl, setVideoUrl] = useState(''), [videoMime, setVideoMime] = useState('video/mp4');
  const [title, setTitle] = useState('Untitled review'), [projectId, setProjectId] = useState<string>(() => crypto.randomUUID()), [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [duration, setDuration] = useState(0), [currentTime, setCurrentTime] = useState(0), [playing, setPlaying] = useState(false), [volume, setVolume] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<AnnotationOrganization>(() => defaultOrganization([]));
  const [draft, setDraft] = useState<Annotation | null>(null), [originalDraft, setOriginalDraft] = useState<Annotation | null>(null), [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [penActive, setPenActive] = useState(false), [penColor, setPenColor] = useState(COLORS[2]);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [status, setStatus] = useState('Open a match video to begin reviewing.');
  const [showSidebar, setShowSidebar] = useState(false), [deleted, setDeleted] = useState<{ annotation: Annotation; organization: AnnotationOrganization } | null>(null);

  const selected = useMemo(() => annotations.find((item) => item.id === selectedId) ?? null, [annotations, selectedId]);
  const displayed = draft ?? selected;
  const sorted = useMemo(() => [...annotations].sort((a, b) => a.timeUs - b.timeUs), [annotations]);
  const organized = useMemo(() => { const byId = new Map(annotations.map((item) => [item.id, item])); return flattenAnnotationIds(organization).map((id) => byId.get(id)).filter((item): item is Annotation => Boolean(item)); }, [annotations, organization]);
  const native = runsNatively();
  const hasVideo = Boolean(videoFile || nativeVideoPath);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current, stage = stageRef.current, video = videoRef.current;
    if (!canvas || !stage || !video) return;
    const rect = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, rect.width, rect.height);
    const mediaRatio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    const stageRatio = rect.width / Math.max(rect.height, 1);
    const width = stageRatio > mediaRatio ? rect.height * mediaRatio : rect.width;
    const height = stageRatio > mediaRatio ? rect.height : rect.width / mediaRatio;
    const ox = (rect.width - width) / 2, oy = (rect.height - height) / 2;
    for (const stroke of displayed?.drawing.strokes ?? []) {
      if (!stroke.points.length) continue;
      ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke.color; ctx.lineWidth = Math.max(2, stroke.width * width);
      stroke.points.forEach((point, index) => index ? ctx.lineTo(ox + point.x * width, oy + point.y * height) : ctx.moveTo(ox + point.x * width, oy + point.y * height));
      if (stroke.points.length === 1) ctx.lineTo(ox + stroke.points[0].x * width + .01, oy + stroke.points[0].y * height + .01);
      ctx.stroke();
    }
  }, [displayed]);

  useEffect(() => { drawCanvas(); const observer = new ResizeObserver(drawCanvas); if (stageRef.current) observer.observe(stageRef.current); return () => observer.disconnect(); }, [drawCanvas]);
  useEffect(() => () => { if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  useEffect(() => { latestHasVideoRef.current = hasVideo; latestTimeRef.current = currentTime; }, [hasVideo, currentTime]);
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD && !native) void navigator.serviceWorker.register('/sw.js');
  }, [native]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'add_text_annotation',
      title: 'Add text annotation',
      description: 'Add a saved text note at the current playhead position in the open match video.',
      inputSchema: { type: 'object', properties: { note: { type: 'string', minLength: 1, maxLength: 10000 } }, required: ['note'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const note = typeof input === 'object' && input !== null && 'note' in input ? (input as { note?: unknown }).note : null;
        if (!latestHasVideoRef.current) throw new Error('Open a match video before adding an annotation.');
        if (typeof note !== 'string' || !note.trim() || note.length > 10_000) throw new Error('Note must contain between 1 and 10,000 characters.');
        const annotation = emptyDraft(Math.round(latestTimeRef.current * 1_000_000));
        annotation.note = note.trim();
        setAnnotations((items) => [...items, annotation]);
        setOrganization((current) => addAnnotationAtTop(current, annotation.id));
        setSelectedId(annotation.id);
        setDirty(true);
        setStatus('Text annotation added.');
        return { id: annotation.id, timeUs: annotation.timeUs, saved: true };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const canReplace = () => !dirty || window.confirm('Discard unsaved changes and continue?');
  const loadVideo = (file: File, options?: Partial<ProjectData>) => {
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setNativeVideoPath(null); setNativeProjectDir(null); setVideoFile(file); setVideoUrl(URL.createObjectURL(file)); setVideoMime(file.type || 'video/mp4'); setTitle(options?.title ?? file.name.replace(/\.[^.]+$/, ''));
    setProjectId(options?.projectId ?? crypto.randomUUID()); setCreatedAt(options?.createdAt ?? new Date().toISOString());
    const sanitized = sanitizeAnnotations(options?.annotations ?? []), loadedAnnotations = sanitized.annotations, normalized = normalizeOrganization(loadedAnnotations, options?.organization);
    setAnnotations(loadedAnnotations); setOrganization(normalized.organization); setCurrentTime((options?.lastPlayheadUs ?? 0) / 1_000_000); setSelectedId(null); setDraft(null); setDirty(!options);
    setStatus(options ? sanitized.recovered || normalized.recovered ? 'Project opened. Damaged annotation data was repaired in memory; save to keep the repair.' : 'Project opened.' : 'Video ready. Add a note at any important moment.');
    requestAnimationFrame(() => { if (videoRef.current) videoRef.current.currentTime = (options?.lastPlayheadUs ?? 0) / 1_000_000; });
  };
  const loadNativeVideo = async (path: string, options?: NativeProject) => {
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    const prepared = await prepareNativeVideo(path);
    const filename = path.split(/[\\/]/).at(-1) ?? 'Match video';
    setVideoFile(null); setNativeVideoPath(path); setNativeProjectDir(options?.projectDir ?? null); setVideoUrl(prepared.url); setVideoMime(prepared.mediaType); setTitle(options?.title ?? filename.replace(/\.[^.]+$/, ''));
    setProjectId(options?.projectId ?? crypto.randomUUID()); setCreatedAt(options?.createdAt ?? new Date().toISOString());
    const sanitized = sanitizeAnnotations(options?.annotations ?? []), loadedAnnotations = sanitized.annotations, normalized = normalizeOrganization(loadedAnnotations, options?.organization);
    setAnnotations(loadedAnnotations); setOrganization(normalized.organization); setCurrentTime((options?.lastPlayheadUs ?? 0) / 1_000_000); setSelectedId(null); setDraft(null); setDirty(!options);
    setStatus(options ? sanitized.recovered || normalized.recovered ? 'Project opened. Damaged annotation data was repaired in memory; save to keep the repair.' : 'Project opened.' : 'Video ready. Add a note at any important moment.');
    requestAnimationFrame(() => { if (videoRef.current) videoRef.current.currentTime = (options?.lastPlayheadUs ?? 0) / 1_000_000; });
  };
  const chooseVideo = async () => {
    if (!canReplace()) return;
    if (!native) { videoInputRef.current?.click(); return; }
    try { const path = await pickNativeVideo(); if (path) await loadNativeVideo(path); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'The video could not be opened.'); }
  };
  const onVideoChosen = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (file && canReplace()) loadVideo(file); };
  const onProjectChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !canReplace()) return;
    try { setStatus('Opening project…'); const project = await readPortableProject(file); loadVideo(project.video, project); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'The project could not be opened.'); }
  };
  const openFolder = async () => { if (!canReplace()) return; try { setStatus('Opening project folder…'); if (native) { const project = await pickAndOpenNativeProject(); if (project) await loadNativeVideo(project.videoPath, project); } else { const project = await readProjectFolder(); loadVideo(project.video, project); } } catch (error) { if ((error as DOMException)?.name !== 'AbortError') setStatus(error instanceof Error ? error.message : 'The folder could not be opened.'); } };
  const togglePlayback = async () => { const video = videoRef.current; if (!hasVideo || !video) return; if (video.paused) { setSelectedId(null); await video.play(); } else video.pause(); };
  const seek = (seconds: number) => { const video = videoRef.current; if (!video) return; video.currentTime = Math.min(Math.max(seconds, 0), duration || 0); setCurrentTime(video.currentTime); };

  const startAnnotation = () => {
    if (!hasVideo) return; videoRef.current?.pause();
    const timeUs = Math.round(currentTime * 1_000_000), tolerance = 33_333;
    const existing = annotations.find((item) => Math.abs(item.timeUs - timeUs) <= tolerance);
    setDraft(clone(existing ?? emptyDraft(timeUs))); setOriginalDraft(existing ? clone(existing) : null); setSelectedId(existing?.id ?? null);
    setRedoStack([]); setPenActive(false); setStatus(existing ? 'Editing annotation.' : 'Add a note, a drawing, or both.');
  };
  const finishAnnotation = () => {
    if (!draft) return; const hasContent = draft.note.trim() || draft.drawing.strokes.length;
    if (hasContent) { const saved = { ...draft, note: draft.note.trim(), updatedAt: new Date().toISOString() }; setAnnotations((items) => [...items.filter((item) => item.id !== saved.id), saved]); if (!originalDraft) setOrganization((current) => addAnnotationAtTop(current, saved.id)); setSelectedId(saved.id); setDirty(true); setStatus('Annotation saved to this review.'); }
    else { setSelectedId(null); setStatus('Empty annotation discarded.'); }
    setDraft(null); setOriginalDraft(null); setPenActive(false); setRedoStack([]);
  };
  const cancelAnnotation = () => { setDraft(null); setSelectedId(originalDraft?.id ?? null); setOriginalDraft(null); setPenActive(false); setRedoStack([]); setStatus('Changes canceled.'); };
  const undoStroke = () => { if (!draft?.drawing.strokes.length) return; const strokes = [...draft.drawing.strokes], stroke = strokes.pop(); if (stroke) setRedoStack((items) => [...items, stroke]); setDraft({ ...draft, drawing: { ...draft.drawing, strokes } }); };
  const redoStroke = () => { const stroke = redoStack.at(-1); if (!draft || !stroke) return; setDraft({ ...draft, drawing: { ...draft.drawing, strokes: [...draft.drawing.strokes, stroke] } }); setRedoStack((items) => items.slice(0, -1)); };

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current, video = videoRef.current; if (!canvas || !video) return null;
    const rect = canvas.getBoundingClientRect(), mediaRatio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9, stageRatio = rect.width / Math.max(rect.height, 1);
    const width = stageRatio > mediaRatio ? rect.height * mediaRatio : rect.width, height = stageRatio > mediaRatio ? rect.height : rect.width / mediaRatio;
    const x = (event.clientX - rect.left - (rect.width - width) / 2) / width, y = (event.clientY - rect.top - (rect.height - height) / 2) / height;
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
  };
  const beginStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (!draft || !penActive) return; const point = pointFromEvent(event); if (!point) return; event.currentTarget.setPointerCapture(event.pointerId); const stroke = { color: penColor, width: .006, points: [point] }; currentStrokeRef.current = stroke; setRedoStack([]); setDraft({ ...draft, drawing: { ...draft.drawing, strokes: [...draft.drawing.strokes, stroke] } }); };
  const extendStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => { const stroke = currentStrokeRef.current; if (!draft || !stroke || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = pointFromEvent(event); if (!point) return; stroke.points.push(point); const strokes = [...draft.drawing.strokes]; strokes[strokes.length - 1] = { ...stroke, points: [...stroke.points] }; setDraft({ ...draft, drawing: { ...draft.drawing, strokes } }); };
  const endStroke = () => { currentStrokeRef.current = null; };

  const selectAnnotation = (annotation: Annotation) => { if (draft) return; videoRef.current?.pause(); seek(annotation.timeUs / 1_000_000); setSelectedId(annotation.id); setStatus(`Annotation at ${formatTime(annotation.timeUs / 1_000_000)}.`); };
  const deleteSelected = () => { if (!selected) return; setDeleted({ annotation: selected, organization }); setAnnotations((items) => items.filter((item) => item.id !== selected.id)); setOrganization((current) => removeAnnotation(current, selected.id)); setSelectedId(null); setDirty(true); setStatus('Annotation deleted. Undo is available.'); };
  const restoreDeleted = () => { if (!deleted) return; setAnnotations((items) => [...items, deleted.annotation]); setOrganization(deleted.organization); setSelectedId(deleted.annotation.id); setDeleted(null); setDirty(true); setStatus('Annotation restored.'); };
  const projectData = (): ProjectData | null => videoFile ? { title, projectId, createdAt, annotations: sorted, organization, lastPlayheadUs: Math.round(currentTime * 1_000_000), video: videoFile } : null;
  const downloadProject = (data: ProjectData) => { const url = URL.createObjectURL(createPortableProject(data)), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.replace(/[^a-z0-9 _-]/gi, '_') || 'match-video'}.matchproject`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000); };
  const saveProject = async () => {
    if (!hasVideo) return;
    setSaving(true); setStatus('Saving project…');
    try {
      if (nativeVideoPath) {
        const saved = await saveNativeProject({ sourceVideoPath: nativeVideoPath, title, projectId, createdAt, updatedAt: new Date().toISOString(), annotations: sorted, organization, lastPlayheadUs: Math.round(currentTime * 1_000_000) }, nativeProjectDir);
        if (!saved) { setStatus('Save canceled.'); return; }
        setNativeProjectDir(saved.projectDir); setNativeVideoPath(saved.videoPath);
        setStatus(nativeProjectDir ? 'Project saved.' : `Project folder saved to ${saved.projectDir}.`);
      } else {
        const data = projectData(); if (!data) return;
        const folder = await saveProjectFolder(data); if (!folder) downloadProject(data);
        setStatus(folder ? 'Project folder saved.' : 'Portable project downloaded.');
      }
      setDirty(false);
    } catch (error) { setStatus((error as DOMException)?.name === 'AbortError' ? 'Save canceled.' : error instanceof Error ? error.message : 'The project could not be saved.'); }
    finally { setSaving(false); }
  };
  const exportPortable = () => { const data = projectData(); if (!data) return; downloadProject(data); setDirty(false); setStatus('Portable project downloaded.'); };

  const onKeyDown = (event: KeyboardEvent) => {
    const typing = ['TEXTAREA', 'INPUT'].includes((event.target as HTMLElement).tagName), modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject(); }
    else if (modifier && event.key.toLowerCase() === 'z' && draft && !typing) { event.preventDefault(); if (event.shiftKey) redoStroke(); else undoStroke(); }
    else if (!typing && event.key === ' ') { event.preventDefault(); void togglePlayback(); }
    else if (!typing && event.key.toLowerCase() === 'n') { event.preventDefault(); startAnnotation(); }
    else if (!typing && event.key === 'ArrowLeft') seek(currentTime - 5);
    else if (!typing && event.key === 'ArrowRight') seek(currentTime + 5);
    else if (!typing && event.key === ',') seek(currentTime - 1 / 30);
    else if (!typing && event.key === '.') seek(currentTime + 1 / 30);
    else if (event.key === 'Escape' && draft) cancelAnnotation();
  };
  const adjacent = (direction: -1 | 1) => { if (!organized.length) return; const index = organized.findIndex((item) => item.id === selectedId); selectAnnotation(organized[index < 0 ? (direction > 0 ? 0 : organized.length - 1) : (index + direction + organized.length) % organized.length]); };

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return <main className="review-shell">
    <input ref={videoInputRef} className="sr-only" type="file" accept="video/*,.mkv,.avi,.webm" onChange={onVideoChosen} />
    <input ref={projectInputRef} className="sr-only" type="file" accept=".matchproject,application/x-match-video-project" onChange={onProjectChosen} />
    <header className="app-header">
      <div className="brand-lockup"><div className="brand-mark"><BrandGlyph /></div><div><div className="brand-name">Game Note</div><div className="project-name">{title}{dirty ? ' •' : ''}</div></div></div>
      <nav className="header-actions" aria-label="Project actions">
        <Button variant="ghost" size="lg" onClick={() => void chooseVideo()}><FilePlus2 /><span className="desktop-label">Open video</span></Button>
        <Button variant="ghost" size="lg" onClick={() => projectInputRef.current?.click()}><Upload /><span className="desktop-label">Open file</span></Button>
        {(native || (typeof window !== 'undefined' && window.showDirectoryPicker)) && <Button variant="ghost" size="lg" onClick={() => void openFolder()}><FolderOpen /><span className="desktop-label">Open folder</span></Button>}
        <Button className="save-button" size="lg" disabled={!hasVideo || saving} onClick={() => void saveProject()}><Save />{saving ? 'Saving…' : 'Save'}</Button>
        <Button className="mobile-menu" variant="ghost" size="icon-lg" onClick={() => setShowSidebar((value) => !value)} aria-label="Toggle annotations"><Menu /></Button>
      </nav>
    </header>
    <div className="workspace">
      <section className="player-column" aria-label="Video review workspace">
        <div ref={stageRef} className={`video-stage ${penActive ? 'is-drawing' : ''}`}>
          {videoUrl ? <video key={videoUrl} ref={videoRef} playsInline onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.volume = volume; drawCanvas(); }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); if (selected && Math.abs(event.currentTarget.currentTime - selected.timeUs / 1_000_000) > .05) setSelectedId(null); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={(event) => setStatus(`Video could not be decoded or streamed (media error ${event.currentTarget.error?.code ?? 'unknown'}).`)}><source src={videoUrl} type={videoMime} /><track kind="captions" src="/empty.vtt" srcLang="en" label="Captions" /></video>
            : <button className="empty-stage" onClick={() => void chooseVideo()}><span className="empty-icon"><BrandGlyph /></span><strong>Open a match video</strong><span>MP4, MOV, MKV, AVI, or WebM</span></button>}
          <canvas ref={canvasRef} className="drawing-canvas" aria-label="Drawing layer" onPointerDown={beginStroke} onPointerMove={extendStroke} onPointerUp={endStroke} onPointerCancel={endStroke} />
          {displayed && !draft && <Badge className="overlay-badge">ANNOTATION · {formatTime(displayed.timeUs / 1_000_000)}</Badge>}
        </div>
        <div className="transport-panel">
          <div className="timeline-wrap"><input className="timeline-input" aria-label="Video timeline" type="range" min={0} max={duration || 1} step="any" value={Math.min(currentTime, duration || 1)} disabled={!hasVideo} onChange={(event) => seek(Number(event.target.value))} style={{ '--progress': `${duration ? currentTime / duration * 100 : 0}%` } as React.CSSProperties} /><div className="timeline-markers">{sorted.map((item) => <button key={item.id} aria-label={`Open annotation at ${formatTime(item.timeUs / 1_000_000)}`} onClick={() => selectAnnotation(item)} style={{ left: `${duration ? item.timeUs / 1_000_000 / duration * 100 : 0}%` }} />)}</div></div>
          <div className="transport-row"><div className="transport-group">
            <Button variant="ghost" size="icon-lg" onClick={() => seek(currentTime - 5)} disabled={!hasVideo} aria-label="Back 5 seconds"><SkipBack /></Button>
            <Button className="play-button" size="icon-lg" onClick={() => void togglePlayback()} disabled={!hasVideo} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause /> : <Play className="play-offset" />}</Button>
            <Button variant="ghost" size="icon-lg" onClick={() => seek(currentTime + 5)} disabled={!hasVideo} aria-label="Forward 5 seconds"><SkipForward /></Button>
            <span className="timecode"><strong>{formatTime(currentTime)}</strong><span>/</span>{formatTime(duration)}</span>
          </div><div className="transport-group volume-group">
            <Button variant="ghost" size="icon-lg" disabled={!hasVideo} onClick={() => { const next = volume > 0 ? 0 : 1; setVolume(next); if (videoRef.current) videoRef.current.volume = next; }} aria-label={volume ? 'Mute' : 'Unmute'}>{volume ? <Volume2 /> : <VolumeX />}</Button>
            <input aria-label="Volume" className="volume-slider" type="range" min={0} max={1} step={.05} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (videoRef.current) videoRef.current.volume = next; }} />
            <Button variant="ghost" size="icon-lg" disabled={!hasVideo} onClick={() => stageRef.current?.requestFullscreen()} aria-label="Fullscreen"><Maximize2 /></Button>
          </div></div>
        </div>
        <div className={`annotation-editor ${draft || selected ? 'is-open' : ''}`}>
          <div className="editor-toolbar"><div className="editor-heading"><span className="eyebrow">{draft ? (originalDraft ? 'EDIT ANNOTATION' : 'NEW ANNOTATION') : 'ANNOTATION'}</span><strong>{formatTime((displayed?.timeUs ?? 0) / 1_000_000)}</strong></div>
            {draft ? <div className="drawing-tools"><Toggle pressed={penActive} onPressedChange={setPenActive} variant="outline" size="lg" aria-label="Pen tool"><PenLine />Pen</Toggle><fieldset className="color-palette" aria-label="Pen color">{COLORS.map((color) => <label key={color} className={penColor === color ? 'selected' : ''} style={{ background: color }}><input type="radio" name="pen-color" value={color} checked={penColor === color} aria-label={`Pen color ${color}`} onChange={() => { setPenColor(color); setPenActive(true); }} /></label>)}</fieldset><Button variant="ghost" size="icon-lg" onClick={undoStroke} disabled={!draft.drawing.strokes.length} aria-label="Undo drawing"><Undo2 /></Button><Button variant="ghost" size="icon-lg" onClick={redoStroke} disabled={!redoStack.length} aria-label="Redo drawing"><Redo2 /></Button></div>
              : <Button variant="ghost" size="icon-lg" onClick={() => setSelectedId(null)} aria-label="Close annotation"><X /></Button>}
          </div>
          {displayed && <Textarea aria-label="Annotation note" readOnly={!draft} maxLength={10_000} value={displayed.note} placeholder={draft ? 'What should the team notice at this moment?' : 'No written note'} onChange={(event) => draft && setDraft({ ...draft, note: event.target.value })} />}
          <div className="editor-footer">{draft ? <><span className="char-count">{draft.note.length.toLocaleString()} / 10,000</span><div><Button variant="ghost" size="lg" onClick={cancelAnnotation}>Cancel</Button><Button size="lg" onClick={finishAnnotation}>Done</Button></div></> : selected ? <><Button variant="destructive" size="lg" onClick={deleteSelected}><Trash2 />Delete</Button><Button size="lg" onClick={() => { setDraft(clone(selected)); setOriginalDraft(clone(selected)); }}><PenLine />Edit</Button></> : null}</div>
        </div>
        {!draft && !selected && <div className="quick-actions"><Button className="add-note-button" size="lg" onClick={startAnnotation} disabled={!hasVideo}><PenLine />Add note at {formatTime(currentTime)}</Button><span>Playback pauses while you annotate.</span></div>}
      </section>
      <aside className={`annotation-sidebar ${showSidebar ? 'mobile-open' : ''}`} aria-label="Annotations">
        <div className="sidebar-header"><div><span className="eyebrow">MATCH REVIEW</span><h2>Annotations</h2></div><Badge variant="secondary">{annotations.length}</Badge></div>
        <div className="sidebar-nav"><Button variant="outline" size="icon-lg" onClick={() => adjacent(-1)} disabled={!annotations.length} aria-label="Previous annotation"><ChevronLeft /></Button><Button variant="outline" size="icon-lg" onClick={() => adjacent(1)} disabled={!annotations.length} aria-label="Next annotation"><ChevronRight /></Button><span>Jump between moments</span></div>
        <AnnotationOrganizer key={projectId} annotations={annotations} organization={organization} selectedId={selectedId} hasVideo={hasVideo} onSelect={selectAnnotation} onChange={(next, message) => { setOrganization(next); setDeleted(null); setDirty(true); setStatus(message); }} />
        <div className="sidebar-footer">
          <div className="mobile-project-actions"><Button variant="outline" size="lg" onClick={() => void chooseVideo()}><FilePlus2 />Open video</Button><Button variant="outline" size="lg" onClick={() => projectInputRef.current?.click()}><Upload />Open project</Button></div>
          {videoFile && <Button variant="outline" size="lg" onClick={exportPortable}><Download />Download portable file</Button>}
        </div>
      </aside>
    </div>
    <footer className="status-bar"><span className={`status-dot ${dirty ? 'dirty' : ''}`} /><output aria-live="polite">{status}</output><span className="shortcut-hint"><kbd>Space</kbd> play · <kbd>N</kbd> note · <kbd>⌘/Ctrl S</kbd> save</span>{deleted && <Button variant="ghost" size="sm" onClick={restoreDeleted}><RotateCcw />Undo delete</Button>}</footer>
  </main>;
}
