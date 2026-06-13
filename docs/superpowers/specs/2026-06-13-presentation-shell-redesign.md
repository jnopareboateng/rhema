# Spec — Presentation Shell Redesign

**Date:** 2026-06-13  
**Branch:** `feat/presentation-shell` (new)  
**Status:** Draft — owner-approved, pending team review  
**Owner:** Joshua  
**Reference image:** ProPresenter-style layout (attached to session)

---

## 1. Problem & Goal

The current shell was designed around AI detection as the primary workflow. The new goal is a professional church presentation tool where AI is an add-on. The layout needs to reflect that: queue-first, live-output-prominent, tabbed content browsing.

**Decisions locked:**
- AI transcript + detections panels removed from the main layout (components kept, re-added when AI features are prioritised)
- Queue is flat `ContentItem[]` (M1 model); visual grouping into Current / Up Next / Later is positional only — no data model change
- "Logo" button → Rhema holding slate (Rhema SVG centred on black, hardcoded `Slide`)
- Double-click a context verse in the detail panel → `presentItem` immediately (goes live)
- `←` / `→` arrow keys (when no text input focused) → prev/next verse in chapter, updates both detail panel and preview simultaneously
- Stage Display → standard stage monitor: current slide + next queue item + system clock

---

## 2. Layout Grid

```
┌────────────────────────────────────────────────────────────────────────┐
│  TOP BAR  (56px)                                                       │
│  Logo | Service name + date | Outputs status | Settings | ON AIR       │
├─────────────────┬────────────────────────────┬─────────────────────────┤
│                 │  PREVIEW / STAGING          │  LIVE OUTPUT            │
│  SERVICE        │  Canvas + actions           │  Canvas + controls      │
│  QUEUE          │                             │                         │
│  (24%)          │  (38%)                      │  (38%)                  │
│                 ├────────────────────────────┬┴─────────────────────────┤
│                 │  CONTENT BROWSER           │  VERSE DETAIL            │
│                 │  Bible | Songs | Media |   │  Context verses +        │
│                 │  Text  (tabs)              │  Present / Queue / Copy  │
└─────────────────┴────────────────────────────┴──────────────────────────┘
```

- Top row height: `~240px` fixed
- Bottom row: fills remaining height (`minmax(0, 1fr)`)
- Left column (Service Queue): `280px` fixed width
- Center + right split: `~55% / 45%` of remaining width

---

## 3. Top Bar

Replaces `TransportBar`. Full-width, `56px`.

| Zone | Content |
|---|---|
| Left | Rhema `R` icon + **"Rhema"** wordmark + `"Presentation"` subtext |
| Center-left | **Service name** — inline-editable text (click to rename, defaults to "Sunday Service"); below: session date + time (set at app start, live clock) |
| Center | **Outputs** — two status pills: `● Main Screen · Connected` and `● Stage Display · Connected`. Each pill opens that output window on click. Dot is green when NDI/window is active, grey otherwise. |
| Right | Settings icon → existing `SettingsDialog`; User icon (placeholder); **ON AIR** button |

**ON AIR button:**  
- Off-air state: dark bg, muted text — `"GO LIVE"`  
- On-air state: red bg, white text — `"● ON AIR"`  
- Click → toggles `useBroadcastStore.getState().setLive(!isLive)`  
- Replaces the current Switch in `live-output-panel.tsx`

---

## 4. Service Queue (left panel)

Replaces `TranscriptPanel` in the left column.

**Header:** `SERVICE QUEUE` label + `+ ADD ITEM` button + `⋯` overflow menu

**Visual sections** (read from flat `items[]` + `activeIndex`):

| Section | Items | Badge |
|---|---|---|
| CURRENT | `items[activeIndex]` — always 1 row | none |
| UP NEXT | `items[activeIndex+1 … activeIndex+5]` | count pill |
| LATER | `items[activeIndex+6 …]` | count pill |

If `activeIndex === null`, CURRENT is empty and all items fall under UP NEXT.

**Queue row anatomy:**
```
⠿  [icon]  Title                 Song  ● LIVE  ▶
```
- `⠿` — drag handle (6-dot grip)
- `[icon]` — coloured content-type icon: Bible = blue book, Song = purple music note, Text = orange T, Media = teal video camera
- Title = `item.title`
- Kind label = `item.kind` (small muted text)
- `● LIVE` badge — only on the active item
- `▶` play button — `presentItem(item)` + `setActive(index)`

CURRENT row has a green left border + subtle green tint bg.

**"+ ADD ITEM"** — opens a Popover with a search input. In this milestone: Bible-only quick search (same query logic as the existing search panel). Selecting a result calls `addItem(verseToContentItem(...))`. Song/Media/Text add is an empty state with "Coming in a future update."

**Drag to reorder** — wire `@dnd-kit/react` (already installed) to `reorderItems`.

Footer hint: `Drag items to reorder ⓘ`

---

## 5. Preview / Staging (centre top)

Replaces `PreviewPanel`.

Shows the item **selected in the Content Browser or Verse Detail panel** — not the live item. Defaults to the active queue item on load.

**Canvas:** `<CanvasVerse slide={stagedSlide} theme={activeTheme} />` — full-width, fills panel height minus action bar.

**Action bar** (below canvas, full width, `40px`):

| Button | Action |
|---|---|
| Edit | Disabled (greyed) — future slide editor |
| Add to Queue | `addItem(stagedItem)` |
| **SEND LIVE** (primary) | `presentItem(stagedItem)` → goes on-air |

"Staged item" is local UI state (`useState<ContentItem | null>`) in the shell — not in the broadcast store. Selecting a verse in the detail panel or browser sets it.

---

## 6. Live Output (right top)

Redesigns `LiveOutputPanel`.

**Header:** `LIVE OUTPUT` label + `● LIVE` green dot (visible when `isLive`) + inline slide transport

**Inline transport** (in header, right side):
```
‹   1/3   ›
```
`‹` → `prevSlide()`, `›` → `nextSlide()`. Hidden / disabled when `liveItem` has only 1 slide.

**Canvas:** `<CanvasVerse slide={liveSlide} theme={activeTheme} />` — fills panel. Dimmed (`opacity-40`) when `!isLive`.

**Action bar** (below canvas):

| Button | Action |
|---|---|
| Black Screen | `setLive(false)` |
| Rhema Logo | `presentItem(RHEMA_LOGO_SLIDE)` — see §10 |
| Clear | `clearLive()` |

Confidence Monitor button is hidden in this milestone.

---

## 7. Content Browser (centre bottom, tabbed)

Replaces `SearchPanel`. A `<Tabs>` shell with four tabs.

### Bible tab (functional)
Extracts the search + results logic from the existing `SearchPanel`:
- Search input (typeahead, existing logic)
- Translation selector dropdown
- Book filter dropdown
- Results list: `ref | text preview | + Queue`
- Clicking a result → sets the staged item in Preview/Staging
- `+ Queue` → `addItem(...)`

The existing `SearchPanel` component is renamed `BibleBrowserPanel` and mounted here.

### Songs / Media / Text tabs
Empty state: icon + "Songs library coming in a future update" (similar copy per tab). Tabs are visible and clickable but show the empty state.

---

## 8. Verse Detail (right bottom)

New component. Replaces `DetectionsPanel` in the right-bottom slot.

Shows the **staged verse** (whatever is in Preview/Staging) with its surrounding chapter context.

**Header:** verse reference (e.g. `John 3:16`) + translation selector + `Change Translation` text button

**Verse list:** scrollable list of all verses in the current chapter. Current verse:
- Blue left border `2px`
- Subtle blue-tinted background
- Always scrolled into view on selection change

Each verse row: `[number]  [text]`

**Double-click a verse row** → `presentItem(verseToContentItem(verse, translation))` — skips staging, goes straight live.

**← / → arrow keys** (global, `keydown` listener, suppressed when any `<input>` or `<textarea>` is focused):
- `ArrowLeft` → select `verse - 1` in chapter (clamp at 1)
- `ArrowRight` → select `verse + 1` in chapter (clamp at last verse)
- Updates staged item + scrolls detail panel

**Action bar** (bottom of panel):

| Button | Action |
|---|---|
| **Present Now** (green) | `presentItem(stagedItem)` |
| Add to Queue | `addItem(stagedItem)` |
| Copy Text | `navigator.clipboard.writeText(verse.text)` |

---

## 9. Stage Display

A second Tauri window (`broadcast-alt`), opened by clicking the "Stage Display" pill in the top bar.

`broadcast-output.tsx` (already handles `broadcast-alt`) receives `broadcast:render-update`. A separate `stage-display.html` / `stage-output.tsx` entry handles the stage layout:

**Stage layout:**
```
┌─────────────────────────────────┐
│                                 │
│   CURRENT SLIDE  (60% height)   │
│   CanvasVerse — live slide      │
│                                 │
├─────────────────────────────────┤
│  NEXT UP  (30% height)          │
│  [icon] Next item title         │
│  (dimmed, smaller canvas or     │
│   text-only preview)            │
├─────────────────────────────────┤
│  🕐 HH:MM:SS  (10% height)      │
└─────────────────────────────────┘
```

- Clock: `setInterval` updating every second — live system time
- Next item: reads `items[activeIndex + 1]` from a shared state snapshot sent via the existing `broadcast:render-update` payload (extend payload to include `nextItem: { title, kind } | null`)
- Canvas uses the same `renderSlide` renderer at full `broadcast-alt` window resolution

---

## 10. Rhema Logo Slate

A hardcoded `Slide` constant used by the Logo button:

```ts
export const RHEMA_LOGO_SLIDE: Slide = {
  reference: "",
  segments: [],
  label: "Rhema",
  media: { type: "image", src: "/rhema.svg", fit: "contain" },
}
```

`/rhema.svg` already exists in `public/`. The renderer honours `slide.media` in M3; for now the Live Output canvas renders a black frame with the SVG centred via a simple `<img>` overlay in `broadcast-output.tsx` (not via the Canvas renderer — a lightweight special case).

---

## 11. File Change Map

**New files:**
| File | Purpose |
|---|---|
| `src/components/shell/top-bar.tsx` | New top bar |
| `src/components/shell/service-queue.tsx` | Left queue panel |
| `src/components/panels/preview-staging-panel.tsx` | Centre-top preview |
| `src/components/panels/verse-detail-panel.tsx` | Right-bottom context |
| `src/components/browser/content-browser.tsx` | Tabbed browser shell |
| `src/components/browser/bible-browser.tsx` | Bible tab (extracted from SearchPanel) |
| `src/stage-output.tsx` | Stage display entry point |
| `src/lib/rhema-logo-slide.ts` | `RHEMA_LOGO_SLIDE` constant |

**Modified:**
| File | Change |
|---|---|
| `src/components/layout/dashboard.tsx` | New grid wiring all panels |
| `src/broadcast-output.tsx` | Logo slate overlay; extend payload with `nextItem` |
| `src/stores/broadcast-store.ts` | No store changes needed — shell uses existing actions |
| `src-tauri/tauri.conf.json` | Register stage display window |

**Retired from layout** (components kept, not mounted):
- `src/components/controls/transport-bar.tsx` → transport inline in Live Output header
- `src/components/panels/live-output-panel.tsx` → superseded by redesign
- `src/components/panels/transcript-panel.tsx` → hidden (AI deferred)
- `src/components/panels/detections-panel.tsx` → hidden (AI deferred)
- `src/components/panels/search-panel.tsx` → logic extracted to `bible-browser.tsx`

---

## 12. What's Deferred

| Item | Milestone |
|---|---|
| AI transcript + detections | AI features phase |
| Edit slide (button is greyed) | Future |
| Song / Media / Text browsers | M2 / M3 |
| Named queue sections (service plan) | Post-M2 |
| Add Item: song/media | Post-M2 |
| Confidence Monitor | AI features phase |
| `slide.media` rendered on canvas | M3 |

---

## 13. Open Questions (resolved)

| Question | Decision |
|---|---|
| Logo button | Rhema holding slate — `/rhema.svg` on black |
| Queue structure | Flat `ContentItem[]`; Current/Up Next/Later is visual/positional only |
| Double-click context verse | `presentItem` immediately — goes live |
| Arrow key nav | `←` / `→` move prev/next verse in chapter; suppressed on input focus |
| Stage Display | Current slide + next item + clock |
| AI panels | Hidden — re-introduced when AI work resumes |
