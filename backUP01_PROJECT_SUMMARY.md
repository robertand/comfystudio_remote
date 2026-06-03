# StoryFlow - AI Animatic Studio

## Overview
StoryFlow is an AI-powered animatic and pre-visualization desktop application built for professionals in film, animation, and advertising. It provides a DaVinci Resolve/Blender-like UI/UX experience while integrating with ComfyUI for AI image and video generation.

## App Architecture
| Aspect | Details |
|--------|---------|
| **Type** | Web application (React + Vite) |
| **Runs in** | Browser (Chrome, Firefox, Edge, Safari) |
| **Platforms** | Windows, Mac, Linux - anywhere with a modern browser |
| **AI Backend** | ComfyUI running locally at `http://127.0.0.1:8188` |
| **Data Storage** | Browser localStorage (persists across sessions) |
| **Future Option** | Can be wrapped with Electron/Tauri for standalone desktop app |

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **State Management**: Zustand (with persist middleware for localStorage)
- **AI Backend**: ComfyUI (local instance at `http://127.0.0.1:8188`)
- **Workflow**: LTX-2 Text-to-Video model (workflow stored at `C:\Users\papa\Documents\ComfyUI_windows_portable\workflow-StoryFlow`)

## Project Location
`c:\Users\papa\Documents\coding_projects\general\comfyui_editing`

## Current Layout Structure (Updated)
```
┌─────────────────────────────────────────────────────┐
│                    Title Bar                         │
├────────────┬────────────────────────┬───────────────┤
│  Left      │                        │   Inspector   │
│  Panel     │       Preview          │   Panel       │
│  (Tabbed)  │       Panel            │               │
│            │                        │  - Transform  │
│ [Generate] │                        │  - Timing     │
│ [Assets]   │                        │  - Transitions│
│ [Workflows]│                        │  - Effects    │
│ [Settings] │                        │               │
├────────────┴────────────────────────┴───────────────┤
│              Timeline (Full Width)                   │
│  [⏮][⏪][◀][▶][▶][⏩][⏭] 00:00:00  +Video +Audio   │
│  ┌─────────────────────────────────────────────────┐│
│  │ Video 1  │ clip │ clip │                        ││
│  │ Video 2  │      │ clip │                        ││
│  │ Music    │                                      ││
│  │ Voiceover│                                      ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Key Features Built

### 1. Multi-Panel Layout (Blender-style)
- **Left Panel**: Tabbed content (Generate, Assets, Workflows, Settings) - width: 220-500px
- **Center**: Preview panel (video player with controls)
- **Right**: Inspector panel (Transform, Timing, Transitions, Effects) - width: 200-450px
- **Bottom**: Full-width Timeline spanning under all columns
- All panels are resizable via drag handles

### 2. Left Panel Tabs
- Thin tabs without icons, small font (10px)
- **Generate**: Video/Audio generation with prompts, workflow selection, settings
- **Assets**: Grid/list view of generated assets, drag to timeline
- **Workflows**: Collapsible category list, download/install workflows
- **Settings**: Collapsible accordion sections for ComfyUI, paths, appearance, defaults

### 3. Timeline with Playback Controls
- Full-width at bottom (like Blender's Video Sequence Editor)
- **Playback controls**: Skip to Start, Previous Clip, Frame Back, Play/Pause, Frame Forward, Next Clip, Skip to End
- **Timecode display**: MM:SS:FF format
- Multiple video tracks (Video 1, Video 2, etc.)
- Multiple audio tracks (Music, Voiceover, SFX)
- Drag & drop from Assets panel to tracks
- Click clips to select and preview
- Delete clips, playhead scrubbing, zoom control
- Track mute/lock/visibility controls

### 4. ComfyUI Integration
- Service class (`src/services/comfyui.js`) handles API communication
- Vite proxy configured to bypass CORS issues
- HTTP polling for generation completion (more reliable than WebSocket)
- Dynamic workflow modification for LTX-2 Text-to-Video

### 5. Video Generation
- Prompt/negative prompt inputs with quick style tags
- Workflow selector
- Duration presets (2s, 3s, 5s, 8s)
- **Resolutions**: 1920x1080 (Full HD), 1280x720 (HD), 1024x576, 768x512, 640x480
- Frame rate: 24fps, 30fps
- Seed with randomize button
- **"Generate with audio" checkbox** option
- Progress tracking during generation
- Auto-naming of generated assets (prompt snippet + increment)

### 6. Asset Management
- Zustand store (`src/stores/assetsStore.js`)
- 2-column grid view or compact list view
- Video thumbnails with hover preview
- Double-click to preview in main panel
- Drag to timeline
- Edit/delete functionality

### 7. Inspector Panel
- Transform controls (position, scale, rotation, opacity)
- Timing controls (duration presets)
- Transitions section (placeholder)
- Effects section (Ken Burns, Camera Shake, Color Grade placeholders)

### 8. Audio Generation UI
- Sub-tab in Generate panel for audio
- Types: Music, Voiceover, SFX
- Music: prompt, genre, mood, tempo, presets
- Voiceover: script input, voice selection, speed control
- SFX: prompt with quick presets (Whoosh, Impact, etc.)

## Key Files
| File | Description |
|------|-------------|
| `src/App.jsx` | Main layout with resizable panels (3-column + full-width timeline) |
| `src/components/LeftPanel.jsx` | **NEW** - Tabbed left panel container |
| `src/components/Timeline.jsx` | Full-width timeline with playback controls |
| `src/components/PreviewPanel.jsx` | Video preview with "Add to Timeline" button |
| `src/components/GeneratePanel.jsx` | AI generation interface (vertical layout) |
| `src/components/panels/AssetsPanel.jsx` | Asset management (2-col grid) |
| `src/components/panels/WorkflowsPanel.jsx` | Workflow library (collapsible) |
| `src/components/panels/SettingsPanel.jsx` | App settings (accordion style) |
| `src/components/InspectorPanel.jsx` | Properties/effects panel |
| `src/stores/assetsStore.js` | Zustand store for assets |
| `src/stores/timelineStore.js` | Zustand store for timeline |
| `src/services/comfyui.js` | ComfyUI API service |
| `src/hooks/useComfyUI.js` | React hook for generation logic |
| `vite.config.js` | Includes proxy config for ComfyUI |

## Running the App
```bash
cd c:\Users\papa\Documents\coding_projects\general\comfyui_editing
npm run dev
```
Then open `http://localhost:5173` (or 5174 if 5173 is in use)

**Important**: ComfyUI must be running at `http://127.0.0.1:8188` for generation to work.

## Pending/Future Work
- [ ] Timeline clip drag-and-drop (moving clips within timeline) - partially done, trimming works
- [ ] Actual Color Grade effect implementation (gain, gamma, saturation, RGB)
- [ ] Ken Burns / Camera Shake effects
- [ ] Text overlays
- [ ] Audio generation integration with ComfyUI
- [ ] Workflow download center (fetching workflows from GitHub)
- [ ] Cloud ComfyUI option for users without local GPU
- [ ] Connect "Generate with audio" checkbox to actual audio generation
- [ ] Export/render timeline to video file

## Recent Changes (Session 2 - Jan 28, 2026)

### Transport Controls Refactored
1. **Separated TransportControls Component** (`src/components/TransportControls.jsx`)
   - Moved video playback controls from PreviewPanel to standalone component
   - Anchored to TOP of timeline section (moves with timeline when resizing)
   - Controls: Skip to Start, Play/Pause, Skip to End, Timecode (MM:SS), Volume slider
   - Centered layout with volume on right

2. **Shared Video Playback State** (added to `src/stores/assetsStore.js`)
   - `videoRef`, `isPlaying`, `currentTime`, `duration`, `volume`
   - `registerVideoRef()`, `togglePlay()`, `seekTo()`, `skip()`, `setVolume()`
   - Allows TransportControls and PreviewPanel to share video state

3. **PreviewPanel Zoom & Pan Controls**
   - **Zoom Controls Bar** at bottom of preview:
     - Home button (reset to Fit)
     - Zoom Out / Zoom In buttons
     - Zoom dropdown: Fit, 25%, 50%, 75%, 100%, 150%, 200%
   - **Keyboard shortcuts**:
     - `Space + Drag` = Pan
     - `Space + Ctrl + Drag Left/Right` = Zoom in/out
   - CSS transform scale for reliable zooming
   - Cursor changes: grab, grabbing, ew-resize

4. **Fullscreen Mode** (PreviewPanel)
   - Click maximize button (top right) to enter fullscreen
   - Press ESC or minimize button to exit
   - **Fullscreen transport controls**: larger play/pause, skip buttons, timecode, volume
   - Zoom controls remain available in fullscreen
   - Video expands to 90vw × 85vh max

### Layout Updates
- Timeline default height: 240px (includes transport controls)
- Timeline min: 180px, max: 450px
- Transport controls height: 40px (10px in h-10 class)

## Key Files (Updated)
| File | Description |
|------|-------------|
| `src/App.jsx` | Main layout - now includes TransportControls above Timeline |
| `src/components/TransportControls.jsx` | **NEW** - Video playback controls (anchored to timeline) |
| `src/components/PreviewPanel.jsx` | Video preview with zoom/pan, fullscreen mode |
| `src/components/Timeline.jsx` | Timeline tracks (has its own playback controls for timeline scrubbing) |
| `src/stores/assetsStore.js` | Now includes shared video playback state |

## Previous Session Changes
1. Timeline Full-Width at bottom (like Blender)
2. Left Panel Tabs (Generate/Assets/Workflows/Settings)
3. Removed Scenes Tab
4. Vertical Panel Layouts
5. Timeline Playback Controls (for timeline scrubbing)
6. Timecode Display (MM:SS:FF)
7. 1920x1080 Resolution option
8. Generate with Audio Checkbox
9. Thinner Tabs

## Notes for Continuation
- The app uses a dark theme with custom Tailwind colors prefixed with `sf-` (e.g., `sf-dark-900`, `sf-accent`)
- ComfyUI workflows are JSON files that get dynamically modified before queuing
- Left panel min width is 220px, can expand to 500px
- Timeline height: 180-450px, default 240px (includes transport bar)
- User has RTX 5090, can handle 1920x1080 video generation
- **Single unified TransportControls** above timeline controls everything (timeline + preview)
- Fullscreen uses browser Fullscreen API (`document.fullscreenElement`, `requestFullscreen()`, `exitFullscreen()`)
- Zoom uses CSS `transform: scale()` for reliability
- **Data persists to localStorage** - survives browser refresh
- Timeline zoom range: 20% - 2000%

---

## Recent Changes (Session 3 - Jan 29, 2026)

### 1. Project Persistence (localStorage)
- **Zustand `persist` middleware** added to both stores
- Assets saved to `storyflow-assets` key (assets, assetCounter, volume)
- Timeline saved to `storyflow-timeline` key (duration, zoom, tracks, clips, transitions)
- Transient state excluded (videoRef, isPlaying, currentTime, selectedClipId)
- `clearProject()` method on both stores for "New Project" functionality

### 2. Functional Timeline Playback
- **Timeline actually plays clips now** like a real NLE
- `useTimelinePlayback` hook (`src/hooks/useTimelinePlayback.js`) manages playback loop
- Playhead advances in real-time using `requestAnimationFrame`
- PreviewPanel shows active clip at playhead position
- Auto-stops at end of last clip
- Syncs video element currentTime with timeline position

### 3. Clip Trimming
- **Drag handles** on left/right edges of clips
- Left handle: adjusts in-point and start time
- Right handle: adjusts out-point and duration
- Duration displayed on each clip (bottom-right corner)
- Clips have `trimStart`, `trimEnd`, `sourceDuration` properties
- Visual feedback: ring highlight while trimming

### 4. Transitions (Dissolves)
- **Transition system** added to timelineStore
- `transitions` array stores transition objects
- Click **"+" button** between adjacent clips to add dissolve
- Click **"X"** to remove transition
- During playback: crossfade with opacity blend
- Shows "Dissolve XX%" indicator in PreviewPanel
- Two video elements in PreviewPanel for smooth crossfades

### 5. Preview Panel - Timeline Mode
- **Two modes**: Asset Preview vs Timeline Preview
- Timeline mode activates when playing timeline or clicking "Preview Timeline"
- Shows active clip name and transition progress
- "Exit Timeline View" button to return to asset mode
- Handles gaps (shows "No clip at this position")

### 6. Scroll-to-Zoom on Timeline
- **Mouse wheel zooms** when hovering over timeline
- Scroll up = zoom in, scroll down = zoom out
- Zoom centered on mouse position
- Auto-adjusts scroll position to keep focus point

### 7. Draggable Playhead (Real-time Scrubbing)
- **Click and drag** anywhere on timeline to scrub
- Playhead follows mouse in real-time
- Can grab playhead head (red triangle) directly
- Cursor changes to `ew-resize` while scrubbing
- Works outside timeline bounds (continues scrubbing)

### 8. Unified Transport Controls
- **Removed duplicate controls** from timeline header
- Single `TransportControls` component handles everything
- Full controls: Skip Start, Prev Clip, Frame Back, Play/Pause, Frame Forward, Next Clip, Skip End
- Timecode display: `MM:SS:FF / MM:SS:FF`
- "Timeline" mode indicator when playing timeline
- Volume slider on right
- Timeline header now only has: +Video, +Audio buttons, clip count, zoom slider

### 9. Extended Timeline Zoom
- Zoom range: **20% to 2000%** (was 50-200%)
- +/- buttons step by 50
- Wider slider for fine control
- "Scroll to zoom" hint

### 10. Cinematography Tags System (Generate Panel)
Professional shot description categories for filmmakers:

**Categories (10 total):**
- **Shot**: ECU, Close-up, Medium, Wide, OTS, POV, Two-shot, etc.
- **Movement**: Static, Pan, Tilt, Dolly, Tracking, Drone, Orbit, Whip pan, etc.
- **Angle**: Eye level, Low angle, High angle, Bird's eye, Dutch angle, etc.
- **Lighting**: Golden hour, Blue hour, Low key, Dramatic, Rim lighting, Neon, etc.
- **Mood**: Cinematic, Epic, Mysterious, Tense, Romantic, Ethereal, etc.
- **Style**: Film noir, Documentary, Blockbuster, Indie, Sci-fi, Horror, etc.
- **Color**: Teal & orange, Desaturated, Warm/Cool tones, B&W, etc.
- **Speed**: Slow motion, Time-lapse, Hyperlapse
- **Depth**: Shallow DOF, Bokeh, Deep focus, Rack focus
- **Lens**: Anamorphic, Wide angle, Telephoto, 35mm film look

**UI Features:**
- Scrollable category tabs with arrow buttons
- Pills for each category option
- Click to add tag (shows ✓), click again to remove
- Selected tags shown below with quick-remove
- "Clear all" button
- Tags auto-added/removed from prompt text

### Key Files (Session 3 Updates)
| File | Changes |
|------|---------|
| `src/stores/assetsStore.js` | Added `persist` middleware, `clearProject()` |
| `src/stores/timelineStore.js` | Added `persist`, transitions, trim functions, `getActiveClipAtTime()`, `getTransitionAtTime()`, `getTimelineEndTime()` |
| `src/hooks/useTimelinePlayback.js` | **NEW** - Timeline playback loop with RAF |
| `src/components/Timeline.jsx` | Trim handles, transition buttons, scroll-to-zoom, draggable playhead, removed duplicate controls |
| `src/components/PreviewPanel.jsx` | Timeline mode, dual video elements for transitions, mode switching |
| `src/components/TransportControls.jsx` | Full transport controls, timeline/asset mode unified |
| `src/components/GeneratePanel.jsx` | CinematographyTags component with 10 categories |

### Timeline Store - New Properties
```javascript
// Clip properties (updated)
clip = {
  id, trackId, assetId, name, startTime,
  duration,        // Visible duration on timeline
  sourceDuration,  // Original video duration
  trimStart,       // In-point (seconds from source start)
  trimEnd,         // Out-point (seconds from source start)
  color, type, url, thumbnail
}

// Transitions
transition = {
  id, clipAId, clipBId,
  type: 'dissolve',  // Future: 'fade', 'wipe', etc.
  duration: 0.5      // Transition duration in seconds
}
```

### TransportControls - Button Order
`[Skip Start] [Prev Clip] [Frame Back] [▶ Play] [Frame Forward] [Next Clip] [Skip End] [Timecode] ... [Volume]`

---

## Recent Changes (Session 4 - Jan 29, 2026)

### 1. Timeline Snapping System (Professional NLE Feature)
Added a comprehensive snapping system to make the timeline feel like a professional NLE (DaVinci Resolve, Premiere, etc.):

**Snap Points:**
- **Playhead**: Clips snap to current playhead position
- **Clip Edges**: Clips snap to start/end of other clips (great for seamless cuts)
- **Grid**: Snaps to time grid (interval based on zoom level)

**Features:**
- **Magnetic snapping** with configurable threshold (10px default)
- **Visual snap guides**: Yellow vertical line appears when snapping occurs
  - Diamond indicator at top
  - Time tooltip showing exact snap position
  - Glowing effect for visibility
- **Snapping toggle button** in timeline header with magnet icon
- **Keyboard shortcut**: Press `S` to toggle snapping on/off
- **Persisted preference**: Snapping state saved to localStorage

### 2. Clip Dragging (Move Clips Horizontally)
Clips can now be dragged to reposition them on the timeline:
- **Click and drag** any clip to move it horizontally
- **Snapping integration**: Clips snap to playhead and other clip edges while dragging
- **Visual feedback**: Clip gets accent ring and slight opacity when being dragged
- **Cursor changes**: `grab` → `grabbing` during drag

### 3. Enhanced Trim Handles with Snapping
Trim handles now also support snapping:
- **Left trim handle**: In-point snaps to playhead and clip edges
- **Right trim handle**: Out-point snaps to playhead and clip edges
- Visual snap guide appears during trimming

### 4. Keyboard Shortcuts Added
- `S` - Toggle snapping on/off
- `Delete` / `Backspace` - Delete selected clip

### Key Files (Session 4 Updates)
| File | Changes |
|------|---------|
| `src/hooks/useSnapping.js` | **NEW** - Snapping logic hook with snap point calculation |
| `src/stores/timelineStore.js` | Added `snappingEnabled`, `snappingThreshold`, `activeSnapTime`, toggle functions |
| `src/components/Timeline.jsx` | Added clip dragging, snap guides, snapping toggle button, keyboard shortcuts |

### Timeline Store - New Properties
```javascript
// Snapping settings
snappingEnabled: true,      // Global snapping toggle
snappingThreshold: 10,      // Snap activation distance in pixels
activeSnapTime: null,       // Current snap position for visual feedback

// New methods
toggleSnapping()            // Toggle snapping on/off
setSnappingEnabled(bool)    // Set snapping state
setSnappingThreshold(px)    // Set snap threshold (5-30px)
setActiveSnapTime(time)     // Set active snap for visual guide
clearActiveSnap()           // Clear snap visual
```

### useSnapping Hook API
```javascript
const {
  snappingEnabled,          // Is snapping turned on
  findNearestSnap,          // Find snap point near a time
  snapClipPosition,         // Snap a clip's position (checks both edges)
  snapTrim,                 // Snap a trim operation
  getSnapPoints,            // Get all snap points
  getVisibleSnapLines,      // Get snap lines for rendering
  thresholdInSeconds,       // Threshold converted to time
  pixelsPerSecond           // Current zoom ratio
} = useSnapping()
```

---

## Recent Changes (Session 4 continued - Phase 2)

### 1. Multi-Select System
Professional multi-selection for clips:

**Selection Methods:**
- **Click**: Select single clip (replaces selection)
- **Shift+Click**: Add clip to selection
- **Ctrl/Cmd+Click**: Toggle clip in selection
- **Ctrl/Cmd+A**: Select all clips
- **Escape**: Clear selection
- **Click empty space**: Clear selection

**Visual Feedback:**
- Selected clips show white ring
- Selection count displayed in header when >1 clip selected
- All selected clips highlight during drag

### 2. Multi-Clip Dragging
When multiple clips are selected:
- Dragging one moves ALL selected clips together
- Snapping applies to primary dragged clip
- All clips maintain relative positions
- Visual feedback on all dragged clips

### 3. Ripple Edit Mode
Toggle with **R key** or **Ripple button** in header:
- When ON (orange): Moving a clip shifts all subsequent clips on same track
- When OFF: Clips move independently (overwrite mode)
- Great for insert editing workflows

### 4. Enhanced Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `S` | Toggle snapping |
| `R` | Toggle ripple edit mode |
| `Delete` / `Backspace` | Delete selected clip(s) |
| `Escape` | Clear selection |
| `Ctrl/Cmd + A` | Select all clips |

### 5. Video Player - Disabled Browser Menu
- Removed native browser right-click menu from all video elements
- No more "Save video as..." etc. appearing
- Ready for custom context menu in future

### Key Files (Phase 2 Updates)
| File | Changes |
|------|---------|
| `src/stores/timelineStore.js` | `selectedClipIds` array, `rippleEditMode`, multi-select functions |
| `src/components/Timeline.jsx` | Multi-select UI, ripple toggle, multi-drag support |
| `src/components/PreviewPanel.jsx` | Disabled native video context menu |

### Timeline Store - New Properties (Phase 2)
```javascript
// Multi-select
selectedClipIds: [],           // Array of selected clip IDs (was selectedClipId)

// Ripple edit  
rippleEditMode: false,         // When true, moving clips shifts subsequent clips

// New methods
selectClip(id, { addToSelection, toggleSelection })  // Multi-select support
clearSelection()               // Clear all selections
selectClips(ids)               // Select multiple clips
removeSelectedClips()          // Delete all selected
moveSelectedClips(deltaTime)   // Move all selected by delta
toggleRippleEdit()             // Toggle ripple mode
```

### Next Steps (Phase 3)
- [ ] Marquee/box selection for clips
- [ ] JKL shuttle playback controls
- [ ] I/O in/out point marking
- [ ] Draggable transition handles
- [ ] More transition types (fade, wipe, slide)
- [ ] Custom right-click context menu

---

## Notes for Next Session (IMPORTANT)

### Current State Summary (Session 4 - Jan 29, 2026)
The timeline now has **professional NLE features**:
1. **Snapping System** - Clips snap to playhead, other clips, grid (toggle with `S` key)
2. **Multi-Select** - Shift+click, Ctrl+click, Ctrl+A (select all), Escape (clear)
3. **Multi-Clip Drag** - Select multiple clips and drag together
4. **Ripple Edit Mode** - Toggle with `R` key, shifts subsequent clips when moving
5. **Video player** - Native browser context menu disabled (ready for custom menu)

### Key Files Modified This Session
| File | What Changed |
|------|--------------|
| `src/hooks/useSnapping.js` | **NEW** - Snapping logic hook |
| `src/stores/timelineStore.js` | Multi-select (`selectedClipIds`), ripple edit, snapping state |
| `src/components/Timeline.jsx` | Clip dragging, snapping UI, multi-select, ripple toggle |
| `src/components/PreviewPanel.jsx` | Disabled native video context menu |

### Timeline Store State (Current)
```javascript
// Selection (changed from single to multi)
selectedClipIds: [],           // Array of clip IDs (was selectedClipId: null)

// Snapping
snappingEnabled: true,
snappingThreshold: 10,         // pixels
activeSnapTime: null,          // for visual feedback

// Ripple Edit
rippleEditMode: false,
```

### All Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `S` | Toggle snapping |
| `R` | Toggle ripple edit |
| `Delete` / `Backspace` | Delete selected clip(s) |
| `Escape` | Clear selection |
| `Ctrl/Cmd + A` | Select all clips |
| `Space + Drag` | Pan preview |
| `Space + Ctrl + Drag` | Zoom preview |

### Timeline Header Buttons (Left to Right)
`[+Video] [+Audio] [Snap] [Ripple] [X selected] [X clips] ... [Zoom controls]`

### Running the App
```bash
cd c:\Users\papa\Documents\coding_projects\general\comfyui_editing
npm run dev
```
Opens at `http://localhost:5173` (or 5174 if 5173 is in use)

### Important Technical Notes
- Uses Zustand with `persist` middleware - state survives browser refresh
- Custom Tailwind colors prefixed with `sf-` (e.g., `sf-dark-900`, `sf-accent`)
- Timeline zoom range: 20% - 2000%
- Snapping threshold: 5-30px (default 10px)
- User has RTX 5090 - can handle 1920x1080 video generation

### Phases Completed
- **Phase 1**: Snapping system (snap to playhead, clips, grid + visual guides)
- **Phase 2**: Multi-select + Ripple edit mode + Multi-clip dragging

---

## Recent Changes (Session 5 - Jan 29, 2026) - Phase 3

### 1. Marquee/Box Selection
- **Alt+Drag** on empty timeline area to draw selection rectangle
- Clips that intersect the rectangle are selected
- **Shift+Alt+Drag** to add to existing selection
- Visual feedback with accent-colored selection box
- Header hint: "Alt+Drag=Marquee"

### 2. JKL Shuttle Playback Controls
Professional NLE-style playback with speed ramping:

| Key | Action | Speed Ramping |
|-----|--------|---------------|
| **J** | Play reverse | Press multiple: 1x → 2x → 4x → 8x |
| **K** | Pause/Stop | Stops playback |
| **L** | Play forward | Press multiple: 1x → 2x → 4x → 8x |
| **K+J** | Slow reverse | 0.5x reverse |
| **K+L** | Slow forward | 0.5x forward |

- Playback rate indicator shows current speed (e.g., "◀◀ 2x", "▶▶▶ 8x")
- Visual indicator in transport controls when in shuttle mode

### 3. In/Out Point Marking (Three-Point Editing)
- **I** key - Set In point at playhead
- **O** key - Set Out point at playhead
- **Alt+X** - Clear both In and Out points
- **Click In/Out buttons** - Jump to that point (or set if not defined)
- Visual indicators:
  - Blue vertical lines with "I" and "O" labels
  - Blue highlighted range between In and Out points
  - In/Out buttons in transport controls

### 4. More Transition Types
9 transition types available:

| Type | Description | Icon |
|------|-------------|------|
| Dissolve | Crossfade between clips | ⚪ |
| Fade to Black | Fade out then in via black | ⬛ |
| Fade to White | Fade out then in via white | ⬜ |
| Wipe Left | Reveal from right to left | ◀ |
| Wipe Right | Reveal from left to right | ▶ |
| Wipe Up | Reveal from bottom to top | ▲ |
| Wipe Down | Reveal from top to bottom | ▼ |
| Slide Left | Push outgoing clip left | ⇠ |
| Slide Right | Push outgoing clip right | ⇢ |

- Click "+" between clips to open transition type selection menu
- All transitions render correctly in PreviewPanel

### 5. Draggable Transition Handles
- Hover over transition indicator to reveal duration handles
- Drag left/right edges to adjust transition duration (0.1s - 3.0s)
- Duration label shows on hover
- Click transition indicator to remove

### 6. Custom Right-Click Context Menus

**Timeline Clip Context Menu:**
| Action | Description |
|--------|-------------|
| Preview | Open clip in preview panel |
| Split at Playhead | Split clip at current playhead position |
| Duplicate | Create copy of clip after current |
| Set In to Playhead | Trim clip start to playhead |
| Set Out to Playhead | Trim clip end to playhead |
| Delete | Remove clip(s) from timeline |

**Preview Panel Context Menu:**
| Action | Description |
|--------|-------------|
| Play/Pause | Toggle playback |
| Add to Timeline | Add current asset to Video 1 track |
| Fit to View | Reset zoom to fit |
| Zoom 100% | Set zoom to 100% |
| Fullscreen | Toggle fullscreen mode |

### Key Files (Phase 3 Updates)
| File | Changes |
|------|---------|
| `src/components/Timeline.jsx` | Marquee selection, I/O point markers, transition type menu, draggable handles, clip context menu |
| `src/components/TransportControls.jsx` | JKL keyboard handlers, I/O point controls, playback rate display |
| `src/components/PreviewPanel.jsx` | Transition effects renderer, video context menu |
| `src/stores/timelineStore.js` | JKL shuttle state, I/O points state, shuttle methods |
| `src/hooks/useTimelinePlayback.js` | Variable playback rate support |

### Timeline Store - New Properties (Phase 3)
```javascript
// JKL Shuttle
playbackRate: 1,        // Playback speed (-8 to 8, negative = reverse)
shuttleMode: false,     // Whether in shuttle mode

// In/Out Points
inPoint: null,          // In point time (seconds)
outPoint: null,         // Out point time (seconds)

// New methods
shuttleReverse()        // J key - play reverse with speed ramping
shuttlePause()          // K key - pause
shuttleForward()        // L key - play forward with speed ramping
shuttleSlow(direction)  // K+J/K+L - slow playback
setInPoint(time)        // Set in point (defaults to playhead)
setOutPoint(time)       // Set out point (defaults to playhead)
clearInOutPoints()      // Clear both points
goToInPoint()           // Jump to in point
goToOutPoint()          // Jump to out point
```

### All Keyboard Shortcuts (Updated)
| Key | Action |
|-----|--------|
| `J` | Play reverse / increase reverse speed |
| `K` | Pause |
| `L` | Play forward / increase forward speed |
| `K+J` | Slow reverse (0.5x) |
| `K+L` | Slow forward (0.5x) |
| `I` | Set In point at playhead |
| `O` | Set Out point at playhead |
| `Alt+X` | Clear In/Out points |
| `S` | Toggle snapping |
| `R` | Toggle ripple edit |
| `Delete` / `Backspace` | Delete selected clip(s) |
| `Escape` | Clear selection |
| `Ctrl/Cmd + A` | Select all clips |
| `Alt + Drag` | Marquee selection |
| `Shift + Alt + Drag` | Marquee add to selection |
| `Shift + Click` | Add to selection |
| `Ctrl/Cmd + Click` | Toggle in selection |
| `Space + Drag` | Pan preview |
| `Space + Ctrl + Drag` | Zoom preview |

### Phases Completed
- **Phase 1**: Snapping system
- **Phase 2**: Multi-select + Ripple edit mode
- **Phase 3**: Marquee selection, JKL controls, I/O points, transitions, context menus

---

## Recent Changes (Session 5 continued - Jan 29, 2026)

### 1. Aspect Ratio Selector
Added professional aspect ratio selector in PreviewPanel header:

| Ratio | Name | Color | Use Case |
|-------|------|-------|----------|
| 16:9 | Widescreen | Blue | YouTube, standard video |
| 9:16 | Vertical | Purple | TikTok, Instagram Reels |
| 1:1 | Square | Green | Instagram posts |
| 4:5 | Portrait | Pink | Instagram portrait |
| 21:9 | Cinematic | Amber | Ultra-wide cinema |

**Features:**
- Dropdown in preview header with colored icons
- Video container automatically resizes to selected ratio
- Zoom resets to "Fit" when changing ratio
- Aspect ratio indicator shown in empty state

### 2. Subtle Grid Pattern Background
- Preview area has subtle grid pattern (20px squares)
- Very low opacity (2%) white lines on dark background
- Provides visual reference like professional NLE software

### 3. Fixed Video Looping Issue
**Problem:** When timeline stopped playing, video would loop the last selected clip.

**Root Cause:** Clicking timeline clips was calling `setPreview(asset)` which switched to asset preview mode with `loop` enabled.

**Fix:**
- Clicking timeline clips now just selects and moves playhead (no longer sets preview)
- PreviewPanel stays in timeline mode when clips exist on timeline
- Added explicit `loop={false}` on timeline mode videos
- Added effect to pause videos when timeline stops
- Asset preview mode only used when NO clips on timeline

### 4. Fixed Space Key in Input Fields
**Problem:** Pressing Space to type in prompt box was being captured for pan feature.

**Fix:** Added check in PreviewPanel keyboard handler to skip Space capture when typing in INPUT, TEXTAREA, or contenteditable elements.

### 5. Fixed videoTracks Initialization Order
**Problem:** `videoTracks` and `audioTracks` were used in useEffect before being defined.

**Fix:** Moved the definitions to earlier in Timeline.jsx (after store hooks, before effects).

### Key Files (Session 5 continued)
| File | Changes |
|------|---------|
| `src/components/PreviewPanel.jsx` | Aspect ratio selector, grid pattern, video looping fixes, space key fix |
| `src/components/Timeline.jsx` | Removed setPreview on clip click, fixed variable initialization order |

### PreviewPanel State (New)
```javascript
// Aspect Ratio
aspectRatio: '16:9',           // Current aspect ratio ID
showAspectDropdown: false,     // Dropdown visibility

// ASPECT_RATIOS constant with: id, label, name, ratio, icon, color
```

### Important Behavior Notes
1. **Timeline Mode vs Asset Mode:**
   - If clips exist on timeline → always use timeline mode
   - Asset mode only when NO clips (for previewing assets before adding)
   - Clicking clips selects and moves playhead, doesn't switch modes

2. **Video Elements:**
   - Timeline videos: `loop={false}`, pause when timeline stops
   - Asset preview videos: `loop={true}` for reviewing assets

3. **Keyboard Input:**
   - Space, J, K, L, I, O keys are ignored when typing in input fields

### Recent Changes (Session 6 - Jan 29, 2026)

### Collapsible Left Panel with Icon Toolbar
Redesigned the left panel to use a VS Code/Figma-style icon toolbar:

**Layout:**
- **Icon Toolbar** (48px wide): Always visible, contains vertical icons for each panel
- **Content Panel** (200-450px): Collapsible, shows the active panel content

**Icons (top to bottom):**
- Sparkles - Generate panel
- FolderOpen - Assets panel
- Workflow - Workflows panel
- Settings - Settings panel
- Chevron (bottom) - Collapse/Expand toggle

**Behavior:**
- Click an icon to open that panel (expands if collapsed)
- Click the active icon again to collapse the panel
- Click a different icon when expanded to switch panels
- Chevron button at bottom toggles expand/collapse
- Smooth 200ms transition animation when expanding/collapsing

**Visual Feedback:**
- Active tab has accent-colored left border indicator
- Hover tooltips show panel name
- Panel header shows current panel name when expanded

**Resize:**
- Content panel is resizable when expanded (200-450px)
- Resize handle hidden when collapsed
- Icon bar width is fixed at 48px

### Collapsible Right Panel (Inspector) - Symmetrical Design
The Inspector panel now mirrors the left panel design:

**Layout:**
- **Content Panel** (200-400px): Collapsible, shows inspector content
- **Icon Toolbar** (48px wide): Always visible on the right edge

**Icon:**
- SlidersHorizontal - Inspector panel (single icon since it's one panel)
- Chevron (bottom) - Collapse/Expand toggle

**Behavior:**
- Click the inspector icon to toggle expand/collapse
- Chevron button at bottom also toggles
- Active state shows accent-colored right border indicator
- Smooth 200ms transition animation

**Symmetry:**
- Both left and right panels can be collapsed independently
- When both are collapsed, preview panel gets maximum width
- Icon bars are always visible on both edges (48px each)
- Total collapsed width: 96px (both icon bars)

### Track Management - Add & Delete Tracks
Added the ability to dynamically add and delete tracks on the timeline:

**Add Tracks:**
- `+Video` and `+Audio` buttons in timeline header (already existed)
- Tracks are numbered sequentially (Video 1, Video 2, etc.)
- Unique IDs generated based on highest existing track number

**Delete Tracks:**
- Hover over track header to reveal delete button (X icon)
- Confirmation dialog if track contains clips
- **Protection**: Cannot delete the last video or audio track (must keep at least one of each)
- Deleting a track also removes all clips on that track

**Rename Tracks:**
- Double-click track name to edit inline
- Or click pencil icon (appears on hover)
- Press Enter to confirm, Escape to cancel
- Track names persist to localStorage

**UI Details:**
- Delete button: red X icon, appears on hover
- Rename button: pencil icon, appears on hover
- Inline text input with accent border when editing
- Check/X buttons to confirm or cancel rename

### Key Files (Session 6 Updates)
| File | Changes |
|------|---------|
| `src/stores/timelineStore.js` | Added `removeTrack()`, `renameTrack()` functions |
| `src/components/Timeline.jsx` | Track delete/rename UI, confirmation dialogs |

### Timeline Store - New Methods
```javascript
// Remove a track (and all its clips)
removeTrack(trackId)  // Returns false if last track of type

// Rename a track
renameTrack(trackId, newName)
```

### Phase 4 TODO (Future)
- [ ] Keyboard shortcuts for split (C key)
- [ ] Keyboard shortcuts for duplicate (Ctrl+D)
- [ ] Undo/Redo system
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization
- [ ] Export/render to video file
- [ ] Text overlays/titles
- [ ] Asset preview in Assets panel (hover or separate viewer)

### Running the App
```bash
cd c:\Users\papa\Documents\coding_projects\general\comfyui_editing
npm run dev
```
Opens at `http://localhost:5173` (or next available port)

### Reference: React Video Editor
User referenced https://www.reactvideoeditor.com/ as inspiration for NLE feel.
Goal is to make timeline interactions feel like DaVinci Resolve / Premiere Pro.

---

## NOTES FOR NEXT SESSION (Session 7+)

### Current UI Layout (After Session 6)
```
┌──────────────────────────────────────────────────────────────┐
│                        Title Bar                              │
├──┬─────────────┬────────────────────────────┬─────────────┬──┤
│  │   Content   │                            │   Content   │  │
│I │   Panel     │         Preview            │   Panel     │I │
│C │  (Generate  │         Panel              │  (Inspector)│C │
│O │   Assets    │                            │             │O │
│N │  Workflows  │                            │  Transform  │N │
│  │  Settings)  │                            │  Timing     │  │
│B │             │                            │  Effects    │B │
│A │ Collapsible │                            │ Collapsible │A │
│R │  200-450px  │                            │  200-400px  │R │
├──┴─────────────┴────────────────────────────┴─────────────┴──┤
│                    Transport Controls                         │
├──────────────────────────────────────────────────────────────┤
│                    Timeline (Full Width)                      │
│  Track Headers │ Track Content (clips, transitions)           │
└──────────────────────────────────────────────────────────────┘

Icon Bars: 48px each, always visible on left and right edges
When collapsed: Only icon bars show (96px total width)
```

### Key State Managed in App.jsx
```javascript
// Left Panel
leftPanelExpanded: true/false     // Is content panel visible
leftPanelTab: 'generate'          // Active tab: generate|assets|workflows|settings
leftPanelWidth: 280               // Content panel width (pixels)

// Right Panel (Inspector)
inspectorExpanded: true/false     // Is content panel visible
inspectorWidth: 256               // Content panel width (pixels)

// Constants
ICON_BAR_WIDTH: 48                // Fixed icon toolbar width
```

### Component Props

**LeftPanel.jsx:**
```javascript
<LeftPanel 
  isExpanded={leftPanelExpanded}
  onToggleExpanded={() => setLeftPanelExpanded(!leftPanelExpanded)}
  activeTab={leftPanelTab}
  onTabChange={setLeftPanelTab}
/>
```

**InspectorPanel.jsx:**
```javascript
<InspectorPanel 
  selectedItem={selectedItem}
  isExpanded={inspectorExpanded}
  onToggleExpanded={() => setInspectorExpanded(!inspectorExpanded)}
/>
```

### All Keyboard Shortcuts (Complete List)
| Key | Action |
|-----|--------|
| `J` | Play reverse / increase reverse speed |
| `K` | Pause |
| `L` | Play forward / increase forward speed |
| `K+J` | Slow reverse (0.5x) |
| `K+L` | Slow forward (0.5x) |
| `I` | Set In point at playhead |
| `O` | Set Out point at playhead |
| `Alt+X` | Clear In/Out points |
| `S` | Toggle snapping |
| `R` | Toggle ripple edit |
| `Delete` / `Backspace` | Delete selected clip(s) |
| `Escape` | Clear selection |
| `Ctrl/Cmd + A` | Select all clips |
| `Alt + Drag` | Marquee selection |
| `Shift + Alt + Drag` | Marquee add to selection |
| `Shift + Click` | Add clip to selection |
| `Ctrl/Cmd + Click` | Toggle clip in selection |
| `Space + Drag` | Pan preview (when not in input field) |
| `Space + Ctrl + Drag` | Zoom preview |
| `Double-click track name` | Rename track |

### Key Files Summary
| File | Purpose |
|------|---------|
| `src/App.jsx` | Main layout, panel state management, resize handlers |
| `src/components/LeftPanel.jsx` | Collapsible left panel with icon toolbar |
| `src/components/InspectorPanel.jsx` | Collapsible right panel with icon toolbar |
| `src/components/Timeline.jsx` | Multi-track timeline with clips, snapping, selection |
| `src/components/TransportControls.jsx` | JKL shuttle, I/O points, playback controls |
| `src/components/PreviewPanel.jsx` | Video preview with zoom/pan, aspect ratio, transitions |
| `src/components/GeneratePanel.jsx` | AI video generation with cinematography tags |
| `src/stores/timelineStore.js` | Timeline state (tracks, clips, transitions, selection) |
| `src/stores/assetsStore.js` | Asset library state (generated videos) |
| `src/hooks/useSnapping.js` | Timeline snapping logic |
| `src/hooks/useTimelinePlayback.js` | Timeline playback with variable rate |

### Technical Notes
- **Tailwind colors**: Custom `sf-` prefix (e.g., `sf-dark-900`, `sf-accent`)
- **State persistence**: Zustand with `persist` middleware → localStorage
- **Transitions**: 200ms ease-out for panel expand/collapse animations
- **ComfyUI**: Must be running at `http://127.0.0.1:8188`
- **User hardware**: RTX 5090 (can handle 1920x1080 video generation)

### What Was Built in Session 6
1. **Collapsible Left Panel** - Icon toolbar + expandable content panel
2. **Collapsible Right Panel** - Symmetrical design mirroring left
3. **Track Management** - Add/delete/rename tracks dynamically
4. Icons used: Sparkles, FolderOpen, Workflow, Settings, SlidersHorizontal, ChevronLeft/Right

### Pending Features (Phase 4+)
- [ ] Keyboard shortcuts: C (split), Ctrl+D (duplicate)
- [x] Undo/Redo system ✅ (Session 7)
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization
- [ ] Export/render to video file
- [ ] Text overlays/titles
- [ ] Asset hover preview in Assets panel

---

## Recent Changes (Session 7 - Jan 30, 2026)

### 1. NLE-Style Clip Overlap/Overwrite Behavior
When clips on the same track overlap, the underlying clip is now properly cut/trimmed:

**Four overlap scenarios handled:**
- **Complete cover**: If new clip completely covers existing clip → existing clip removed
- **Cut beginning**: If new clip overlaps start of existing clip → existing clip trimmed from start
- **Cut end**: If new clip overlaps end of existing clip → existing clip trimmed from end  
- **Split in middle**: If new clip lands in middle of existing clip → existing clip split into two

**Implementation:**
- Overlap resolution happens **only on mouse release** (not during drag)
- While dragging, clips can freely pass over each other
- On drop, overlapping clips are cut/trimmed/split
- Works for both `addClip()`, `moveClip()`, and `moveSelectedClips()`

### 2. Undo/Redo System
Full undo/redo support for timeline operations:

**Keyboard Shortcuts:**
- `Ctrl+Z` (or `Cmd+Z` on Mac) - Undo
- `Ctrl+Shift+Z` or `Ctrl+Y` - Redo

**UI:**
- Undo/Redo buttons in timeline header (between Ripple toggle and selection count)
- Buttons disabled (grayed out) when nothing to undo/redo

**Features:**
- Maximum 50 undo states (configurable via `MAX_HISTORY_SIZE`)
- History saved before: adding clips, deleting clips, moving clips (on drop), trimming (on release), adding/removing transitions, removing/renaming tracks
- History NOT saved during dragging (prevents flooding)
- Selection cleared on undo/redo
- History cleared on new project

**New Store Methods:**
```javascript
saveToHistory()    // Save current state snapshot
undo()             // Restore previous state
redo()             // Restore next state
canUndo()          // Returns true if undo available
canRedo()          // Returns true if redo available
clearHistory()     // Clear all history
```

### 3. Trim Handle Collision Detection
Trim handles now stop at neighboring clips instead of overlapping:

- **Trimming right edge**: Stops when reaching the start of the next clip on same track
- **Trimming left edge**: Stops when reaching the end of the previous clip on same track
- Snapping still works but won't snap past neighbors
- Prevents accidental overwrites while trimming

### 4. DaVinci Resolve-Style Clip Visuals
Clips now look more like DaVinci Resolve:

**Video Clips:**
- **Color bar at top** (3px) - Clip's color shown as header bar
- **Filmstrip thumbnails** - Multiple video frame thumbnails across clip width
- **Gradient overlay** - Subtle gradient from top for text readability
- **Clip name at top-left** - With drop shadow
- **Duration badge** - Bottom-right pill with semi-transparent background
- **Dark background** - `sf-dark-800` body with colored top bar
- **Better selection ring** - White ring with offset
- **Edge borders** - Subtle dark borders on left/right

**Audio Clips:**
- **Waveform visualization** - Deterministic pseudo-random waveform based on clip ID
- **Colored waveform bars** - Uses track color
- **Color bar at top** - Same style as video clips
- **Label with background** - Name in semi-transparent pill

**General:**
- Removed excessive padding (clips use `top-0.5 bottom-0.5`)
- Subtle rounded corners (`rounded-sm`)
- Hover effects more subtle (slight white overlay)
- Removed trash can icon from clips (use Delete key or context menu)

### 5. Larger Trim Handles
Trim handles are now much easier to grab:
- **Width increased**: From 6px to 16px (`w-4`)
- **Visual indicator**: 4px wide bar that appears on hover
- **Better styling**: Subtle background highlight, visible grab bar
- **Rounded edges**: Outer side rounded for polished look

### 6. Roll Edit (Edit Point Dragging)
Drag between two adjacent clips to move the edit point:

**How it works:**
- Hover between two adjacent clips → yellow line appears
- Cursor changes to `ew-resize`
- Drag left/right to move the edit point:
  - Dragging left: shortens clip A, extends clip B
  - Dragging right: extends clip A, shortens clip B
- Total duration stays the same

**Constraints:**
- Each clip must maintain at least 0.5 seconds duration
- Can't extend past source duration
- Action saved to undo history

**Works on:**
- Video tracks (transition button still visible)
- Audio tracks

### 7. Removed Intrusive UI Elements
- **Removed trash can icons** from clips (use Delete/Backspace or context menu)
- **Removed "Generate AI Audio" button** from empty audio tracks (use Generate tab instead)
- Empty audio tracks now show simple hint: "Drag audio from Assets"

### Key Files (Session 7 Updates)
| File | Changes |
|------|---------|
| `src/stores/timelineStore.js` | Undo/redo system, `resolveOverlaps()`, history state/methods, overlap handling in `moveClip()`/`moveSelectedClips()` |
| `src/components/Timeline.jsx` | DaVinci-style clip visuals, larger trim handles, roll edit zones, trim collision detection, undo/redo buttons/shortcuts, removed trash icons |

### Timeline Store - New Properties (Session 7)
```javascript
// Undo/Redo
history: [],           // Array of past state snapshots
historyIndex: -1,      // Current position in history

// New methods
saveToHistory()        // Save snapshot before changes
undo()                 // Go back in history
redo()                 // Go forward in history
canUndo()              // Check if undo available
canRedo()              // Check if redo available
clearHistory()         // Clear all history

// Updated methods (new parameter)
moveClip(clipId, trackId, startTime, resolveOverlaps = false)
moveSelectedClips(deltaTime, trackId, resolveOverlaps = false)
```

### All Keyboard Shortcuts (Updated - Session 7)
| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `J` | Play reverse / increase reverse speed |
| `K` | Pause |
| `L` | Play forward / increase forward speed |
| `K+J` | Slow reverse (0.5x) |
| `K+L` | Slow forward (0.5x) |
| `I` | Set In point at playhead |
| `O` | Set Out point at playhead |
| `Alt+X` | Clear In/Out points |
| `S` | Toggle snapping |
| `R` | Toggle ripple edit |
| `Delete` / `Backspace` | Delete selected clip(s) |
| `Escape` | Clear selection |
| `Ctrl/Cmd + A` | Select all clips |
| `Alt + Drag` | Marquee selection |
| `Shift + Alt + Drag` | Marquee add to selection |
| `Shift + Click` | Add clip to selection |
| `Ctrl/Cmd + Click` | Toggle clip in selection |
| `Space + Drag` | Pan preview (when not in input field) |
| `Space + Ctrl + Drag` | Zoom preview |
| `Double-click track name` | Rename track |

### Timeline Header Buttons (Updated)
`[+Video] [+Audio] [Snap] [Ripple] | [Undo] [Redo] | [X selected] [X clips] ... [Zoom controls]`

### Roll Edit Interaction
- **Hover** between adjacent clips → yellow line appears
- **Drag** left/right → extends one clip, shortens the other
- **Release** → edit point finalized, saved to history

---

## NOTES FOR NEXT SESSION (Session 8+)

### Current State Summary
The timeline now has **full professional NLE editing features**:
1. **Undo/Redo** - Ctrl+Z / Ctrl+Shift+Z with 50-state history
2. **Overwrite editing** - Clips cut underlying clips on drop
3. **Roll edit** - Drag between clips to move edit point
4. **Trim collision** - Trim handles stop at neighboring clips
5. **DaVinci-style visuals** - Filmstrip thumbnails, waveforms, color bars
6. **Larger trim handles** - 16px wide for easy grabbing

### Behavior Summary

**Clip Dragging:**
- During drag: clips pass over each other freely
- On drop: overlapping clips get cut/trimmed/split

**Trimming:**
- Trim handles stop at neighboring clips (no overlap)
- Snapping works but respects neighbor boundaries

**Roll Edit:**
- Yellow line between adjacent clips
- Drag to move edit point (one extends, other shortens)

### Pending Features
- [ ] Keyboard shortcuts: C (split), Ctrl+D (duplicate)
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization (real waveforms from audio analysis)
- [ ] Export/render timeline to video file
- [ ] Text overlays/titles
- [ ] Asset hover preview in Assets panel

---

## Recent Changes (Session 8 - Jan 31, 2026)

### 1. Fixed Drag & Drop from Assets to Timeline
**Bug:** Dragging clips from the Assets panel to timeline tracks did nothing - clips weren't being added.

**Root Cause:** In `timelineStore.js`, the `resolveOverlaps()` function had an early return that didn't match the expected return type:
```javascript
// BUG: Returned array instead of object
if (overlappingClips.length === 0) return state.clips

// FIX: Now returns correct object format
if (overlappingClips.length === 0) return { clips: state.clips, addedCount: 0 }
```

**Additional Improvements:**
- Added `dropEffect = 'copy'` to dragover handler for proper cursor feedback
- Added scroll position compensation for accurate drop placement when timeline is scrolled
- Added asset/track type validation (video assets → video tracks, audio → audio tracks)

### 2. Fixed Head Trim Extending Indefinitely
**Bug:** When trimming the head (left edge) of a clip by dragging left, it would extend indefinitely past where the source footage begins. The tail (right edge) correctly stopped at source duration, but the head didn't.

**Root Cause:** The left-edge trim logic didn't constrain `trimStart` to stay >= 0.

**Solution:**
- Added `updateClipTrim()` function to timelineStore for atomic updates of trim properties
- Head trim now calculates `newTrimStart` and constrains it to >= 0
- Updates `trimStart`, `startTime`, and `duration` together atomically
- Tail trim also improved to update `trimEnd` along with `duration`

### Key Files (Session 8 Updates)
| File | Changes |
|------|---------|
| `src/stores/timelineStore.js` | Fixed `resolveOverlaps()` return type, added `updateClipTrim()` function |
| `src/components/Timeline.jsx` | Fixed drag-drop positioning, fixed head trim constraint, improved trim handling |

### Timeline Store - New Method
```javascript
// Update clip trim properties directly (for interactive trimming)
updateClipTrim(clipId, { startTime, duration, trimStart, trimEnd })
```

### Trim Behavior (Updated)
| Edge | Constraint | Property Updated |
|------|-----------|------------------|
| **Head (left)** | Can't extend past `trimStart = 0` | `startTime`, `duration`, `trimStart` |
| **Tail (right)** | Can't extend past `sourceDuration` | `duration`, `trimEnd` |

### How Trim Properties Work
```javascript
clip = {
  startTime: 5,        // Position on timeline (seconds)
  duration: 3,         // Visible duration on timeline
  sourceDuration: 10,  // Total length of source footage
  trimStart: 2,        // In-point in source (0 = source start)
  trimEnd: 5,          // Out-point in source (trimStart + duration)
}
// This clip shows source footage from 2s to 5s, placed at timeline position 5s
```

---

## NOTES FOR NEXT SESSION (Session 9+)

### Current State Summary
The timeline now has **full professional NLE editing features**:
1. **Drag & Drop** - Working! Drag assets from Assets panel to timeline tracks
2. **Undo/Redo** - Ctrl+Z / Ctrl+Shift+Z with 50-state history
3. **Overwrite editing** - Clips cut underlying clips on drop
4. **Roll edit** - Drag between clips to move edit point
5. **Trim collision** - Trim handles stop at neighboring clips AND source boundaries
6. **DaVinci-style visuals** - Filmstrip thumbnails, waveforms, color bars
7. **Proper trim constraints** - Head/tail both respect source footage limits

### Behavior Summary

**Drag & Drop:**
- Drag from Assets panel → drop on matching track type (video/audio)
- Drop position accounts for timeline scroll
- Clips are added at the drop position

**Trimming:**
- **Head (left edge):** Can only extend to where source footage begins (`trimStart >= 0`)
- **Tail (right edge):** Can only extend to where source footage ends (`trimEnd <= sourceDuration`)
- Both edges stop at neighboring clips (no overlap)
- Snapping works but respects all constraints

### Pending Features
- [ ] Keyboard shortcuts: C (split), Ctrl+D (duplicate)
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization (real waveforms from audio analysis)
- [ ] Export/render timeline to video file
- [ ] Text overlays/titles
- [ ] Asset hover preview in Assets panel

---

## Recent Changes (Session 9 - Jan 31, 2026)

### 1. Smart Preview Mode Switching
Implemented intelligent preview panel mode switching based on user focus:

**Behavior:**
- **Click an asset in Assets panel** → Preview switches to **Asset mode**, showing that specific asset
- **Click anywhere in Timeline** (clips, empty space, playhead) → Preview switches to **Timeline mode**, showing current frame at playhead

**Implementation:**
- Moved `previewMode` state from local PreviewPanel state to centralized `assetsStore`
- Added `setPreviewMode()` method to assetsStore
- Updated `setPreview()` to automatically set mode to 'asset'
- Timeline clicks now call `setPreviewMode('timeline')`
- Assets panel clicks now trigger preview mode switch via `setPreview()`

**Files Modified:**
| File | Changes |
|------|---------|
| `src/stores/assetsStore.js` | Added `previewMode` state and `setPreviewMode()` method |
| `src/components/PreviewPanel.jsx` | Uses store's previewMode instead of local state |
| `src/components/Timeline.jsx` | Calls `setPreviewMode('timeline')` on click |
| `src/components/panels/AssetsPanel.jsx` | Single-click now selects and previews asset |

### 2. Removed Empty Audio Track Hint Text
Removed the "Drag audio from Assets" placeholder text from empty audio tracks for cleaner UI.

### 3. Locked Track Visual Indicator
Added visual feedback when tracks are locked:

**Visual Changes:**
- **Track header**: Slightly darker background when locked
- **Track content area**: 50% opacity with darker gray background
- **Lock icon**: Already shows in yellow/warning color

**CSS Classes Applied:**
- Locked tracks: `opacity-50 bg-sf-dark-800`
- Locked track headers: `bg-sf-dark-800/50`

---

## NOTES FOR NEXT SESSION (Session 10+)

### Current State Summary
The app now has **smart preview switching** and **better locked track visibility**:
1. **Preview Mode Switching** - Click Assets panel → asset preview; Click Timeline → timeline preview
2. **Locked Track Visuals** - Locked tracks appear grayed out with 50% opacity
3. **Clean Audio Tracks** - No placeholder text in empty audio tracks

### Key State (assetsStore)
```javascript
// Preview Mode (new)
previewMode: 'asset' | 'timeline',  // Which mode the preview panel is in
setPreviewMode(mode),               // Switch preview mode explicitly

// setPreview() now also sets previewMode to 'asset'
```

### Preview Mode Behavior
| User Action | Result |
|-------------|--------|
| Click asset in Assets panel | Preview shows asset (asset mode) |
| Double-click asset | Same as click |
| Click empty timeline area | Preview shows timeline (timeline mode) |
| Click timeline clip | Preview shows timeline (timeline mode) |
| Start timeline playback | Preview shows timeline (timeline mode) |
| Click "View Asset" button | Switch back to asset mode |

### Locked Track Visuals
- Track content: `opacity-50 bg-sf-dark-800`
- Track header: `bg-sf-dark-800/50`
- Lock icon: Yellow/warning color (already existed)

### Pending Features
- [ ] Keyboard shortcuts: C (split), Ctrl+D (duplicate)
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization (real waveforms from audio analysis)
- [ ] Export/render timeline to video file
- [ ] Text overlays/titles
- [ ] Asset hover preview in Assets panel

---

## Recent Changes (Session 10 - Jan 31, 2026)

### 1. Full 2D Transform Controls for Clips
Added professional NLE-style 2D transform controls to the Inspector panel. When a clip is selected on the timeline, the Inspector shows editable transform properties that are applied in real-time to the Preview panel.

**Transform Properties:**
| Property | Description | Range |
|----------|-------------|-------|
| Position X/Y | Offset from center | Pixels |
| Scale X/Y | Resize width/height | 10% - 400% |
| Scale Linked | Lock X/Y scale together | Toggle |
| Rotation | Rotate around anchor | -180° to 180° |
| Anchor Point | Transform origin | 0-100% X/Y |
| Opacity | Transparency | 0% - 100% |
| Flip Horizontal | Mirror horizontally | Toggle |
| Flip Vertical | Mirror vertically | Toggle |
| Crop (Top/Bottom/Left/Right) | Trim edges | 0% - 50% |

**Inspector Panel Updates:**
- **Connected to Timeline Store**: Inspector now shows actual selected clip data (no more mock data)
- **Transform Section**: Position, Scale (with link toggle), Rotation (slider + input), Flip buttons, Opacity
- **Crop Section**: Visual preview + sliders for Top/Bottom/Left/Right
- **Anchor Point Section**: 9-point grid + custom X/Y inputs
- **Timing Section**: Read-only start time, editable duration, trim in/out display
- **Reset Buttons**: "Reset Transform" and "Reset Crop" buttons

**Preview Panel Updates:**
- Video clips now render with their transform properties applied
- CSS transforms: translate, scale, rotate, flip (via negative scale)
- CSS clip-path for crop
- Transform origin based on anchor point
- Opacity via CSS opacity property
- Works during playback and for transitions

**Technical Implementation:**
- `transform` object added to clip model in timelineStore
- `updateClipTransform()` method for real-time updates (no history spam)
- `resetClipTransform()` method to restore defaults
- `buildVideoTransform()` function in PreviewPanel converts transform to CSS
- `getClipTransform()` looks up full clip data for active preview clip

### Key Files (Session 10 Updates)
| File | Changes |
|------|---------|
| `src/stores/timelineStore.js` | Added `transform` object to clip model, `updateClipTransform()`, `resetClipTransform()`, `getSelectedClip()` |
| `src/components/InspectorPanel.jsx` | Complete rewrite to connect to timeline store, new transform/crop/anchor UI |
| `src/components/PreviewPanel.jsx` | Added `buildVideoTransform()`, `getClipTransform()`, apply transforms to video elements |

### Timeline Clip Model (Updated)
```javascript
clip = {
  id, trackId, assetId, name, startTime,
  duration, sourceDuration, trimStart, trimEnd,
  color, type, url, thumbnail,
  // NEW: 2D Transform properties
  transform: {
    positionX: 0,       // X offset (pixels)
    positionY: 0,       // Y offset (pixels)
    scaleX: 100,        // Width scale (%)
    scaleY: 100,        // Height scale (%)
    scaleLinked: true,  // Lock X/Y scale
    rotation: 0,        // Degrees
    anchorX: 50,        // Anchor X (%)
    anchorY: 50,        // Anchor Y (%)
    opacity: 100,       // Opacity (%)
    flipH: false,       // Horizontal flip
    flipV: false,       // Vertical flip
    cropTop: 0,         // Crop from top (%)
    cropBottom: 0,      // Crop from bottom (%)
    cropLeft: 0,        // Crop from left (%)
    cropRight: 0,       // Crop from right (%)
  }
}
```

### Inspector Panel Sections
1. **Clip Header**: Name, track, duration, quick actions (duplicate, split, delete)
2. **Transform**: Position, Scale (linked/unlinked), Rotation, Flip, Opacity, Anchor Point
3. **Crop**: Visual preview, 4 edge sliders
4. **Timing**: Start time (read-only), Duration (editable), Trim in/out (read-only)
5. **Effects**: Ken Burns, Camera Shake, Color Grade (placeholders)

### Transform Application Order
CSS transforms are applied in this order:
1. Translate (position offset)
2. Scale (with flip applied via negative values)
3. Rotate
4. Transform-origin set to anchor point percentage
5. Clip-path for crop
6. Opacity

### 2. Multi-Layer Video Compositing (Picture-in-Picture)
When clips exist on multiple video tracks at the same time position, they are now rendered as stacked layers, enabling:
- **Picture-in-Picture**: Scale down the top layer to reveal the layer beneath
- **Split Screen**: Position clips side-by-side
- **Overlay Effects**: Use opacity to blend layers
- **Green Screen Ready**: Transparent backgrounds composite correctly

**How It Works:**
- Video 1 renders ON TOP of Video 2 (higher track = higher z-index)
- Each layer has its own transform (scale, position, rotation, opacity, crop)
- Only the bottom layer plays audio (to avoid double audio)
- The Preview shows a "X Layers" badge when multiple layers are active

**Technical Implementation:**
- `getActiveClipsAtTime()` returns all clips at playhead position
- Video tracks are sorted by index (Video 2 behind, Video 1 in front)
- Each track gets its own `<video>` element with independent transform
- Video refs stored in `layerVideoRefs` object keyed by track ID
- All layer videos sync to playhead position independently

### Notes for Next Session
- Transform values are saved per-clip and persist to localStorage
- Legacy clips (without transform) get default values automatically
- Multi-select shows info panel only (single-select required for editing)
- History is saved on blur/commit, not during slider drag (prevents spam)
- Transforms work during timeline playback and transitions
- **Multi-layer compositing**: Videos on multiple tracks composite together
- **Layer order**: Video 1 is on top, Video 2 is behind (can have more tracks)

---

## QUICK REFERENCE FOR NEW SESSION

### Running the App
```bash
cd c:\Users\papa\Documents\coding_projects\general\comfyui_editing
npm run dev
```
Opens at `http://localhost:5173`

### Key Files Modified in Session 10
| File | What It Does |
|------|--------------|
| `src/stores/timelineStore.js` | Timeline state, clips, tracks, transforms |
| `src/components/InspectorPanel.jsx` | Right panel - clip transform/crop controls |
| `src/components/PreviewPanel.jsx` | Video preview with multi-layer compositing |

### Current Features (Session 10)
1. **2D Transforms**: Position, Scale, Rotation, Flip, Opacity, Crop, Anchor Point
2. **Multi-Layer Compositing**: Video 1 on top of Video 2 (picture-in-picture)
3. **Inspector Connected**: Shows real clip data, edits apply in real-time
4. **All Transforms Persist**: Saved to localStorage with clip data

### How Multi-Layer Works
- Put clips on Video 1 AND Video 2 at same time position
- Scale down Video 1 clip → see Video 2 behind it
- Each layer has independent transforms

### Clip Transform Object
```javascript
transform: {
  positionX: 0, positionY: 0,     // Pixels offset
  scaleX: 100, scaleY: 100,       // Percentage (10-400)
  scaleLinked: true,              // Lock X/Y together
  rotation: 0,                     // Degrees (-180 to 180)
  anchorX: 50, anchorY: 50,       // Anchor point (0-100%)
  opacity: 100,                    // Transparency (0-100%)
  flipH: false, flipV: false,     // Mirror toggles
  cropTop: 0, cropBottom: 0,      // Edge crop (0-50%)
  cropLeft: 0, cropRight: 0,
}
```

### Pending Features
- [ ] Keyboard shortcuts: C (split), Ctrl+D (duplicate)
- [ ] Copy/Paste clips
- [ ] Timeline markers/flags
- [ ] Audio waveform visualization
- [ ] Export/render timeline to video
- [ ] Text overlays/titles
