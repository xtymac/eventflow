# EventFlow Figma Design Specification
Last updated: 2026-02-01
Product: EventFlow (Nagoya Construction Lifecycle)
Scope: Web app prototype (Mantine 7.14.3 + MapLibre GL JS)

This document is the source of truth for recreating the current EventFlow prototype in Figma. All measurements are in px unless noted. Values marked as defaults come from Mantine 7.14.3 CSS variables.

---

## 1) Introduction & Overview

### Purpose
Provide a complete, implementation-accurate spec for designers to rebuild the EventFlow prototype in Figma, including layout, components, tokens, states, and interactions.

### Application Summary
EventFlow is a construction lifecycle management system for Nagoya with:
- 3-panel layout: resizable left sidebar, center map, collapsible right detail panel.
- Event / Asset / Inspection management with status workflows.
- MapLibre GL JS for interactive mapping and drawing.
- Import/Export system with a 4-step wizard.
- Mantine UI (v7.14.3) with light/dark support.

### Key User Flows
1) Events
- Browse event list -> select event -> map flies to geometry -> right detail panel opens.
- Create/edit event -> draw geometry on map -> fill metadata -> save.

2) Assets
- Browse roads/greenspaces/streetlights by map viewport and filters.
- Select asset -> map highlight + details in list.

3) Inspections
- Browse inspections -> open detail modal -> edit/delete.

4) Import/Export
- Export roads by scope (city/ward/bbox).
- Import file -> configure -> review -> publish -> preview on map.

---

## 2) Design System

### 2.1 Token Sources
- Mantine theme: `frontend/src/main.tsx` (primaryColor = blue; system font stack).
- Mantine default tokens: `node_modules/@mantine/core/styles.css`.
- Custom UI styles: `frontend/src/styles/index.css`.
- Map/data colors: `frontend/src/components/MapView.tsx`, `frontend/src/styles/drawStyles.ts`.

Theme defaults:
- Color scheme: light (defaultColorScheme="light")
- Map theme: voyager

### 2.2 Color Palette

#### Primary (Mantine default blue)
Blue 0-9:
- #e7f5ff, #d0ebff, #a5d8ff, #74c0fc, #4dabf7, #339af0, #228be6, #1c7ed6, #1971c2, #1864ab

#### Neutral
Gray 0-9:
- #f8f9fa, #f1f3f5, #e9ecef, #dee2e6, #ced4da, #adb5bd, #868e96, #495057, #343a40, #212529

Dark 0-9:
- #c9c9c9, #b8b8b8, #828282, #696969, #424242, #3b3b3b, #2e2e2e, #242424, #1f1f1f, #141414

#### Semantic (Mantine defaults)
Red 0-9:
- #fff5f5, #ffe3e3, #ffc9c9, #ffa8a8, #ff8787, #ff6b6b, #fa5252, #f03e3e, #e03131, #c92a2a

Yellow 0-9:
- #fff9db, #fff3bf, #ffec99, #ffe066, #ffd43b, #fcc419, #fab005, #f59f00, #f08c00, #e67700

Orange 0-9:
- #fff4e6, #ffe8cc, #ffd8a8, #ffc078, #ffa94d, #ff922b, #fd7e14, #f76707, #e8590c, #d9480f

Green 0-9:
- #ebfbee, #d3f9d8, #b2f2bb, #8ce99a, #69db7c, #51cf66, #40c057, #37b24d, #2f9e44, #2b8a3e

Cyan 0-9:
- #e3fafc, #c5f6fa, #99e9f2, #66d9e8, #3bc9db, #22b8cf, #15aabf, #1098ad, #0c8599, #0b7285

Teal 0-9:
- #e6fcf5, #c3fae8, #96f2d7, #63e6be, #38d9a9, #20c997, #12b886, #0ca678, #099268, #087f5b

Violet 0-9:
- #f3f0ff, #e5dbff, #d0bfff, #b197fc, #9775fa, #845ef7, #7950f2, #7048e8, #6741d9, #5f3dc4

Lime 0-9:
- #f4fce3, #e9fac8, #d8f5a2, #c0eb75, #a9e34b, #94d82d, #82c91e, #74b816, #66a80f, #5c940d

#### Event Status Colors (Map + Badges)
Map status colors (polygons/lines):
- planned: #3B82F6
- active: #F59E0B
- pending_review: #F97316
- closed/ended: #6B7280
- archived: #374151
- cancelled: #EF4444

Badge colors (Mantine color names):
- planned: blue
- active: yellow
- pending_review: orange
- closed: gray
- archived: dark
- cancelled: red

#### Asset/Map-Specific Colors
- Road types (map): arterial #8B5CF6, collector #06B6D4, local #84CC16
- Work order types (map): inspection #3B82F6, repair #F59E0B, update #10B981
- Import area highlight: selection #3B82F6, hover #F59E0B (fill opacity 0.1, line width 3/6)
- Draw styles: fill #06B6D4 (0.25-0.3 opacity), stroke #0891B2
- Search marker: #FF6B6B (radius 10, stroke 3)
- Drawing toolbar background: #0E7490
- Hover highlight (events/assets/greenspaces/streetlights): #F59E0B
- Selected event highlight: fill #EF4444 (0.5), line #EF4444 (6px)
- Selected asset highlight: glow #F87171 (16px, blur 8, 0.4), line #3B82F6 (6px), polygon fill #EF4444 (0.15), polygon outline #DC2626 (2.5)
- Inspections points: #EC4899 (radius 8, stroke #FFF 2px)
- Rivers: fill #60A5FA (0.15), line #3B82F6 (2-4px)
- Greenspaces: fill #22C55E (0.4), line #16A34A (2px)
- Streetlights: circle #FBBF24 (radius 4/6/10 by zoom), hover circle #F59E0B (radius 18)

#### Map Basemap Themes
Map themes (MapLibre tiles): light, dark, voyager (default), standard. All use CARTO tiles except standard (OpenStreetMap default).
- CARTO themes use @2x tiles (tileSize 512)
- Standard OSM uses 256 tileSize

### 2.3 Typography

#### Font Families
- UI: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Monospace: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace`

#### Heading Scale (Mantine defaults)
- H1: 34 / line-height 1.3 / weight 700
- H2: 26 / line-height 1.35 / weight 700
- H3: 22 / line-height 1.4 / weight 700
- H4: 18 / line-height 1.45 / weight 700
- H5: 16 / line-height 1.5 / weight 700
- H6: 14 / line-height 1.5 / weight 700

#### Body Text Scale
- xs: 12 / line-height 1.4
- sm: 14 / line-height 1.45
- md: 16 / line-height 1.55 (default)
- lg: 18 / line-height 1.6
- xl: 20 / line-height 1.65

Monospace text is used for IDs and technical fields.

### 2.4 Spacing Scale (Mantine defaults)
- xs: 10
- sm: 12
- md: 16
- lg: 20
- xl: 32

Common usage:
- Card padding: `sm` (12)
- Panel padding: `md` (16)
- Section gaps: `sm` or `md`

### 2.5 Radius
- xs: 2
- sm: 4 (default)
- md: 8
- lg: 16
- xl: 32

### 2.6 Shadows (Mantine defaults)
- xs: 0 1 3 rgba(0,0,0,0.05), 0 1 2 rgba(0,0,0,0.1)
- sm: 0 1 3 rgba(0,0,0,0.05), 0 10 15 -5 rgba(0,0,0,0.05), 0 7 7 -5 rgba(0,0,0,0.04)
- md: 0 1 3 rgba(0,0,0,0.05), 0 20 25 -5 rgba(0,0,0,0.05), 0 10 10 -5 rgba(0,0,0,0.04)
- lg: 0 1 3 rgba(0,0,0,0.05), 0 28 23 -7 rgba(0,0,0,0.05), 0 12 12 -7 rgba(0,0,0,0.04)
- xl: 0 1 3 rgba(0,0,0,0.05), 0 36 28 -7 rgba(0,0,0,0.05), 0 17 17 -7 rgba(0,0,0,0.04)

### 2.7 Z-Index
- App: 100
- Modal: 200
- Popover: 300
- Overlay: 400
- Max: 9999

Custom layers:
- Sidebar resize handle: 100
- Import preview overlay: 150 (backdrop), 1000 (panel)
- Map tooltips: 1000

### 2.8 Breakpoints (Mantine defaults)
- xs: 576
- sm: 768
- md: 992
- lg: 1200
- xl: 1408

---

## 3) Component Library

### 3.1 Buttons

#### Button (Mantine)
- Sizes: xs 30h, sm 36h, md 42h, lg 50h, xl 60h.
- Radius: 4 (default), text size sm by default.
- Primary: default filled (blue), used for actions (Download, Publish, Confirm).
- Secondary: `variant="light"` or `variant="subtle"`.
- Tertiary: `variant="subtle"`/`variant="default"` for cancel.

#### ActionIcon
- Sizes: sm and xs used for compact icon controls.
- Variants: `subtle` for header/close, `filled` for "Add" actions.
- Icon sizes: 14-20.

### 3.2 Inputs

#### TextInput / Select / DatePickerInput
- Default size: sm (36h), filters use xs (30h).
- Left section icons: 14-16.
- Label + description uses sm/xs text.
- Input padding: 1/3 height (Mantine default).

#### Search Input (MapSearch)
- Max width: 360
- Placeholder: "場所を検索 / 座標入力... ⌘K"
- Keyboard: Cmd+K to focus, Esc to close.

### 3.3 Segmented Control (View Switcher)
- Full width in left sidebar header.
- Values: Events / Assets / Inspections.

### 3.4 Tabs
- Assets list tabs: Roads / Green / Lights.
- Import/Export drawer tabs: Export / Import.
- Tabs can overflow horizontally; left/right ActionIcon buttons for scrolling.

### 3.5 Chips (Filters)
- Used for status, road type, ward, unnamed filters.
- Size: xs in asset filters; default in event filters.

### 3.6 Cards

#### Event Card
- Padding: sm (12)
- Radius: sm (4)
- Border: 1px (withBorder)
- Selected: border blue-5, background blue-0
- Hover: gray-0 background, shadow 0 2 8 rgba(0,0,0,0.08)
- Title: size sm, fw 500, lineClamp 2
- Status badge: size sm
- Metadata: size xs, dimmed

#### Asset Card
- Same as Event Card with additional badges for road type, status, lanes, name source.
- Inline edit row appears when selected.

#### Inspection Card
- Same card style with result badge (pass/fail/pending).

### 3.7 Badges
- Status badges: size sm (list), md (detail panel).
- Filter count: size xs, radius xl.
- Variants: filled (default), light, outline.

### 3.8 Sidebars

#### Left Sidebar (AppShell.Navbar)
- Width: resizable 280-600 (default 400).
- Padding: md (16).
- Contains segmented control + scrollable list.

#### Right Sidebar (AppShell.Aside)
- Width: 400.
- Padding: md (16) except historical preview (0).
- Header row: title + close action.

#### Resize Handle
- Width: 6; height: full panel; top offset 60.
- Hover color: blue-3; active: blue-5.
- Hint animation: 0.5s ease-in-out, 2 cycles, translateX 10px.

### 3.9 Drawers

#### Import/Export Drawer
- Position: right
- Width: resizable 320-700 (default 400)
- Overlay: opacity 0.3
- Tabbed content with dropzone overlays

#### Notification Drawer
- Size: md (~440)
- Contains list of notifications with left border color by edit type.

### 3.10 Modals & Overlays

#### Import Wizard Modal
- Size: xl (~780)
- Padding: lg (20)
- Stepper: size sm, 3-4 steps
- Content min-height: 300

#### Inspection Detail Modal
- Size: md (~440)
- Centered

#### Event Editor Overlay
- Absolute panel on map
- Width: 420
- Insets: top/right/bottom 16
- Shadow: md

#### Export BBox Confirm Overlay
- Position: bottom-center
- Min width: 320
- Shadow: md

#### Import Preview Overlay
- Backdrop blocks header/left sidebar (z=150)
- Control panel bottom-center: min width 400, max 520

### 3.11 Map Controls & UI

#### Layer Controls
- Position: top-left (10,10)
- Paper: shadow sm, padding sm
- Title: "Layers"
- Sections:
  - Events & Activities: Events, Inspections
  - Map Features: Road Assets, Street Lights, Rivers, Green Spaces
  - Reference Data: 指定道路 (Official), 建築情報 (Building)

#### Legend
- Position: bottom-left (10,40)
- Paper: shadow sm, padding sm

#### Drawing Toolbar
- Position: top-right (10,60)
- Background: #0E7490
- Shows drawing mode + "Clear All" button

#### Map Tooltip (Event)
- Paper: shadow md, padding sm, radius sm
- Min width: 200, max width: 280
- Offset: +12px from cursor

### 3.12 Tables (Import Review)
- Table in ScrollArea (height 250)
- Striped + hover highlight
- Row click highlights and fly-to

### 3.13 Alerts & Notifications
- Alert variant: light, used for warnings/info
- Notifications appear top-right (Mantine Notifications)

### 3.14 Loaders & Empty States
- Loader size sm or lg depending on context
- Empty state text: size sm/xs, dimmed, centered

### 3.15 CSS Overrides
- MapLibre popup content: padding 12x16, radius 8
- MapLibre popup close button: font size 18, padding 4x8
- Scrollbar (WebKit): width 8, track #F1F1F1, thumb #C1C1C1, hover #A1A1A1
- Tabs scroll container hides scrollbar

---

## 4) Page Layouts

### Screen 1: Events Tab - Default View
- Header: 60h
- Left sidebar: width 400 (resizable 280-600), padding md
- Center: full-height map (calc(100vh - 60))
- Right sidebar: hidden

Left sidebar contents:
- SegmentedControl (Events/Assets/Inspections)
- Events header + create ActionIcon
- Search input (size sm)
- Filter toggle + collapse
- Event cards list (scrollable)

### Screen 2: Events Tab - Event Selected
- Same as Screen 1
- Right sidebar: width 400, padding md
- Content:
  - Header with "Event Details" + close ActionIcon
  - Scrollable EventDetailPanel

### Screen 3: Event Creation Overlay
- EventEditorOverlay panel: width 420, shadow md
- Positioned top/right/bottom 16
- Left sidebar collapses to maximize map
- Map remains visible; drawing toolbar visible at top-right
- Geometry drawing + form fields

### Screen 4: Import/Export Drawer
- Drawer slides from right over map
- Width: 400 (resizable)
- Tabs: Export | Import
- Dropzone overlays for drag & drop

### Screen 5: Import Wizard Modal
- Modal centered, size xl (~780)
- Stepper header
- 4 steps: Upload -> Configure -> Review -> Publish
- Content area min-height 300

### Screen 6: Assets Tab
- Left sidebar shows Tabs (Roads / Green / Lights)
- Filters: road type, status, ward, unnamed
- List sorted by distance from map center
- Map overlay: "Preview (not selectable)" when zoom < 14

### Screen 7: Mobile View (<768)
- Sidebars collapsed by default
- Burger menus toggle left sidebar
- Right sidebar becomes overlay panel
- Map full-width; focus on touch targets (>=44)

---

## 5) Interaction Patterns

### Hover
- Event/Asset cards: background gray-0, shadow 0 2 8 rgba(0,0,0,0.08)
- Timeline card: shadow 0 2 12 rgba(0,0,0,0.1)
- Change count badge: translateY(-2), shadow 0 4 12 rgba(0,0,0,0.15)
- Resize handle: blue-3 on hover

### Active/Selected
- Selected list card: border blue-5, background blue-0
- Active tabs: default Mantine style
- Active map layers: filled status color

### Transitions
- Card hover: 150ms ease (background + shadow)
- Filter chevron: 200ms rotation
- Dropzone: 200ms border/background
- Resize handle: 0.2s background, 0.1s left (drag)
- Resize hint: 0.5s ease-in-out x2

### Map Interactions
- Draw: polygon/line tools, double-click to finish
- Undo/Redo via toolbar
- Clear All removes drawn shapes
- Hover list item -> map highlight in amber (#F59E0B)
- Selected event -> red highlight (#EF4444) on map
- Selected asset -> blue line + red glow on map
- Hover event -> tooltip preview; click event -> tooltip lock
- Fly-to on list click; second click toggles close-up zoom

### Import/Export
- Drag file -> dashed border + overlay
- Invalid file -> red styling + notification
- Import preview overlay blocks header and sidebar

---

## 6) Responsive Behavior

### Desktop (>=768)
- 3-panel layout: left sidebar + map + right sidebar
- Sidebars resizable (left + import/export drawer)
- Hover states enabled

### Mobile (<768)
- Sidebars collapsed by default
- Map full-width
- Detail views as overlay panels
- Larger touch targets (>=44)

---

## 7) Figma Organization Guide

### Pages
- Cover
- Design System (colors, typography, spacing, tokens)
- Components Library
- Screens - Events
- Screens - Assets
- Screens - Inspections
- Screens - Import/Export
- Mobile Screens

### Frame Naming
Format: `Section / Screen / State`
Example: `Events / List View / Event Selected`

### Components
- Use `/` for categories
- Create variants for state + size
- Use Auto Layout for responsive layouts

### Layer Structure
- Group by feature
- Lock background map layer
- Descriptive names (e.g. `Header/MapSearch`, `Sidebar/EventCard`)

---

## 8) Visual References

Add these references once available:
- Screenshot: Events tab (default)
- Screenshot: Events tab (selected)
- Screenshot: Event editor overlay
- Screenshot: Import/Export drawer
- Screenshot: Import wizard (each step)
- Screenshot: Assets tab (roads + filters)
- Screenshot: Mobile layout

Include color swatches, typography samples, and spacing diagrams beside screenshots.

---

## 9) Data Structures (Design Reference)

### ConstructionEvent
Key fields:
- id, name, status, startDate, endDate
- restrictionType, geometry, geometrySource
- department, ward, createdBy
- postEndDecision, archivedAt, closedAt

Status values:
- planned, active, pending_review, closed, archived, cancelled

Restriction types:
- full, partial, workzone

Post-end decision:
- pending, no-change, permanent-change

### RoadAsset
Key fields:
- id, displayName, roadType, lanes, status
- ward, sublocality, landmark
- geometry, updatedAt

Status values:
- active, inactive

Road types:
- arterial, collector, local

### InspectionRecord
Key fields:
- id, eventId, roadAssetId
- inspectionDate, result, notes
- geometry, createdAt

Result values (UI labels):
- pass, fail, pending, na

---

## 10) Design Notes

### Accessibility
- Ensure contrast for status badges and map overlays
- Use visible focus rings (Mantine default)
- Touch targets >=44 on mobile

### Localization
- UI includes Japanese labels in search and map layers
- Date format: YYYY/MM/DD in lists, MM/DD in map tooltip
- Fonts should support Japanese glyphs

### Performance Considerations
- Map uses PMTiles for large datasets
- Lists are paginated / filtered to reduce load

### Known Limitations
- Road update mode disabled (Phase 0)
- Road-event linking disabled; geometry must be drawn

---

## 11) Verification Checklist
- All colors match hex values above
- All measurements match px values above
- All components have defined states
- All screens documented
- Responsive behavior confirmed at 768 breakpoint
