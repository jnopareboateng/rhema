import { useBroadcastStore } from "@/stores/broadcast-store"
import type { VerseRenderData } from "@/types"
import type { Verse } from "@/types"
import type { ContentSource, VerseContentItem } from "@/types"

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

export function toVerseRenderData(verse: Verse, translation: string): VerseRenderData {
  return {
    reference: `${verse.book_name} ${verse.chapter}:${verse.verse} (${translation})`,
    segments: [{ verseNumber: verse.verse, text: verse.text }],
  }
}

export function deriveLiveVerse({
  isLive,
  selectedVerse,
  translation,
}: {
  isLive: boolean
  selectedVerse: Verse | null
  translation: string
}): VerseRenderData | null {
  if (!isLive || !selectedVerse) return null
  return toVerseRenderData(selectedVerse, translation)
}

export const broadcastActions = {
  setLiveVerse: (verse: VerseRenderData | null) =>
    useBroadcastStore.getState().setLiveVerse(verse),
  setLive: (live: boolean) =>
    useBroadcastStore.getState().setLive(live),
  getActiveTheme: () => {
    const s = useBroadcastStore.getState()
    return s.themes.find((t) => t.id === s.activeThemeId) ?? s.themes[0]
  },
}
