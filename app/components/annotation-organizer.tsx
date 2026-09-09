'use client';

import { CollisionDetection, DndContext, DragEndEvent, DragOverlay, DraggableAttributes, DraggableSyntheticListeners, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, PenLine, Plus, Trash2 } from 'lucide-react';
import { KeyboardEvent, Ref, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AnnotationOrganization, OrganizationDragItem, OrganizationDropTarget, deleteTopic, moveOrganizationItem } from '@/lib/annotation-organization';
import type { Annotation } from '@/lib/project-file';

const dragId = (item: OrganizationDragItem) => `drag:${item.type}:${item.id}`;
const dropId = (key: string) => `drop:${key}`;

function parseDragId(value: string): OrganizationDragItem | null {
  const [prefix, type, ...id] = value.split(':');
  return prefix === 'drag' && (type === 'annotation' || type === 'topic') && id.length ? { type, id: id.join(':') } : null;
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

type DropData = { target: OrganizationDropTarget; accepts: Array<OrganizationDragItem['type']> };
type ChangeHandler = (organization: AnnotationOrganization, message: string) => void;

const collisionDetection: CollisionDetection = (args) => {
  const active = parseDragId(String(args.active.id));
  const allowed = (collisions: ReturnType<CollisionDetection>) => collisions.filter(({ id }) => {
    const data = args.droppableContainers.find((container) => container.id === id)?.data.current as DropData | undefined;
    return Boolean(active && data?.accepts.includes(active.type));
  });
  return allowed(pointerWithin(args));
};

function DragHandle({ attributes, listeners, label, handleRef }: { attributes: DraggableAttributes; listeners?: DraggableSyntheticListeners; label: string; handleRef?: Ref<HTMLButtonElement> }) {
  return <button ref={handleRef} className="drag-handle" aria-label={label} {...attributes} {...listeners}><GripVertical /></button>;
}

function DropZone({ id, target, accepts, variant = 'line' }: { id: string; target: OrganizationDropTarget; accepts: DropData['accepts']; variant?: 'line' | 'topic' | 'before-surface' | 'after-surface' }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(id), data: { target, accepts } satisfies DropData });
  return <div ref={setNodeRef} aria-hidden="true" className={`drop-zone drop-zone-${variant} ${isOver ? 'is-over' : ''}`} />;
}

type HandleBindings = { attributes: DraggableAttributes; listeners?: DraggableSyntheticListeners; ref: (element: HTMLElement | null) => void };

function DraggableShell({ item, children, className = '' }: { item: OrganizationDragItem; children: (handle: HandleBindings) => React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: dragId(item), data: item });
  return <div ref={setNodeRef} className={`${className} ${isDragging ? 'is-dragging' : ''}`}>
    {children({ attributes, listeners, ref: setActivatorNodeRef })}
  </div>;
}

function AnnotationRow({ annotation, selected, onSelect, targetBefore, targetAfter, nested = false }: {
  annotation: Annotation; selected: boolean; onSelect: () => void; targetBefore: OrganizationDropTarget; targetAfter: OrganizationDropTarget; nested?: boolean;
}) {
  const accepts: DropData['accepts'] = nested ? ['annotation'] : ['annotation', 'topic'];
  return <div className="annotation-drop-frame">
    <DropZone id={`annotation-${annotation.id}-before`} target={targetBefore} accepts={accepts} />
    <DraggableShell item={{ type: 'annotation', id: annotation.id }} className={`annotation-card ${nested ? 'nested' : ''} ${selected ? 'selected' : ''}`}>
      {({ attributes, listeners, ref }) => <>
        <DragHandle handleRef={ref as Ref<HTMLButtonElement>} label="Drag annotation" attributes={attributes} listeners={listeners} />
        <button className="annotation-card-main" onClick={onSelect}>
          <span className="card-body"><strong>{formatTime(annotation.timeUs / 1_000_000)}</strong><span>{annotation.note || `${annotation.drawing.strokes.length} drawing stroke${annotation.drawing.strokes.length === 1 ? '' : 's'}`}</span></span>
          <ChevronRight />
        </button>
        <DropZone id={`annotation-${annotation.id}-before-surface`} target={targetBefore} accepts={accepts} variant="before-surface" />
        <DropZone id={`annotation-${annotation.id}-after-surface`} target={targetAfter} accepts={accepts} variant="after-surface" />
      </>}
    </DraggableShell>
    <DropZone id={`annotation-${annotation.id}-after`} target={targetAfter} accepts={accepts} />
  </div>;
}

function TopicBlock({ topic, annotations, selectedId, collapsed, editing, rootIndex, onToggle, onSelect, onRename, onStartRename, onCancelRename, onDelete }: {
  topic: AnnotationOrganization['topics'][number]; annotations: Map<string, Annotation>; selectedId: string | null; collapsed: boolean; editing: boolean; rootIndex: number;
  onToggle: () => void; onSelect: (annotation: Annotation) => void; onRename: (name: string) => void; onStartRename: () => void; onCancelRename: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(topic.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { nameInputRef.current?.focus(); nameInputRef.current?.select(); } }, [editing]);
  const submitName = () => { const trimmed = name.trim(); if (trimmed && Array.from(trimmed).length <= 80) onRename(trimmed); else { setName(topic.name); onCancelRename(); } };
  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); submitName(); }
    if (event.key === 'Escape') { event.preventDefault(); setName(topic.name); onCancelRename(); }
  };

  return <div className="topic-drop-frame">
    <DropZone id={`topic-${topic.id}-root-before`} target={{ type: 'root', index: rootIndex }} accepts={['annotation', 'topic']} />
    <DraggableShell item={{ type: 'topic', id: topic.id }} className="topic-block">
      {({ attributes, listeners, ref }) => <>
        <div className="topic-header">
          <DragHandle handleRef={ref as Ref<HTMLButtonElement>} label={`Drag topic ${topic.name}`} attributes={attributes} listeners={listeners} />
          <button className="topic-collapse" onClick={onToggle} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${topic.name}`}>{collapsed ? <ChevronRight /> : <ChevronDown />}</button>
          {editing ? <input ref={nameInputRef} className="topic-name-input" value={name} onChange={(event) => setName(event.target.value)} onBlur={submitName} onKeyDown={onNameKeyDown} /> : <strong className="topic-name">{topic.name}</strong>}
          <span className="topic-count">{topic.annotationIds.length}</span>
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${topic.name}`} />}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onStartRename}>Rename</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />Delete topic</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <DropZone id={`topic-${topic.id}-append`} target={{ type: 'topic', topicId: topic.id }} accepts={['annotation']} variant="topic" />
        </div>
        {!collapsed && <div className="topic-children">
          {topic.annotationIds.length === 0
            ? <DropZone id={`topic-${topic.id}-empty`} target={{ type: 'topic-child', topicId: topic.id, index: 0 }} accepts={['annotation']} variant="topic" />
            : topic.annotationIds.map((id, index) => {
              const annotation = annotations.get(id); if (!annotation) return null;
              return <AnnotationRow key={id} nested annotation={annotation} selected={selectedId === id} onSelect={() => onSelect(annotation)} targetBefore={{ type: 'topic-child', topicId: topic.id, index }} targetAfter={{ type: 'topic-child', topicId: topic.id, index: index + 1 }} />;
            })}
        </div>}
        <DropZone id={`topic-${topic.id}-before-surface`} target={{ type: 'root', index: rootIndex }} accepts={['topic']} variant="before-surface" />
        <DropZone id={`topic-${topic.id}-after-surface`} target={{ type: 'root', index: rootIndex + 1 }} accepts={['topic']} variant="after-surface" />
      </>}
    </DraggableShell>
    <DropZone id={`topic-${topic.id}-root-after`} target={{ type: 'root', index: rootIndex + 1 }} accepts={['annotation', 'topic']} />
  </div>;
}

export function AnnotationOrganizer({ annotations, organization, selectedId, hasVideo, onSelect, onChange }: {
  annotations: Annotation[]; organization: AnnotationOrganization; selectedId: string | null; hasVideo: boolean; onSelect: (annotation: Annotation) => void; onChange: ChangeHandler;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [activeItem, setActiveItem] = useState<OrganizationDragItem | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const annotationById = useMemo(() => new Map(annotations.map((annotation) => [annotation.id, annotation])), [annotations]);
  const topicById = useMemo(() => new Map(organization.topics.map((topic) => [topic.id, topic])), [organization.topics]);
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
  const renameTopic = (id: string, name: string) => { const trimmed = name.trim(); if (!trimmed || Array.from(trimmed).length > 80) return; if (topicById.get(id)?.name === trimmed) { setEditingTopicId(null); return; } onChange({ ...organization, topics: organization.topics.map((topic) => topic.id === id ? { ...topic, name: trimmed } : topic) }, 'Topic renamed.'); setEditingTopicId(null); };
  const finishDrag = (event: DragEndEvent) => {
    const active = parseDragId(String(event.active.id));
    const data = event.over?.data.current as DropData | undefined;
    setActiveItem(null);
    if (!active || !data?.target || !data.accepts.includes(active.type)) return;
    const next = moveOrganizationItem(organization, active, data.target);
    if (next !== organization) onChange(next, active.type === 'topic' ? 'Topic order updated.' : 'Annotation organization updated.');
  };

  return <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={(event) => setActiveItem(parseDragId(String(event.active.id)))} onDragCancel={() => setActiveItem(null)} onDragEnd={finishDrag}>
    <div className="organizer-actions">
      {creating ? <div className="topic-create"><input ref={createInputRef} value={newTopicName} placeholder="Topic name" onChange={(event) => setNewTopicName(event.target.value)} onBlur={() => { if (newTopicName.trim()) createTopic(); else setCreating(false); }} onKeyDown={(event) => { if (event.key === 'Enter') createTopic(); if (event.key === 'Escape') { setCreating(false); setNewTopicName(''); } }} /></div>
        : <Button variant="outline" size="sm" disabled={!hasVideo} onClick={() => setCreating(true)}><Plus />Topic</Button>}
    </div>
    <div className={`annotation-list ${activeItem ? `dragging-${activeItem.type}` : ''}`}>
      {organization.rootItems.length === 0 && <DropZone id="root-empty" target={{ type: 'root', index: 0 }} accepts={['annotation', 'topic']} variant="topic" />}
      {organization.rootItems.map((item, rootIndex) => {
        if (item.type === 'annotation') {
          const annotation = annotationById.get(item.id); if (!annotation) return null;
          return <AnnotationRow key={item.id} annotation={annotation} selected={selectedId === item.id} onSelect={() => onSelect(annotation)} targetBefore={{ type: 'root', index: rootIndex }} targetAfter={{ type: 'root', index: rootIndex + 1 }} />;
        }
        const topic = topicById.get(item.id); if (!topic) return null;
        return <TopicBlock key={item.id} topic={topic} annotations={annotationById} selectedId={selectedId} collapsed={collapsed.has(item.id)} editing={editingTopicId === item.id} rootIndex={rootIndex} onToggle={() => setCollapsed((items) => { const next = new Set(items); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} onSelect={onSelect} onRename={(name) => renameTopic(item.id, name)} onStartRename={() => setEditingTopicId(item.id)} onCancelRename={() => setEditingTopicId(null)} onDelete={() => { if (window.confirm(`Delete topic “${topic.name}”? Its annotations will become unassigned.`)) onChange(deleteTopic(organization, item.id), 'Topic deleted; its annotations are now unassigned.'); setEditingTopicId(null); }} />;
      })}
      {!annotations.length && !organization.topics.length && <div className="empty-list"><PenLine /><strong>No annotations yet</strong><span>Pause at a key moment and add your first note.</span></div>}
    </div>
    <DragOverlay>{activeItem ? <div className="drag-overlay"><GripVertical />{activeItem.type === 'topic' ? topicById.get(activeItem.id)?.name : annotationById.get(activeItem.id)?.note || 'Annotation'}</div> : null}</DragOverlay>
  </DndContext>;
}
