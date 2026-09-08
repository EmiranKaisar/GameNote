import assert from 'node:assert/strict';
import test from 'node:test';
import { createPortableProject, readPortableProject, type ProjectData } from '../lib/project-file.ts';

test('portable project preserves video and annotation data', async () => {
  const project: ProjectData = {
    title: 'Home vs Away',
    projectId: 'project-1',
    createdAt: '2026-09-08T10:00:00.000Z',
    lastPlayheadUs: 2_500_000,
    video: new File([new Uint8Array([1, 2, 3, 4])], 'match.mp4', { type: 'video/mp4' }),
    annotations: [{
      id: 'annotation-1',
      timeUs: 2_500_000,
      note: 'Hold the defensive line.',
      drawing: { coordinateSpace: 'normalized-video-v1', strokes: [{ color: '#ff4d4f', width: 0.006, points: [{ x: 0.25, y: 0.5 }] }] },
      createdAt: '2026-09-08T10:01:00.000Z',
      updatedAt: '2026-09-08T10:01:00.000Z',
    }],
  };

  const portable = createPortableProject(project);
  const reopened = await readPortableProject(new File([portable], 'review.matchproject'));

  assert.equal(reopened.title, project.title);
  assert.equal(reopened.lastPlayheadUs, project.lastPlayheadUs);
  assert.deepEqual(reopened.annotations, project.annotations);
  assert.equal(reopened.video.name, 'match.mp4');
  assert.deepEqual(new Uint8Array(await reopened.video.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
});

test('portable project rejects invalid input', async () => {
  await assert.rejects(() => readPortableProject(new File(['not a project'], 'broken.matchproject')), /not a Game Note project/);
});
