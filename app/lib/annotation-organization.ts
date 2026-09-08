import type { Annotation } from '@/lib/project-file';

export type OrganizationRootItem =
  | { type: 'annotation'; id: string }
  | { type: 'topic'; id: string };

export type AnnotationTopic = {
  id: string;
  name: string;
  annotationIds: string[];
};

export type AnnotationOrganization = {
  rootItems: OrganizationRootItem[];
  topics: AnnotationTopic[];
};

export function defaultOrganization(annotations: Annotation[]): AnnotationOrganization {
  return {
    rootItems: [...annotations]
      .sort((a, b) => a.timeUs - b.timeUs)
      .map(({ id }) => ({ type: 'annotation' as const, id })),
    topics: [],
  };
}

export function normalizeOrganization(
  annotations: Annotation[],
  value: unknown,
): { organization: AnnotationOrganization; recovered: boolean } {
  if (!value || typeof value !== 'object') return { organization: defaultOrganization(annotations), recovered: false };
  const raw = value as { rootItems?: unknown; topics?: unknown };
  if (!Array.isArray(raw.rootItems) || !Array.isArray(raw.topics)) {
    return { organization: defaultOrganization(annotations), recovered: true };
  }

  const annotationIds = new Set(annotations.map(({ id }) => id));
  const seenAnnotations = new Set<string>();
  const seenTopics = new Set<string>();
  let recovered = false;
  const topics: AnnotationTopic[] = [];

  for (const candidate of raw.topics) {
    if (!candidate || typeof candidate !== 'object') { recovered = true; continue; }
    const topic = candidate as { id?: unknown; name?: unknown; annotationIds?: unknown };
    const name = typeof topic.name === 'string' ? topic.name.trim() : '';
    if (typeof topic.id !== 'string' || !topic.id || seenTopics.has(topic.id) || !name || Array.from(name).length > 80 || !Array.isArray(topic.annotationIds)) {
      recovered = true; continue;
    }
    seenTopics.add(topic.id);
    topics.push({ id: topic.id, name, annotationIds: [] });
  }
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const rawTopicById = new Map<string, { annotationIds?: unknown }>();
  for (const candidate of raw.topics) {
    if (candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string') {
      const id = (candidate as { id: string }).id;
      if (!rawTopicById.has(id)) rawTopicById.set(id, candidate as { annotationIds?: unknown });
    }
  }
  const rootItems: OrganizationRootItem[] = [];
  const placedTopics = new Set<string>();

  const placeTopicAnnotations = (topicId: string) => {
    const topic = topicById.get(topicId);
    const rawTopic = rawTopicById.get(topicId);
    if (!topic || !Array.isArray(rawTopic?.annotationIds)) return;
    for (const id of rawTopic.annotationIds) {
      if (typeof id === 'string' && annotationIds.has(id) && !seenAnnotations.has(id)) {
        seenAnnotations.add(id); topic.annotationIds.push(id);
      } else recovered = true;
    }
  };

  for (const candidate of raw.rootItems) {
    if (!candidate || typeof candidate !== 'object') { recovered = true; continue; }
    const item = candidate as { type?: unknown; id?: unknown };
    if (item.type === 'annotation' && typeof item.id === 'string' && annotationIds.has(item.id) && !seenAnnotations.has(item.id)) {
      seenAnnotations.add(item.id); rootItems.push({ type: 'annotation', id: item.id });
    } else if (item.type === 'topic' && typeof item.id === 'string' && topicById.has(item.id) && !placedTopics.has(item.id)) {
      placedTopics.add(item.id); rootItems.push({ type: 'topic', id: item.id }); placeTopicAnnotations(item.id);
    } else recovered = true;
  }

  for (const topic of topics) {
    if (!rootItems.some((item) => item.type === 'topic' && item.id === topic.id)) {
      rootItems.push({ type: 'topic', id: topic.id }); placeTopicAnnotations(topic.id); recovered = true;
    }
  }
  for (const annotation of [...annotations].sort((a, b) => a.timeUs - b.timeUs)) {
    if (!seenAnnotations.has(annotation.id)) {
      rootItems.push({ type: 'annotation', id: annotation.id }); recovered = true;
    }
  }
  return { organization: { rootItems, topics }, recovered };
}

export function flattenAnnotationIds(organization: AnnotationOrganization) {
  const topicById = new Map(organization.topics.map((topic) => [topic.id, topic]));
  return organization.rootItems.flatMap((item) => item.type === 'annotation' ? [item.id] : topicById.get(item.id)?.annotationIds ?? []);
}

export function removeAnnotation(organization: AnnotationOrganization, annotationId: string): AnnotationOrganization {
  return {
    rootItems: organization.rootItems.filter((item) => item.type !== 'annotation' || item.id !== annotationId),
    topics: organization.topics.map((topic) => ({ ...topic, annotationIds: topic.annotationIds.filter((id) => id !== annotationId) })),
  };
}

export function addAnnotationAtTop(organization: AnnotationOrganization, annotationId: string): AnnotationOrganization {
  const clean = removeAnnotation(organization, annotationId);
  return { ...clean, rootItems: [{ type: 'annotation', id: annotationId }, ...clean.rootItems] };
}

export function deleteTopic(organization: AnnotationOrganization, topicId: string): AnnotationOrganization {
  const topic = organization.topics.find((item) => item.id === topicId);
  if (!topic) return organization;
  const index = organization.rootItems.findIndex((item) => item.type === 'topic' && item.id === topicId);
  const rootItems = organization.rootItems.filter((item) => item.type !== 'topic' || item.id !== topicId);
  rootItems.splice(Math.max(0, index), 0, ...topic.annotationIds.map((id) => ({ type: 'annotation' as const, id })));
  return { rootItems, topics: organization.topics.filter((item) => item.id !== topicId) };
}
