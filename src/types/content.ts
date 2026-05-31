import type { Slide } from "./slide"

export type ContentKind = "verse" | "lyrics" | "media"
export type ContentSource = "manual" | "ai-direct" | "ai-semantic" | "ai-cloud" | "library"

interface BaseContentItem {
  id: string
  /** Queue/library label, e.g. "John 3:16" | "Amazing Grace". */
  title: string
  /** A verse is exactly one slide. */
  slides: Slide[]
  source: ContentSource
  added_at: number
  /** Detection items only. */
  confidence?: number
}

export interface VerseContentItem extends BaseContentItem {
  kind: "verse"
  verseRef: {
    translation: string
    book_number: number
    book_name: string
    chapter: number
    verse: number
    is_chapter_only?: boolean
  }
}

/** Defined for the model; no producers in M1 (M2). */
export interface LyricsContentItem extends BaseContentItem {
  kind: "lyrics"
  song: { songId?: string; author?: string; ccli?: string }
}

/** Defined for the model; no producers in M1 (M3). */
export interface MediaContentItem extends BaseContentItem {
  kind: "media"
  asset: { assetId?: string; mediaType: "image" | "video"; src: string }
}

export type ContentItem = VerseContentItem | LyricsContentItem | MediaContentItem
