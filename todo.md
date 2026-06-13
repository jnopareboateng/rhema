# Rhema — Backlog / TODO

Durable backlog for work deferred from the presentation-shell milestone. Pick up from here.

## Content types beyond Bible (Songs / Lyrics / Text / Media)

**Status as of 2026-06-13:** Only type-level stubs exist. `ContentKind = "verse" | "lyrics" | "media"`, plus `LyricsContentItem` / `MediaContentItem` types and queue dedup support. There is **no** DB schema, backend, ingestion, browser UI, or editor for any of them. The Content Browser tabs (Songs / Media / Text) render empty "coming soon" states. A `notes` Rust crate exists and may back the Text type.

### Text (lightest — do first)
Free-text slides for announcements / custom content. No external data, no licensing.
- [ ] Text content type: extend `ContentItem` with a `text` kind (or reuse a generic slide path). `Slide.segments` already supports plain `{ text }`.
- [ ] Text editor in the Content Browser "Text" tab: multi-line input → split into slides (by blank line / manual breaks) → `addItem` / stage.
- [ ] Renderer: already renders `Slide.segments` text; verify no verse-number assumptions for non-verse slides.
- [ ] Optional: persist user text snippets (the `notes` crate?).

### Songs / Lyrics
A song library with verse/chorus/bridge structure → slides.
- [ ] **Licensing first.** Lyrics are copyrighted. Do NOT bundle lyrics. Ingest only via the user's licensed source (e.g. CCLI SongSelect export, OpenLyrics XML, ChordPro, or manual entry). Surface CCLI # on the slide where required.
- [ ] Data model: `songs` table (or file store) — title, author, ccli, sections[] (label + lines). `LyricsContentItem.song` already has `{ songId, author, ccli }`.
- [ ] Importer: parse OpenLyrics / ChordPro / plain-text into sections; map sections → `Slide[]` with `label` ("Verse 1", "Chorus") and `segments`.
- [ ] Songs browser tab: search by title/author, preview sections, stage/queue. Section reorder for presentation order.
- [ ] Backend: a `songs` crate or extend `bible`/`notes` storage; SQLite table + FTS for title/lyrics search.

### Media (images / video)
- [ ] `MediaContentItem.asset` exists (`{ assetId, mediaType: "image"|"video", src }`). `Slide.media` type exists but the **canvas renderer does not yet honor `slide.media`** (deferred to M3 per the shell spec; currently the logo slate is the only media path, via an isolated component).
- [ ] Renderer: implement `slide.media` in `verse-renderer.ts` — draw image (cover/contain/stretch) and video frames (or an overlay <video> for the live/output windows). Reconcile with NDI frame capture.
- [ ] Asset library: file import (tauri-plugin-fs / dialog), thumbnails, store under app data dir. Media browser tab: grid of assets, stage/queue.
- [ ] Video: playback controls in Live Output (play/pause/loop/mute already on `SlideMedia` video variant).

### Cross-cutting
- [ ] Content Browser tabs (Songs/Media/Text) currently inert empty states — wire each as the above lands.
- [ ] Queue already stores heterogeneous `ContentItem[]` with kind-aware dedup — no queue changes needed.
- [ ] Stage display "next up" already shows kind icon + title for any kind.

## Other deferred items (from spec §12 + reviews)
- [ ] Slide editor ("Edit" button in Preview/Staging is currently disabled).
- [ ] Confidence Monitor + AI transcript/detections panels (re-introduce when AI work resumes; components kept on disk).
- [ ] Named queue sections / service plan (currently positional Current/Up Next/Later only).
- [ ] DRY follow-ups identified in review: `useActiveAbbrev` selector, shared `KindIcon`, `semanticResultToVerse`, `VerseQueueAction` (being addressed in the /simplify pass).
- [ ] Onboarding tour (react-joyride) targets the old layout — re-target steps to the new shell (separate from the disable-toggle work).
