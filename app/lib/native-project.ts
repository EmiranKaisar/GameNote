import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Annotation } from '@/lib/project-file';

export type NativeProject = {
  title: string;
  projectId: string;
  createdAt: string;
  lastPlayheadUs: number;
  annotations: Annotation[];
  videoPath: string;
};

export type NativeSaveData = Omit<NativeProject, 'videoPath'> & {
  sourceVideoPath: string;
  updatedAt: string;
};

export const runsNatively = () => isTauri();
export const nativeVideoUrl = (path: string) => convertFileSrc(path);

export async function pickNativeVideo() {
  const result = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] }],
  });
  return typeof result === 'string' ? result : null;
}

export async function pickAndOpenNativeProject() {
  const result = await open({ multiple: false, directory: true });
  if (typeof result !== 'string') return null;
  return invoke<NativeProject>('open_project', { projectDir: result });
}

export async function saveNativeProject(data: NativeSaveData) {
  const destination = await open({ multiple: false, directory: true });
  if (typeof destination !== 'string') return null;
  return invoke<string>('save_project', { ...data, destinationDir: destination });
}
