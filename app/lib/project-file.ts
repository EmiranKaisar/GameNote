export type Point = { x: number; y: number };
export type Stroke = { color: string; width: number; points: Point[] };
export type Annotation = {
  id: string;
  timeUs: number;
  frameIndex?: number;
  note: string;
  drawing: { coordinateSpace: 'normalized-video-v1'; strokes: Stroke[] };
  createdAt: string;
  updatedAt: string;
};
export type ProjectData = {
  title: string;
  projectId: string;
  createdAt: string;
  lastPlayheadUs: number;
  annotations: Annotation[];
  video: File;
};

type ProjectHeader = {
  manifest: {
    format: 'match-video-project';
    schemaVersion: 1;
    projectId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    video: { path: string; originalFilename: string; size: number; type: string };
    annotationsPath: 'annotations.json';
    lastPlayheadUs: number;
  };
  annotations: { schemaVersion: 1; annotations: Annotation[] };
};

const MAGIC = new TextEncoder().encode('MVPJ0001');

function safeName(name: string) {
  const sanitized = Array.from(name, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || '\\/:*?"<>|'.includes(character) ? '_' : character;
  }).join('');
  return sanitized.trim() || 'match-video';
}

function createHeader(data: ProjectData): ProjectHeader {
  const videoName = safeName(data.video.name);
  return {
    manifest: {
      format: 'match-video-project', schemaVersion: 1, projectId: data.projectId,
      title: data.title, createdAt: data.createdAt, updatedAt: new Date().toISOString(),
      video: { path: `video/${videoName}`, originalFilename: videoName, size: data.video.size, type: data.video.type || 'application/octet-stream' },
      annotationsPath: 'annotations.json', lastPlayheadUs: data.lastPlayheadUs,
    },
    annotations: { schemaVersion: 1, annotations: data.annotations },
  };
}

export function createPortableProject(data: ProjectData) {
  const header = new TextEncoder().encode(JSON.stringify(createHeader(data)));
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, header.byteLength, true);
  return new Blob([MAGIC, size, header, data.video], { type: 'application/x-match-video-project' });
}

function validateHeader(header: ProjectHeader) {
  if (header?.manifest?.format !== 'match-video-project' || header.manifest.schemaVersion !== 1 ||
      header.annotations?.schemaVersion !== 1 || !Array.isArray(header.annotations.annotations) ||
      typeof header.manifest.title !== 'string' || typeof header.manifest.video?.size !== 'number') {
    throw new Error('This project version is unsupported or damaged.');
  }
}

export async function readPortableProject(file: File): Promise<ProjectData> {
  if (file.size < 12) throw new Error('This project file is incomplete.');
  const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!MAGIC.every((byte, index) => prefix[index] === byte)) throw new Error('This is not a Touchline project.');
  const headerSize = new DataView(prefix.buffer).getUint32(8, true);
  if (headerSize < 2 || headerSize > 16_000_000 || 12 + headerSize > file.size) throw new Error('The project metadata is invalid.');
  const header = JSON.parse(await file.slice(12, 12 + headerSize).text()) as ProjectHeader;
  validateHeader(header);
  const videoBlob = file.slice(12 + headerSize);
  if (videoBlob.size !== header.manifest.video.size) throw new Error('The video is missing or does not match this project.');
  return {
    title: header.manifest.title, projectId: header.manifest.projectId,
    createdAt: header.manifest.createdAt, lastPlayheadUs: header.manifest.lastPlayheadUs,
    annotations: header.annotations.annotations,
    video: new File([videoBlob], header.manifest.video.originalFilename, { type: header.manifest.video.type }),
  };
}

type Writable = { write(data: Blob | string): Promise<void>; close(): Promise<void> };
type FileHandle = { getFile(): Promise<File>; createWritable(): Promise<Writable> };
type DirectoryHandle = {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
};
declare global { interface Window { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle> } }

async function writeFile(handle: FileHandle, data: Blob | string) {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function saveProjectFolder(data: ProjectData) {
  if (!window.showDirectoryPicker) return false;
  const root = await window.showDirectoryPicker({ mode: 'readwrite' });
  const folder = await root.getDirectoryHandle(`${safeName(data.title)}.matchproject`, { create: true });
  const videoFolder = await folder.getDirectoryHandle('video', { create: true });
  const header = createHeader(data);
  await writeFile(await folder.getFileHandle('manifest.json', { create: true }), JSON.stringify(header.manifest, null, 2));
  await writeFile(await folder.getFileHandle('annotations.json', { create: true }), JSON.stringify(header.annotations, null, 2));
  await writeFile(await videoFolder.getFileHandle(header.manifest.video.originalFilename, { create: true }), data.video);
  return true;
}

export async function readProjectFolder(): Promise<ProjectData> {
  if (!window.showDirectoryPicker) throw new Error('Folder opening is unavailable in this browser.');
  const folder = await window.showDirectoryPicker({ mode: 'read' });
  const manifest = JSON.parse(await (await (await folder.getFileHandle('manifest.json')).getFile()).text()) as ProjectHeader['manifest'];
  const annotations = JSON.parse(await (await (await folder.getFileHandle('annotations.json')).getFile()).text()) as ProjectHeader['annotations'];
  validateHeader({ manifest, annotations });
  const videoFolder = await folder.getDirectoryHandle('video');
  const video = await (await videoFolder.getFileHandle(manifest.video.originalFilename)).getFile();
  if (video.size !== manifest.video.size) throw new Error('The video does not match this project.');
  return { title: manifest.title, projectId: manifest.projectId, createdAt: manifest.createdAt, lastPlayheadUs: manifest.lastPlayheadUs, annotations: annotations.annotations, video };
}
