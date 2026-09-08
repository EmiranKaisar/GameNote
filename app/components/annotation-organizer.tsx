'use client';

import { CSS } from '@dnd-kit/utilities';
import { DndContext, DragEndEvent, DragOverlay, DragOverEvent, DraggableAttributes, DraggableSyntheticListeners, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, PenLine, Plus, Trash2 } from 'lucide-react';
import { KeyboardEvent, Ref, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Annotation } from '@/lib/project-file';
import { AnnotationOrganization, deleteTopic } from '@/lib/annotation-organization';

const annotationDragId = (id: string) => `annotation:${id}`;
const topicDragId = (id: string) => `topic:${id}`;
const topicContainerId = (id: string) => `topic-container:${id}`;
const ROOT_CONTAINER = 'root-container';

function parseDragId(value: string) {
  const separator = value.indexOf(':');
  return { kind: separator < 0 ? value : value.slice(0, separator), id: separator < 0 ? '' : value.slice(separator + 1) };
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

type ChangeHandler = (organization: AnnotationOrganization, message: string) => void;

function DragHandle({ attributes, listeners, label, handleRef }: { attributes: DraggableAttributes; listeners?: DraggableSyntheticListeners; label: string; handleRef?: Ref<HTMLButtonElement> }) {
  return <button ref={handleRef} className="drag-handle" aria-label={label} {...attributes} {...listeners}><GripVertical /></button>;
}

function AnnotationRow({ annotation, selected, onSelect, nested = false, insertion }: { annotation: Annotation; selected: boolean; onSelect: () => void; nested?: boolean; insertion?: 'before' | 'after' }) {
  const id = annotationDragId(annotation.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, data: { kind: 'annotation', annotationId: annotation.id } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`annotation-card ${nested ? 'nested' : ''} ${selected ? 'selected' : ''} ${isDragging ? 'is-dragging' : ''} ${insertion ? `insert-${insertion}` : ''}`}>
    <DragHandle handleRef={setActivatorNodeRef} label="Drag annotation" attributes={attributes} listeners={listeners} />
    <button className="annotation-card-main" onClick={onSelect}>
      <span className="card-body"><strong>{formatTime(annotation.timeUs / 1_000_000)}</strong><span>{annotation.note || `${annotation.drawing.strokes.length} drawing stroke${annotation.drawing.strokes.length === 1 ? '' : 's'}`}</span></span>
      <ChevronRight />
    </button>
  </div>;
}

function TopicBlock({ topic, annotations, selectedId, collapsed, dropActive, editing, insertion, onToggle, onSelect, onRename, onStartRename, onCancelRename, onDelete }: {
  topic: AnnotationOrganization['topics'][number]; annotations: Map<string, Annotation>; selectedId: string | null;
  collapsed: boolean; dropActive: boolean; editing: boolean; insertion?: 'before' | 'after'; onToggle: () => void; onSelect: (annotation: Annotation) => void;
  onRename: (name: string) => void; onStartRename: () => void; onCancelRename: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: topicDragId(topic.id), data: { kind: 'topic', topicId: topic.id } });
  const { setNodeRef: setContainerRef } = useDroppable({ id: topicContainerId(topic.id), data: { kind: 'topic-container', topicId: topic.id } });
  const [name, setName] = useState(topic.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { nameInputRef.current?.focus(); nameInputRef.current?.select(); } }, [editing]);
  const submitName = () => { const trimmed = name.trim(); if (trimmed && Array.from(trimmed).length <= 80) onRename(trimmed); else { setName(topic.name); onCancelRename(); } };
  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); submitName(); }
    if (event.key === 'Escape') { event.preventDefault(); setName(topic.name); onCancelRename(); }
  };
  return <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`topic-block ${dropActive ? 'annotation-drop-active' : ''} ${isDragging ? 'is-dragging' : ''} ${insertion ? `insert-${insertion}` : ''}`}>
    <div className="topic-header">
      <button ref={setActivatorNodeRef} className="drag-handle" aria-label={`Drag topic ${topic.name}`} {...attributes} {...listeners}><GripVertical /></button>
      <button className="topic-collapse" onClick={onToggle} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${topic.name}`}>{collapsed ? <ChevronRight /> : <ChevronDown />}</button>
      {editing ? <input ref={nameInputRef} className="topic-name-input" value={name} onChange={(event) => setName(event.target.value)} onBlur={submitName} onKeyDown={onNameKeyDown} /> : <strong className="topic-name">{topic.name}</strong>}
      <span className="topic-count">{topic.annotationIds.length}</span>
      <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${topic.name}`} />}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onStartRename}>Rename</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />Delete topic</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <div ref={setContainerRef} className={`topic-children ${collapsed ? 'collapsed' : ''}`}>
      {!collapsed && <SortableContext items={topic.annotationIds.map(annotationDragId)} strategy={verticalListSortingStrategy}>
        {topic.annotationIds.map((id) => annotations.get(id)).filter((item): item is Annotation => Boolean(item)).map((annotation) => <AnnotationRow key={annotation.id} nested annotation={annotation} selected={selectedId === annotation.id} onSelect={() => onSelect(annotation)} />)}
        {!topic.annotationIds.length && <div className="topic-empty">Drop an annotation here</div>}
      </SortableContext>}
    </div>
  </section>;
}

export function AnnotationOrganizer({ annotations, organization, selectedId, hasVideo, onSelect, onChange }: {
  annotations: Annotation[]; organization: AnnotationOrganization; selectedId: string | null; hasVideo: boolean;
  onSelect: (annotation: Annotation) => void; onChange: ChangeHandler;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTopicId, setOverTopicId] = useState<string | null>(null);
  const [topicInsertion, setTopicInsertion] = useState<{ type: 'topic' | 'annotation'; id: string; edge: 'before' | 'after' } | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const annotationById = useMemo(() => new Map(annotations.map((annotation) => [annotation.id, annotation])), [annotations]);
  const topicById = useMemo(() => new Map(organization.topics.map((topic) => [topic.id, topic])), [organization.topics]);
  const { setNodeRef: setRootRef } = useDroppable({ id: ROOT_CONTAINER, data: { kind: 'root-container' } });
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));

  useEffect(() => { if (creating) createInputRef.current?.focus(); }, [creating]);
  useEffect(() => {
    if (!selectedId) return;
    const topic = organization.topics.find((item) => item.annotationIds.includes(selectedId));
    if (!topic) return;
    const timer = window.setTimeout(() => setCollapsed((items) => { if (!items.has(topic.id)) return items; const next = new Set(items); next.delete(topic.id); return next; }), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, organization.topics]);

  const createTopic = () => { const name = newTopicName.trim(); if (!name || Array.from(name).length > 80) return; const id = crypto.randomUUID(); onChange({ rootItems: [{ type: 'topic', id }, ...organization.rootItems], topics: [{ id, name, annotationIds: [] }, ...organization.topics] }, 'Topic created.'); setCreating(false); setNewTopicName(''); };
  const renameTopic = (id: string, name: string) => {
    const trimmed = name.trim(); if (!trimmed || Array.from(trimmed).length > 80) return;
    if (organization.topics.find((topic) => topic.id === id)?.name === trimmed) { setEditingTopicId(null); return; }
    onChange({ ...organization, topics: organization.topics.map((topic) => topic.id === id ? { ...topic, name: trimmed } : topic) }, 'Topic renamed.'); setEditingTopicId(null);
  };

  const locateAnnotation = (id: string) => {
    const topic = organization.topics.find((item) => item.annotationIds.includes(id));
    if (topic) return { container: topic.id, index: topic.annotationIds.indexOf(id) };
    return { container: null, index: organization.rootItems.findIndex((item) => item.type === 'annotation' && item.id === id) };
  };
  const dropEdge = (event: DragEndEvent | DragOverEvent, threshold = .5): 'before' | 'after' | null => {
    if (!event.over || !event.active.rect.current.translated) return null;
    const translated = event.active.rect.current.translated;
    const center = translated.top + translated.height / 2;
    const ratio = (center - event.over.rect.top) / Math.max(1, event.over.rect.height);
    if (ratio < threshold) return 'before';
    if (ratio > 1 - threshold) return 'after';
    return null;
  };
  const moveAnnotation = (event: DragEndEvent, annotationId: string) => {
    if (!event.over) return organization;
    const over = parseDragId(String(event.over.id));
    let targetTopic: string | null = null;
    let targetAnnotation: string | null = null;
    let rootTopicTarget: string | null = null;
    if (over.kind === 'topic-container') targetTopic = over.id;
    if (over.kind === 'topic') { if (dropEdge(event, .22)) rootTopicTarget = over.id; else targetTopic = over.id; }
    if (over.kind === 'annotation') { targetAnnotation = over.id; targetTopic = locateAnnotation(over.id).container; }
    const topics = organization.topics.map((topic) => ({ ...topic, annotationIds: topic.annotationIds.filter((id) => id !== annotationId) }));
    const rootItems = organization.rootItems.filter((item) => item.type !== 'annotation' || item.id !== annotationId);
    const after = event.active.rect.current.translated ? event.active.rect.current.translated.top > event.over.rect.top + event.over.rect.height / 2 : false;
    if (targetTopic) {
      const topic = topics.find((item) => item.id === targetTopic); if (!topic) return organization;
      const index = targetAnnotation ? topic.annotationIds.indexOf(targetAnnotation) : topic.annotationIds.length;
      topic.annotationIds.splice(Math.max(0, index + (after && targetAnnotation ? 1 : 0)), 0, annotationId);
    } else {
      let index = targetAnnotation ? rootItems.findIndex((item) => item.type === 'annotation' && item.id === targetAnnotation) : rootItems.length;
      if (rootTopicTarget) index = rootItems.findIndex((item) => item.type === 'topic' && item.id === rootTopicTarget);
      rootItems.splice(Math.max(0, index + (after && over.kind !== 'root-container' ? 1 : 0)), 0, { type: 'annotation', id: annotationId });
    }
    return { rootItems, topics };
  };
  const moveTopic = (event: DragEndEvent, topicId: string) => {
    if (!event.over) return organization;
    const over = parseDragId(String(event.over.id));
    let targetId = over.id, targetType: 'topic' | 'annotation' = over.kind === 'topic' ? 'topic' : 'annotation';
    if (over.kind === 'topic-container') { targetId = over.id; targetType = 'topic'; }
    if (over.kind === 'annotation') {
      const owner = locateAnnotation(over.id).container;
      if (owner) { targetId = owner; targetType = 'topic'; }
    }
    const from = organization.rootItems.findIndex((item) => item.type === 'topic' && item.id === topicId);
    if (from < 0) return organization;
    const rootItems = [...organization.rootItems]; const [moving] = rootItems.splice(from, 1);
    const to = over.kind === 'root-container' ? rootItems.length : rootItems.findIndex((item) => item.type === targetType && item.id === targetId);
    if (to < 0) return organization;
    const after = event.active.rect.current.translated ? event.active.rect.current.translated.top > event.over.rect.top + event.over.rect.height / 2 : false;
    rootItems.splice(to + (after && over.kind !== 'root-container' ? 1 : 0), 0, moving);
    return { ...organization, rootItems };
  };
  const onDragOver = (event: DragOverEvent) => {
    const active = parseDragId(String(event.active.id)), over = event.over ? parseDragId(String(event.over.id)) : null;
    if (active.kind === 'topic' && over) {
      let type: 'topic' | 'annotation' = over.kind === 'topic' || over.kind === 'topic-container' ? 'topic' : 'annotation';
      let id = over.id;
      if (over.kind === 'annotation') { const owner = locateAnnotation(over.id).container; if (owner) { type = 'topic'; id = owner; } }
      const after = event.active.rect.current.translated ? event.active.rect.current.translated.top > event.over!.rect.top + event.over!.rect.height / 2 : false;
      setTopicInsertion(over.kind === 'root-container' ? null : { type, id, edge: after ? 'after' : 'before' });
      setOverTopicId(null); return;
    }
    setTopicInsertion(null);
    if (active.kind !== 'annotation' || !over) { setOverTopicId(null); return; }
    if (over.kind === 'topic') {
      const edge = dropEdge(event, .22);
      if (edge) { setTopicInsertion({ type: 'topic', id: over.id, edge }); setOverTopicId(null); }
      else setOverTopicId(over.id);
    } else if (over.kind === 'topic-container') setOverTopicId(over.id);
    else if (over.kind === 'annotation') {
      const owner = locateAnnotation(over.id).container;
      setOverTopicId(owner);
      if (!owner) setTopicInsertion({ type: 'annotation', id: over.id, edge: dropEdge(event) ?? 'before' });
    }
    else setOverTopicId(null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const active = parseDragId(String(event.active.id)); setActiveId(null); setOverTopicId(null); setTopicInsertion(null);
    const next = active.kind === 'annotation' ? moveAnnotation(event, active.id) : active.kind === 'topic' ? moveTopic(event, active.id) : organization;
    if (next !== organization) onChange(next, active.kind === 'topic' ? 'Topic order updated.' : 'Annotation organization updated.');
  };

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(event) => setActiveId(String(event.active.id))} onDragOver={onDragOver} onDragCancel={() => { setActiveId(null); setOverTopicId(null); setTopicInsertion(null); }} onDragEnd={onDragEnd}>
    <div className="organizer-actions">
      {creating ? <div className="topic-create"><input ref={createInputRef} value={newTopicName} placeholder="Topic name" onChange={(event) => setNewTopicName(event.target.value)} onBlur={() => { if (newTopicName.trim()) createTopic(); else setCreating(false); }} onKeyDown={(event) => { if (event.key === 'Enter') createTopic(); if (event.key === 'Escape') { setCreating(false); setNewTopicName(''); } }} /></div>
        : <Button variant="outline" size="sm" disabled={!hasVideo} onClick={() => setCreating(true)}><Plus />Topic</Button>}
    </div>
    <div ref={setRootRef} className="annotation-list">
      <SortableContext items={organization.rootItems.map((item) => item.type === 'topic' ? topicDragId(item.id) : annotationDragId(item.id))} strategy={verticalListSortingStrategy}>
        {organization.rootItems.map((item) => item.type === 'annotation' ? annotationById.get(item.id) ? <AnnotationRow key={item.id} annotation={annotationById.get(item.id)!} selected={selectedId === item.id} insertion={topicInsertion?.type === 'annotation' && topicInsertion.id === item.id ? topicInsertion.edge : undefined} onSelect={() => onSelect(annotationById.get(item.id)!)} /> : null : topicById.get(item.id) ? <TopicBlock key={item.id} topic={topicById.get(item.id)!} annotations={annotationById} selectedId={selectedId} collapsed={collapsed.has(item.id)} dropActive={overTopicId === item.id} editing={editingTopicId === item.id} insertion={topicInsertion?.type === 'topic' && topicInsertion.id === item.id ? topicInsertion.edge : undefined} onToggle={() => setCollapsed((items) => { const next = new Set(items); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} onSelect={onSelect} onRename={(name) => renameTopic(item.id, name)} onStartRename={() => setEditingTopicId(item.id)} onCancelRename={() => setEditingTopicId(null)} onDelete={() => { if (window.confirm(`Delete topic “${topicById.get(item.id)!.name}”? Its annotations will become unassigned.`)) onChange(deleteTopic(organization, item.id), 'Topic deleted; its annotations are now unassigned.'); setEditingTopicId(null); }} /> : null)}
      </SortableContext>
      {!annotations.length && !organization.topics.length && <div className="empty-list"><PenLine /><strong>No annotations yet</strong><span>Pause at a key moment and add your first note.</span></div>}
    </div>
    <DragOverlay>{activeId ? <div className="drag-overlay"><GripVertical />{parseDragId(activeId).kind === 'topic' ? topicById.get(parseDragId(activeId).id)?.name : annotationById.get(parseDragId(activeId).id)?.note || 'Annotation'}</div> : null}</DragOverlay>
  </DndContext>;
}
