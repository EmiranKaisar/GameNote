# Game Note — Product Design

## 1. Product Summary

Game Note is a lightweight desktop and mobile app for coaches, athletes, analysts, and referees to review match footage and attach text and drawings to exact moments. Annotations are saved beside an unchanged copy of the video in a portable Project folder that can be reopened on macOS, Windows, iOS, or Android.

The shared product language is defined in [CONTEXT.md](./CONTEXT.md).

## 2. Product Principles

- **Fast to review:** opening a video, seeking, pausing, and adding an annotation should feel immediate.
- **Non-destructive:** the source video is never modified by annotation work.
- **Portable:** a saved Project should reopen consistently on every supported platform.
- **Precise:** annotations remain attached to the intended moment even for variable-frame-rate video.
- **Touch- and pointer-friendly:** every core action works with mouse, trackpad, touch, or stylus.
- **Offline-first:** playback, annotation, saving, and reopening require no account or network connection.

## 3. Target Users and Core Job

### Primary users

- Coaches reviewing tactics and player positioning.
- Athletes studying decisions and technique.
- Match analysts recording observations for later discussion.

### Core job

> While reviewing a match video, I want to pause at an important moment, explain it with text and on-screen drawing, and reliably return to that moment later.

## 4. MVP Scope

### Included

- Open a local video or a previously saved Project.
- Play, pause, seek, change volume, enter fullscreen, and step one frame backward or forward when supported by the media decoder.
- Add, edit, and delete a timestamped Annotation.
- Enter a Note in a text editor below the video.
- Draw over the video with a selectable pen color.
- Undo and redo Drawing strokes.
- Display Timeline Markers for saved Annotations.
- Navigate between annotations and select one from the timeline.
- Create, rename, collapse, reorder, and delete Topics in the **Annotations** sidebar.
- Reorder Annotations and move them into or out of Topics with dedicated drag handles.
- Save the Match Video and annotation information in a portable Project folder.
- Recover safely from an interrupted or failed save.
- Reopen and correctly present a Project on all target platforms.

### Not included in MVP

- Burning drawings or notes into an exported video.
- Cloud sync, collaboration, accounts, or permissions.
- Multiple videos in one Project.
- Audio, voice, image, or file attachments.
- Shape tools, player tracking, telestration animation, or automated match analysis.
- Tags, search, filters, or reports.

## 5. Supported Platforms and Media

### Platforms

- macOS and Windows desktop.
- iOS and Android phones and tablets.

Desktop and tablet layouts use the full Review View. On smaller phones, annotation tools may wrap into a compact toolbar and the Note editor may open as a bottom sheet while preserving the same capabilities.

### Video compatibility

The app should accept common containers such as MP4, MOV, MKV, AVI, and WebM when their contained codecs are supported by the device or bundled playback engine. The guaranteed compatibility baseline is:

- MP4 or MOV container.
- H.264 video.
- AAC audio.

When a file cannot be decoded, the app must explain that the format or codec is unsupported and leave the existing Project unchanged. Transcoding is outside the MVP.

## 6. Primary User Flows

### 6.1 Create a Project from a video

1. The user chooses **Open Video** from the welcome screen or file menu.
2. The app validates that the file can be decoded and shows it in the Review View.
3. The app creates an unsaved Project in memory; the original video remains untouched.
4. The user reviews and annotates the Match Video.
5. The user chooses **Save Project**, selects a destination, and gives the Project a name.
6. The app copies the video and writes the project metadata into a new Project folder.
7. The title bar shows the saved Project name and clears the unsaved-change indicator.

On mobile, the destination is selected through the platform file picker. If the provider cannot create a normal folder, the app may expose the same folder structure as a platform-recognized document package.

The destination picker is shown only for a Project's first Save. After a Project has been saved or opened from an existing Project folder, **Save** atomically overwrites that exact Project folder without asking for a destination again. If the folder has moved, disappeared, or no longer identifies the same Project, Save stops with an error instead of writing elsewhere; the user can then reopen the Project or use a future **Save As** action.

### 6.2 Add an annotation

1. The user pauses or seeks to an important moment.
2. The user selects **Add Note** in the player toolbar.
3. Playback pauses and the app enters Annotation Mode at the current Playhead position.
4. A Note editor appears below the video and receives keyboard focus when a keyboard is present.
5. The user may type a Note, select the pen, choose a color, and draw directly over the video image.
6. The user selects **Done** or uses the save shortcut.
7. If there is text or at least one Stroke, the Annotation is saved and a Timeline Marker appears. An empty annotation is discarded.

If an Annotation already exists within the same displayed frame, **Add Note** opens that Annotation rather than creating an overlapping duplicate.

### 6.3 Review an annotation

1. The user selects a Timeline Marker.
2. The Playhead seeks to the Annotation Time and playback pauses.
3. The Drawing appears over the video and the Note appears below it in read-only state.
4. The user can choose **Edit**, **Delete**, **Previous**, or **Next**.
5. Starting playback hides the overlay after the annotated frame is no longer current; the Timeline Marker remains visible.

### 6.4 Reopen a Project

1. The user chooses **Open Project** and selects a Project folder or document package.
2. The app validates the manifest, schema version, video, and annotation file.
3. The Review View opens at the last saved Playhead position.
4. All Timeline Markers, Notes, and Drawings appear at their saved positions.
5. If the Project was created by a newer incompatible app version, the app opens it read-only when possible and explains why editing is unavailable.

### 6.5 Organize annotations with Topics

1. After a Match Video is open, the user selects **+ Topic** in the **Annotations** sidebar.
2. An inline, focused name field appears. A Topic name is trimmed, must contain 1–80 Unicode characters, and need not be unique. `Enter` creates it; `Escape` cancels.
3. A new Topic appears at the top. A newly created Annotation also appears at the top as unassigned; editing an existing Annotation preserves its position and Topic.
4. The user drags an Annotation by its handle onto a Topic header to append it, between Topic children to place it precisely, or between top-level items to make it unassigned at that position.
5. The user drags a Topic by its handle to reorder it among top-level Topics and unassigned Annotations. Its children move with it, and a Topic cannot be placed inside another Topic.
6. Hovering an Annotation over a Topic shows a lime container highlight. Dragging a Topic shows only a top-level before/after insertion line.
7. Deleting a Topic promotes its children, in their existing order, into the Topic's former top-level position. The Annotations themselves are never deleted.

## 7. Review View

```text
┌──────────────────────────────────────────────────────────────┐
│ Project name                                      Unsaved •  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                       VIDEO CANVAS                           │
│                 + annotation drawing layer                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ▶  00:14:32 / 01:38:04   Add Note   Pen   Color   Undo  Redo │
│ ───────●────────▲────────────▲─────────────────────────────── │
│                 timeline markers                             │
├──────────────────────────────────────────────────────────────┤
│ Note                                                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Defensive line is too deep before the second pass.      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                         Delete  Cancel  Done │
└──────────────────────────────────────────────────────────────┘
```

### Layout behavior

- The video preserves its aspect ratio and is letterboxed when necessary.
- Drawings are clipped to the actual video image, not the surrounding letterbox area.
- The Note editor is visible while adding, editing, or viewing an Annotation; otherwise it is collapsed.
- Timeline Markers remain distinguishable at normal zoom. Markers at nearby times may stack visually, but each must remain individually selectable through keyboard navigation or an annotation list fallback.
- The app clearly shows unsaved changes in the title bar or navigation bar.
- The sidebar count badge counts Annotations only, not Topics.

### Annotations sidebar

- The top level freely interleaves Topics and unassigned Annotations.
- Each Topic header contains a drag handle, collapse chevron, name, Annotation count, and overflow menu with **Rename** and **Delete Topic**.
- Topic collapse state is session-only. Every Topic starts expanded when a Project opens.
- **Previous Annotation** and **Next Annotation** traverse the flattened sidebar order. Selecting an Annotation inside a collapsed Topic automatically expands that Topic.
- Timeline Markers remain chronological and are unaffected by sidebar organization.
- Reordering and Topic assignment are pointer/touch operations in this release. Keyboard equivalents are deferred.

## 8. Annotation Interaction

### Drawing

- Selecting **Pen** activates freehand drawing and reveals a color palette.
- MVP colors: white, black, red, yellow, green, and blue. The active color has a non-color-only selection indicator.
- Pointer, touch, and stylus input create Strokes; mouse or finger input is sufficient for all drawing actions.
- Stroke coordinates are normalized to the displayed video image (`0.0` to `1.0` on each axis), so drawings scale and reposition with different screen sizes and orientations.
- Strokes are editable data, not pixels baked into the video.
- **Undo** removes the most recent Stroke in the active edit session. **Redo** restores the most recently undone Stroke.
- `Ctrl+Z` on Windows and `Command+Z` on macOS/iPadOS perform Undo while drawing. `Ctrl+Shift+Z` and `Command+Shift+Z` perform Redo.
- Undo history exists only while the Annotation is being edited. After reopening a Project, the user may edit or clear the Drawing but cannot replay the former session's undo history.

### Text

- The Note supports plain text, line breaks, and Unicode.
- Formatting, embedded media, and hyperlinks are outside the MVP.
- Note input must not trigger playback shortcuts while the editor has focus.
- A practical soft limit of 10,000 characters prevents accidental oversized entries; the app shows a counter near the limit and never silently truncates text.

### Timing

- The Annotation is anchored to media time in microseconds, independent of playback rate and display refresh rate.
- A decoded frame index and nominal frame rate may be stored as diagnostic metadata when available.
- Selecting a marker seeks to the nearest decodable presentation frame at the Annotation Time.
- Editing an Annotation does not move it. A separate **Move to Playhead** action can be added after MVP if user testing demonstrates a need.

## 9. Playback and Keyboard Controls

| Action | Desktop shortcut | Touch behavior |
| --- | --- | --- |
| Play or pause | `Space` | Tap play/pause |
| Seek backward/forward | `Left` / `Right` | Drag timeline |
| Step one frame | `,` / `.` while paused | Step buttons |
| Add or edit annotation | `N` | Tap **Add Note** |
| Undo drawing | `Ctrl+Z` / `Command+Z` | Tap **Undo** |
| Redo drawing | `Ctrl+Shift+Z` / `Command+Shift+Z` | Tap **Redo** |
| Save Project | `Ctrl+S` / `Command+S` | Tap **Save** in menu |
| Exit Annotation Mode | `Escape` | Tap **Cancel** |

Frame stepping is best-effort for formats whose decoder does not support exact reverse stepping. In that case, the UI must not claim frame accuracy it cannot provide.

## 10. Project Storage Contract

### Folder structure

```text
My Match.matchproject/
├── manifest.json
├── video/
│   └── match.mp4
└── annotations.json
```

- The folder suffix helps desktop operating systems associate Projects with the app while retaining a human-inspectable directory structure.
- The video is copied into `video/` on the first save, making the Project portable and avoiding broken external file references.
- The original video filename and extension are preserved when safe; collisions and unsafe characters are normalized.
- Unknown manifest fields and newer optional fields are ignored when possible to support forward compatibility.
- Save uses a temporary sibling file or directory followed by an atomic replacement where the platform supports it. A failed save must not corrupt the last valid Project.
- An opened or previously saved native Project retains its exact folder location for direct overwrite on subsequent Saves.

### `manifest.json` example

```json
{
  "format": "match-video-project",
  "schemaVersion": 1,
  "projectId": "018f51aa-cc84-7a20-a65f-8a3663c434f2",
  "title": "Home vs Away — 2026-09-08",
  "createdAt": "2026-09-08T10:00:00Z",
  "updatedAt": "2026-09-08T10:15:00Z",
  "video": {
    "path": "video/match.mp4",
    "originalFilename": "match.mp4",
    "durationUs": 5884000000,
    "sha256": "<hex digest>"
  },
  "annotationsPath": "annotations.json",
  "lastPlayheadUs": 872000000
}
```

### `annotations.json` example

```json
{
  "schemaVersion": 1,
  "annotations": [
    {
      "id": "018f51bd-5dfa-7d15-9dce-f47579e203fb",
      "timeUs": 872000000,
      "frameIndex": 21799,
      "note": "Defensive line is too deep before the second pass.",
      "drawing": {
        "coordinateSpace": "normalized-video-v1",
        "strokes": [
          {
            "color": "#FF3B30",
            "width": 0.006,
            "points": [
              { "x": 0.34, "y": 0.42 },
              { "x": 0.39, "y": 0.38 }
            ]
          }
        ]
      },
      "createdAt": "2026-09-08T10:11:00Z",
      "updatedAt": "2026-09-08T10:13:00Z"
    }
  ],
  "organization": {
    "rootItems": [
      { "type": "annotation", "id": "018f51bd-5dfa-7d15-9dce-f47579e203fb" },
      { "type": "topic", "id": "topic-1" }
    ],
    "topics": [
      { "id": "topic-1", "name": "Counter attacks", "annotationIds": [] }
    ]
  }
}
```

`organization` is optional and does not change `schemaVersion`. Projects without it open with all Annotations unassigned in chronological order and gain the field only on their next Save. Every valid Annotation is represented exactly once: either as a top-level annotation root item or in one Topic's `annotationIds`. Empty Topics persist.

When organization data is damaged, Game Note keeps the first valid placement, removes invalid or duplicate references, and appends any otherwise unrepresented valid Annotations at the bottom as unassigned in chronological order. It reports this non-blocking recovery and writes the repaired structure only if the user later saves. An Annotation is deleted during recovery only when that Annotation's own record is invalid.

The examples illustrate the contract rather than prescribing a programming language. Production readers must validate paths, bounds, identifiers, timestamps, sizes, and JSON types before using them.

## 11. State and Safety Rules

- Opening another video or Project with unsaved changes prompts the user to **Save**, **Discard**, or **Cancel**.
- Closing the app with unsaved changes uses the same prompt.
- Autosave may protect an already-saved Project, but it does not replace explicit first-time destination selection.
- Canceling Annotation Mode restores the Annotation to its state before the current edit session.
- Deleting an Annotation requires confirmation or provides a short-lived undo action.
- If the embedded video is missing or its checksum differs, the app reports the issue and does not silently bind annotations to another video.
- Corrupt annotations are isolated when possible: valid annotations remain available and the app offers diagnostics instead of overwriting the source. Corrupt organization never deletes a valid Annotation.
- Project imports must reject paths that escape the selected Project folder.

## 12. Accessibility and Localization

- Every control has an accessible name, role, state, focus indicator, and keyboard path.
- Toolbar targets are at least 44 × 44 logical points on touch devices.
- Timeline Markers cannot rely on color alone; selected and annotated states also use shape or icon changes.
- The interface supports system text scaling without hiding save or cancel actions.
- Drawing colors are paired with names and high-contrast swatches.
- All user-facing text is externalized for localization. Notes retain the user's original Unicode text and writing direction.
- Reduced-motion and screen-reader settings are respected.

## 13. Performance Targets

These are product targets for a representative modern device using a locally stored 1080p H.264 video:

- First visible video frame within 2 seconds of selection.
- Playback controls respond within 100 ms.
- Drawing follows input within 50 ms at the 95th percentile.
- Timeline marker selection begins seeking within 100 ms.
- Opening a Project with 1,000 Annotations adds no more than 1 second beyond video initialization.
- Annotation data for 1,000 typical text-and-drawing entries remains under 25 MB, excluding video.
- Memory usage must not grow in proportion to full video duration; video is streamed rather than loaded in full.

## 14. MVP Acceptance Criteria

### Video opening and playback

- Given a supported local H.264/AAC MP4, when the user opens it, then the first frame and correct duration are displayed and playback controls work.
- Given an unsupported or corrupt file, when the user opens it, then a clear error is shown and no existing Project is changed.

### Annotation creation

- Given paused playback, when the user selects **Add Note**, then the Note editor appears below the video and the user can draw over the video.
- Given text, a Drawing, or both, when the user selects **Done**, then one Timeline Marker appears at that moment.
- Given an empty draft, when the user selects **Done**, then no Annotation or marker is created.
- Given several Strokes, when the user invokes Undo, then Strokes are removed in reverse creation order without changing the Note.

### Annotation review and editing

- Given a saved Timeline Marker, when the user selects it, then playback pauses at the nearest presentation frame and the saved Note and Drawing appear.
- Given different window sizes or device orientations, when an Annotation is shown, then every Stroke retains its position relative to the video image.
- Given an existing Annotation on the displayed frame, when the user selects **Add Note**, then the existing Annotation opens for editing rather than creating a duplicate.

### Topic organization

- Given an open Match Video, when the user creates a valid Topic, then it appears at the top and persists after Save and reopen; without a Match Video, Topic creation is disabled.
- Given a dragged Annotation over a Topic, when it is dropped on the header or between children, then it becomes a child at the indicated position.
- Given a dragged Annotation between top-level items, when it is dropped, then it becomes unassigned at that exact position.
- Given a dragged Topic, then only top-level insertion positions are offered and its children move with it.
- Given a deleted Topic, then its children are promoted in order at the Topic's former position and no Annotation is deleted.
- Given a manual organization order, **Previous** and **Next** follow its flattened Annotation order while Timeline Markers remain chronological.
- Given damaged or duplicate organization references, then all valid Annotations remain accessible after deterministic recovery and the original file is unchanged until Save.

### Persistence and portability

- Given an unsaved Project, when the user saves it, then the destination contains a video, manifest, and annotation data and the original video is unchanged.
- Given an existing Project opened in Game Note, when the user selects **Save**, then the same Project folder is atomically replaced without showing a destination picker.
- Given that the remembered Project folder is missing or now belongs to another Project, when the user selects **Save**, then no alternate folder is created and a clear error is shown.
- Given a saved Project copied to another supported platform, when it is opened, then the same video, Annotation Times, Notes, Drawings, and Timeline Markers are presented.
- Given a save interrupted before replacement, when the original Project is reopened, then its last successfully saved state remains valid.
- Given a modified or missing embedded video, when the Project is opened, then the mismatch is reported and annotations are not silently shown over the wrong media.

## 15. Product Decisions and Open Questions

### Decisions made for MVP

- A Project contains one copied video for reliable portability.
- Annotations are separate, editable data and do not alter the video.
- Annotation identity is timestamp-based rather than frame-number-based.
- Text is plain text and drawings are freehand strokes.
- The app is offline-first and does not require an account.
- Topic organization is stored separately from Annotation content as an optional schema-v1 extension.

### Questions to validate with users

- Should playback automatically pause briefly on annotated moments, or should markers remain passive?
- Is one video per Project sufficient for the first release, or must first-half and second-half files be reviewed together?
- Is copying large videos into a Project acceptable, or should desktop users also have an explicitly non-portable linked-video option?
- Which additional codecs are essential for the users' actual cameras and capture workflows?

## 16. Suggested Delivery Sequence

1. Cross-platform shell, file picking, guaranteed-baseline playback, and playback controls.
2. In-memory Notes, Drawings, normalized coordinates, and undo/redo.
3. Timeline Markers and annotation navigation.
4. Project save/open with validation, atomic persistence, and schema versioning.
5. Platform-specific polish, accessibility, error recovery, and performance testing.
6. User testing focused on annotation density, mobile ergonomics, and real-world video formats.
