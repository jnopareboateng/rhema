import { describe, it, expect, beforeEach } from "vitest"
import { useQueueStore } from "./queue-store"
import { verseToContentItem } from "@/hooks/use-broadcast"
import type { Verse } from "@/types"

function v(book: number, chapter: number, verse: number, text = "x"): Verse {
  return { id: 0, translation_id: 1, book_number: book, book_name: "Mark",
    book_abbreviation: "Mrk", chapter, verse, text }
}

beforeEach(() => useQueueStore.setState({ items: [], activeIndex: null, highlightedId: null }))

describe("queue-store with ContentItem", () => {
  it("dedups verse items by book:chapter:verse", () => {
    const s = useQueueStore.getState()
    s.addItem(verseToContentItem(v(41, 1, 1), "KJV"))
    s.addItem(verseToContentItem(v(41, 1, 1), "KJV"))
    expect(useQueueStore.getState().items).toHaveLength(1)
  })

  it("findVerseInChapter matches by book+chapter ignoring verse", () => {
    const s = useQueueStore.getState()
    s.addItem(verseToContentItem(v(41, 1, 2), "KJV"))
    expect(s.findVerseInChapter(41, 1)).toBe(0)
    expect(s.findVerseInChapter(41, 2)).toBe(-1)
  })

  it("addItem appends to the end of the queue", () => {
    const a = verseToContentItem(v(1, 1, 1), "KJV")
    const b = verseToContentItem(v(43, 3, 16), "KJV")
    useQueueStore.getState().addItem(a)
    useQueueStore.getState().addItem(b)
    const items = useQueueStore.getState().items
    expect(items.map((i) => i.id)).toEqual([a.id, b.id]) // a first, b last
  })

  it("updateEarlyRef refines a chapter-only item and shifts the dedup key (book-only fallback)", () => {
    const s = useQueueStore.getState()
    // book-only detection guessed chapter 1, verse 1
    s.addItem(verseToContentItem(v(41, 1, 1), "KJV", { is_chapter_only: true }))
    // refinement lands on a DIFFERENT chapter/verse
    const ok = s.updateEarlyRef(41, 5, 9, "Mark 5:9 (KJV)", "My name is Legion")
    expect(ok).toBe(true)
    const item = useQueueStore.getState().items[0]
    expect(item.kind).toBe("verse")
    if (item.kind !== "verse") throw new Error("expected verse")
    expect(item.verseRef.chapter).toBe(5)
    expect(item.verseRef.verse).toBe(9)
    expect(item.verseRef.is_chapter_only).toBe(false)
    expect(item.title).toBe("Mark 5:9")
    expect(item.slides[0].reference).toBe("Mark 5:9 (KJV)")
    expect(item.slides[0].segments[0]).toEqual({ verseNumber: 9, text: "My name is Legion" })
    // dedup key is now v:41:5:9 — a second add of (41,5,9) must be blocked
    s.addItem(verseToContentItem(v(41, 5, 9), "KJV"))
    expect(useQueueStore.getState().items).toHaveLength(1)
  })
})
