import { useBroadcastStore } from "@/stores/broadcast-store"
import type { Verse } from "@/types"
import type { ContentItem, ContentSource, VerseContentItem } from "@/types"
import type { SemanticSearchResult } from "@/types/detection"

export interface VerseItemOpts {
  id?: string
  source?: ContentSource
  confidence?: number
  added_at?: number
  is_chapter_only?: boolean
}

export function verseToContentItem(
  verse: Verse,
  translation: string,
  opts?: VerseItemOpts,
): VerseContentItem {
  return {
    id: opts?.id ?? crypto.randomUUID(),
    kind: "verse",
    title: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
    slides: [
      {
        reference: `${verse.book_name} ${verse.chapter}:${verse.verse} (${translation})`,
        segments: [{ verseNumber: verse.verse, text: verse.text }],
      },
    ],
    verseRef: {
      translation,
      book_number: verse.book_number,
      book_name: verse.book_name,
      chapter: verse.chapter,
      verse: verse.verse,
      is_chapter_only: opts?.is_chapter_only,
    },
    source: opts?.source ?? "manual",
    confidence: opts?.confidence,
    added_at: opts?.added_at ?? Date.now(),
  }
}

/**
 * Converts a SemanticSearchResult into a Verse shape for use with verseToContentItem.
 * Uses sentinel values: id=0 (no DB row), book_abbreviation="" (not provided by search).
 */
export function semanticResultToVerse(result: SemanticSearchResult, translationId: number): Verse {
  return {
    id: 0,
    translation_id: translationId,
    book_number: result.book_number,
    book_name: result.book_name,
    book_abbreviation: "",
    chapter: result.chapter,
    verse: result.verse,
    text: result.verse_text,
  }
}

export const broadcastActions = {
  presentItem: (item: ContentItem) => useBroadcastStore.getState().presentItem(item),
  setLive: (live: boolean) => useBroadcastStore.getState().setLive(live),
  getActiveTheme: () => {
    const s = useBroadcastStore.getState()
    return s.themes.find((t) => t.id === s.activeThemeId) ?? s.themes[0]
  },
}
