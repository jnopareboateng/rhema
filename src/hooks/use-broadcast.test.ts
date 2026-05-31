import { describe, it, expect } from "vitest"
import { verseToContentItem } from "./use-broadcast"
import type { Verse } from "@/types"

const VERSE: Verse = {
  id: 1, translation_id: 1, book_number: 43, book_name: "John",
  book_abbreviation: "Jhn", chapter: 3, verse: 16, text: "For God so loved the world",
}

describe("verseToContentItem", () => {
  it("builds a one-slide verse deck with identical reference/segments", () => {
    const item = verseToContentItem(VERSE, "KJV")
    expect(item.kind).toBe("verse")
    expect(item.title).toBe("John 3:16")
    expect(item.slides).toHaveLength(1)
    expect(item.slides[0].reference).toBe("John 3:16 (KJV)")
    expect(item.slides[0].segments).toEqual([{ verseNumber: 16, text: "For God so loved the world" }])
    expect(item.verseRef).toMatchObject({
      translation: "KJV", book_number: 43, book_name: "John", chapter: 3, verse: 16,
    })
    expect(item.source).toBe("manual")
  })

  it("applies detection overrides (source, confidence, is_chapter_only, id)", () => {
    const item = verseToContentItem(VERSE, "KJV", {
      id: "fixed-id", source: "ai-direct", confidence: 0.92, is_chapter_only: true,
    })
    expect(item.id).toBe("fixed-id")
    expect(item.source).toBe("ai-direct")
    expect(item.confidence).toBe(0.92)
    expect(item.verseRef.is_chapter_only).toBe(true)
  })
})
