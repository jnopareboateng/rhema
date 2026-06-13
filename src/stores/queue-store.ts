import { create } from "zustand"
import type { ContentItem } from "@/types"

function dedupKey(item: ContentItem): string {
  switch (item.kind) {
    case "verse":
      return `v:${item.verseRef.book_number}:${item.verseRef.chapter}:${item.verseRef.verse}`
    case "lyrics":
      return `l:${item.song.songId ?? item.id}`
    case "media":
      return `m:${item.asset.assetId ?? item.id}`
  }
}

interface QueueState {
  items: ContentItem[]
  activeIndex: number | null
  /** ID of the queue item currently being flash-highlighted (null = none). */
  highlightedId: string | null

  addItem: (item: ContentItem) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActive: (index: number | null) => void
  clearQueue: () => void
  /** Flash-highlight a queue item briefly (1.5 s). */
  flashItem: (id: string) => void
  /** Find a verse item by book+chapter+verse. Returns its index or -1. */
  findDuplicate: (bookNumber: number, chapter: number, verse: number) => number
  /** Find a verse item by book+chapter (any verse). Returns its index or -1. */
  findVerseInChapter: (bookNumber: number, chapter: number) => number
  /** Update a chapter-only verse item in place when the verse is refined. */
  updateEarlyRef: (bookNumber: number, chapter: number, verse: number, reference: string, verseText: string) => boolean
}

let flashTimer: ReturnType<typeof setTimeout> | null = null

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  activeIndex: null,
  highlightedId: null,

  addItem: (item) =>
    set((state) => {
      const key = dedupKey(item)
      if (state.items.some((i) => dedupKey(i) === key)) return state
      return { items: [...state.items, item] }
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.items]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { items }
    }),
  setActive: (activeIndex) => set({ activeIndex }),
  clearQueue: () => set({ items: [], activeIndex: null }),
  flashItem: (id) => {
    if (flashTimer) clearTimeout(flashTimer)
    set({ highlightedId: id })
    flashTimer = setTimeout(() => set({ highlightedId: null }), 1500)
  },
  findDuplicate: (bookNumber, chapter, verse) =>
    get().items.findIndex(
      (i) =>
        i.kind === "verse" &&
        i.verseRef.book_number === bookNumber &&
        i.verseRef.chapter === chapter &&
        i.verseRef.verse === verse,
    ),
  findVerseInChapter: (bookNumber, chapter) =>
    get().items.findIndex(
      (i) =>
        i.kind === "verse" &&
        i.verseRef.book_number === bookNumber &&
        i.verseRef.chapter === chapter,
    ),
  updateEarlyRef: (bookNumber, chapter, verse, reference, verseText) => {
    let found = false
    set((state) => {
      // Exact match: same book + same chapter
      let idx = state.items.findIndex(
        (i) => i.kind === "verse" && i.verseRef.is_chapter_only &&
          i.verseRef.book_number === bookNumber && i.verseRef.chapter === chapter,
      )
      // Fallback: same book, any chapter (book-only detection guessed chapter 1)
      if (idx === -1) {
        idx = state.items.findIndex(
          (i) => i.kind === "verse" && i.verseRef.is_chapter_only &&
            i.verseRef.book_number === bookNumber,
        )
      }
      if (idx === -1) return state
      const existing = state.items[idx]
      if (existing.kind !== "verse") return state
      found = true
      const items = [...state.items]
      items[idx] = {
        ...existing,
        title: `${existing.verseRef.book_name} ${chapter}:${verse}`,
        verseRef: { ...existing.verseRef, chapter, verse, is_chapter_only: false },
        slides: [
          {
            ...existing.slides[0],
            reference,
            segments: [{ verseNumber: verse, text: verseText }],
          },
        ],
      }
      return { items }
    })
    return found
  },
}))
