# Spec — Presentation Shell Redesign

**Date:** 2026-06-13  
**Branch:** `feat/presentation-shell` (new)  
**Status:** Draft — owner-approved, pending team review  
**Owner:** Joshua  
**Reference image:** ProPresenter-style layout (attached to session)

---

## 0. Review Resolutions (2026-06-13, senior review)

Patched after `docs/reviews/2026-06-13-presentation-shell-redesign-senior-review.md`. These override any conflicting text in later sections.

| # | Resolution |
|---|---|
| R1 | **Supported viewport.** Desktop-only operator tool. Preferred `1440×900+`. Raise Tauri min to `1280×800` (`src-tauri/tauri.conf.json`). The 3-column top row collapses to 2 columns (Verse Detail moves under the Content Browser) below `1280px`. `1024×600` is no longer supported. |
| R2 | **Queue is append-by-default.** Change `queue-store.addItem` to append (`[...items, item]`), not prepend. This is the one required store change — §11's "no store changes" line is wrong. `insertAfterActive` is deferred (post-M2). Active-item identity is preserved across reorder/remove. |
| R3 | **On-air state model.** Off-air = output black, live item retained. On-air = live item visible. `SEND LIVE` / `Present Now` both set the item live **and** on-air. `Black Screen` = `setLive(false)`, keeps `liveItem` for instant restore. `Clear` = `clearLive()`, destructive (drops the item). `ON AIR` button toggles `setLive`. |
| R4 | **Staging sync rules.** Staged item is local shell `useState`. Selecting in Browser or Verse Detail sets staging only. Presenting a **queue** item sets live + activeIndex **and** stages that same item (preview follows live after a direct queue play). Double-click in Verse Detail goes straight live and stages it too. |
| R5 | **Keyboard safety.** Suppress global `←/→` when focus is in `input`, `textarea`, `select`, `[contenteditable]`, or any open dialog/popover, **and** when any modifier (Ctrl/Cmd/Alt/Shift) is held. A verse must be visibly selected before arrows act. |
| R6 | **Stage Display is a NEW `stage` window — not `broadcast-alt`.** `broadcast-alt` is an existing independent second **live output** (own theme `altActiveThemeId`, own NDI `outputId:"alt"`); reusing it would break dual-output. Register a third window `stage`, served by `stage-output.tsx` via its own event `broadcast:stage-update` with payload `{ theme, currentSlide, nextItem }`. The main `BroadcastPayload` (`{theme, slide}`) is **not** extended. |
| R7 | **Canvas fit.** Preview/Live/stage panels live in fixed-height rows, so `CanvasVerse` (width-only sizing today) overflows. Add an opt-in `fit="contain"` mode: size to `min(containerWidth / aspect, containerHeight)` and center. Required for screenshot fidelity. |
| R8 | **Logo slate is an isolated component** (`LogoSlateCanvas`), not an inline `<img>` special-case inside `broadcast-output.tsx`. Keeps the output/render path free of one-offs. `slide.media` on canvas stays deferred to M3. |

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

**"+ ADD ITEM"** — opens a Popover with a search input. In this milestone: Bible-only quick search (same query logic as the existing search panel). Selecting a result calls `addItem(verseToContentItem(...))` — which now **appends** (see R2), landing the item in UP NEXT / LATER rather than CURRENT. Song/Media/Text add is an empty state with "Coming in a future update."

**Drag to reorder** — wire `@dnd-kit/react` (already installed) to `reorderItems`.

Footer hint: `Drag items to reorder ⓘ`

---

## 5. Preview / Staging (centre top)

Replaces `PreviewPanel`.

Shows the item **selected in the Content Browser or Verse Detail panel** — not the live item. Defaults to the active queue item on load.

**Canvas:** `<CanvasVerse slide={stagedSlide} theme={activeTheme} fit="contain" />` — centered, fits the fixed-height panel minus the action bar (see R7; width-only sizing would overflow this row).

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

**Canvas:** `<CanvasVerse slide={liveSlide} theme={activeTheme} fit="contain" />` — centered, fits the fixed-height panel (see R7). Dimmed (`opacity-40`) when `!isLive`.

**Action bar** (below canvas):

| Button | Action | State effect (R3) |
|---|---|---|
| Black Screen | `setLive(false)` | Output black, `liveItem` retained for instant restore |
| Rhema Logo | `presentItem(RHEMA_LOGO_SLIDE)` — see §10 | Logo becomes live item, on-air |
| Clear | `clearLive()` | **Destructive** — drops `liveItem`, output black |

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

**← / → arrow keys** (global, `keydown` listener; suppressed per R5 — focus in `input`/`textarea`/`select`/`[contenteditable]`, any open dialog/popover, or any modifier held; a verse must be visibly selected first):
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

A **new** Tauri window labelled `stage` (R6), opened by clicking the "Stage Display" pill in the top bar.

> ⚠️ Do **not** reuse `broadcast-alt`. That label is an existing independent second **live output** (own theme `altActiveThemeId`, own NDI `outputId:"alt"` in `broadcast-store.ts`); reusing it would break dual-output. The stage monitor is a third window.

`stage-display.html` / `stage-output.tsx` is a dedicated entry. It listens for its own event `broadcast:stage-update` with payload `{ theme, currentSlide, nextItem }` — the main `BroadcastPayload` is left as `{theme, slide}`. The store emits `stage-update` to the `stage` label whenever live slide or queue position changes.

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
- Next item: `items[activeIndex + 1]` sent as `nextItem: { title, kind } | null` on the dedicated `broadcast:stage-update` event (R6) — not on the main render payload
- Canvas uses the same `renderSlide` renderer at full `stage` window resolution, with `fit="contain"` for the panel layout

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

`/rhema.svg` already exists in `public/`. The renderer honours `slide.media` in M3; for now the slate is an isolated `LogoSlateCanvas` component (R8) — a black frame with the SVG centred — rendered when `liveItem` is the logo slide. It is **not** an inline `<img>` special-case inside `broadcast-output.tsx`; the output/render path stays free of one-offs.

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
| `src/stage-output.tsx` + `stage-display.html` | Stage display entry point (new `stage` window) |
| `src/lib/rhema-logo-slide.ts` | `RHEMA_LOGO_SLIDE` constant |
| `src/components/ui/logo-slate-canvas.tsx` | Isolated logo slate (R8) |

**Modified:**
| File | Change |
|---|---|
| `src/components/layout/dashboard.tsx` | New grid wiring all panels |
| `src/components/ui/canvas-verse.tsx` | Add opt-in `fit="contain"` height-aware sizing (R7) |
| `src/stores/queue-store.ts` | `addItem` appends instead of prepends (R2) |
| `src/stores/broadcast-store.ts` | Emit `broadcast:stage-update` (`{theme, currentSlide, nextItem}`) to the `stage` window on live/queue change (R6). Main render payload unchanged. |
| `src-tauri/tauri.conf.json` | Register new `stage` window; raise min size to `1280×800` (R1, R6) |

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
| Queue structure | Flat `ContentItem[]`; Current/Up Next/Later is visual/positional only. `addItem` **appends** (R2) |
| Stage Display window | New `stage` window — NOT `broadcast-alt` (R6) |
| Supported viewport | Desktop-only; min `1280×800`, prefer `1440×900` (R1) |
| Double-click context verse | `presentItem` immediately — goes live |
| Arrow key nav | `←` / `→` move prev/next verse in chapter; suppressed on input focus |
| Stage Display | Current slide + next item + clock |
| AI panels | Hidden — re-introduced when AI work resumes |
