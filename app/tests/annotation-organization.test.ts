import assert from 'node:assert/strict';
import test from 'node:test';
import { addAnnotationAtTop, defaultOrganization, deleteTopic, flattenAnnotationIds, moveOrganizationItem, normalizeOrganization } from '../lib/annotation-organization.ts';
import type { Annotation } from '../lib/project-file.ts';

const annotation = (id: string, timeUs: number): Annotation => ({
  id, timeUs, note: id, drawing: { coordinateSpace: 'normalized-video-v1', strokes: [] }, createdAt: '', updatedAt: '',
});

test('legacy annotations become chronological unassigned root items', () => {
  const organization = defaultOrganization([annotation('late', 20), annotation('early', 10)]);
  assert.deepEqual(organization.rootItems, [{ type: 'annotation', id: 'early' }, { type: 'annotation', id: 'late' }]);
});

test('normalization keeps first visual placement and recovers missing annotations', () => {
  const annotations = [annotation('a', 30), annotation('b', 20), annotation('c', 10)];
  const result = normalizeOrganization(annotations, {
    rootItems: [{ type: 'topic', id: 't' }, { type: 'annotation', id: 'a' }],
    topics: [{ id: 't', name: ' Attack ', annotationIds: ['a', 'b', 'missing'] }],
  });
  assert.equal(result.recovered, true);
  assert.deepEqual(result.organization.topics, [{ id: 't', name: 'Attack', annotationIds: ['a', 'b'] }]);
  assert.deepEqual(result.organization.rootItems, [{ type: 'topic', id: 't' }, { type: 'annotation', id: 'c' }]);
  assert.deepEqual(flattenAnnotationIds(result.organization), ['a', 'b', 'c']);
});

test('new annotations go to the top and deleting a topic promotes its children in place', () => {
  const initial = {
    rootItems: [{ type: 'annotation' as const, id: 'a' }, { type: 'topic' as const, id: 't' }],
    topics: [{ id: 't', name: 'Attack', annotationIds: ['b', 'c'] }],
  };
  const withNew = addAnnotationAtTop(initial, 'd');
  assert.deepEqual(withNew.rootItems[0], { type: 'annotation', id: 'd' });
  assert.deepEqual(deleteTopic(withNew, 't').rootItems, [
    { type: 'annotation', id: 'd' }, { type: 'annotation', id: 'a' }, { type: 'annotation', id: 'b' }, { type: 'annotation', id: 'c' },
  ]);
});

const organized = {
  rootItems: [{ type: 'annotation' as const, id: 'a' }, { type: 'topic' as const, id: 't' }, { type: 'annotation' as const, id: 'd' }],
  topics: [{ id: 't', name: 'Attack', annotationIds: ['b', 'c'] }],
};

test('root drop indexes produce exact before and after ordering', () => {
  assert.deepEqual(moveOrganizationItem(organized, { type: 'annotation', id: 'd' }, { type: 'root', index: 0 }).rootItems.map((item) => item.id), ['d', 'a', 't']);
  assert.deepEqual(moveOrganizationItem(organized, { type: 'annotation', id: 'a' }, { type: 'root', index: 3 }).rootItems.map((item) => item.id), ['t', 'd', 'a']);
  assert.deepEqual(moveOrganizationItem(organized, { type: 'topic', id: 't' }, { type: 'root', index: 3 }).rootItems.map((item) => item.id), ['a', 'd', 't']);
});

test('annotation drops move into, within, and out of topics at exact indexes', () => {
  const into = moveOrganizationItem(organized, { type: 'annotation', id: 'a' }, { type: 'topic-child', topicId: 't', index: 1 });
  assert.deepEqual(into.rootItems.map((item) => item.id), ['t', 'd']);
  assert.deepEqual(into.topics[0].annotationIds, ['b', 'a', 'c']);

  const within = moveOrganizationItem(organized, { type: 'annotation', id: 'b' }, { type: 'topic-child', topicId: 't', index: 2 });
  assert.deepEqual(within.topics[0].annotationIds, ['c', 'b']);

  const out = moveOrganizationItem(organized, { type: 'annotation', id: 'b' }, { type: 'root', index: 2 });
  assert.deepEqual(out.rootItems.map((item) => item.id), ['a', 't', 'b', 'd']);
  assert.deepEqual(out.topics[0].annotationIds, ['c']);
});

test('topics cannot be dropped inside topics', () => {
  assert.equal(moveOrganizationItem(organized, { type: 'topic', id: 't' }, { type: 'topic', topicId: 't' }), organized);
});
