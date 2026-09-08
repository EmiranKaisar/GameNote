# Game Note

This context defines the shared language for a lightweight, cross-platform app used to review match footage and attach observations without altering the source video.

## Language

**Project**:
A portable folder that contains one match video, its annotation data, and the metadata needed to reopen the review on a supported device.
_Avoid_: Session, workspace, edited video

**Match Video**:
The source recording being reviewed in a Project. It remains unchanged when annotations are added or edited.
_Avoid_: Footage file, source asset

**Playhead**:
The current playback position in the Match Video.
_Avoid_: Cursor, scrubber

**Annotation**:
Saved review information anchored to a specific media timestamp and composed of a Note, a Drawing, or both.
_Avoid_: Comment, marker, frame information

**Topic**:
A grouping with a required name used to organize Annotations in the annotation sidebar. Topic names need not be unique, and a Topic contains complete Annotations, including their Note, Drawing, and Annotation Time.
_Avoid_: Folder, category, tag, note group

**Unassigned Annotation**:
An Annotation that does not belong to a Topic and appears directly in the annotation sidebar’s top-level order.
_Avoid_: Uncategorized note, loose note

**Annotation Organization**:
The ordered arrangement of Topics and unassigned Annotations, including the ordered membership of each Topic. It is separate from Annotation content.
_Avoid_: Sidebar layout, folder tree

**Note**:
The text portion of an Annotation.
_Avoid_: Caption, description

**Drawing**:
The visual portion of an Annotation, stored as editable strokes positioned relative to the Match Video image.
_Avoid_: Sketch, paint, burned-in overlay

**Stroke**:
A continuous path with a color and width that forms part of a Drawing.
_Avoid_: Line, scribble

**Timeline Marker**:
A visible sign on the playback timeline indicating that an Annotation exists at that position.
_Avoid_: Bookmark, cue point

**Annotation Time**:
The precise media timestamp to which an Annotation is anchored. A decoded frame index may be retained as supporting metadata but is not the portable identity of the Annotation.
_Avoid_: Frame number

**Annotation Mode**:
The editing state in which playback is paused and the user can add or change a Note and Drawing at the Playhead.
_Avoid_: Edit mode, drawing mode

**Review View**:
The primary screen containing the video, playback controls, annotation tools, timeline, and note editor.
_Avoid_: Player page, editor screen

**Save**:
Writing all Project metadata and annotations to durable storage without modifying the Match Video.
_Avoid_: Export, render

**Export**:
Creating a new shareable video or document from a Project. Export is distinct from Save and is not part of the first release.
_Avoid_: Save
