import { describe, it, expect, beforeEach } from "vitest"
import { useBroadcastStore } from "./broadcast-store"
import { verseToContentItem } from "@/hooks/use-broadcast"
import type { Verse } from "@/types"

const verse: Verse = { id: 0, translation_id: 1, book_number: 1, book_name: "Genesis",
  book_abbreviation: "Gen", chapter: 1, verse: 1, text: "In the beginning" }

function multiSlideItem() {
  const base = verseToContentItem(verse, "KJV")
  return { ...base, slides: [base.slides[0], { reference: "", segments: [{ text: "slide 2" }] }] }
}

beforeEach(() => useBroadcastStore.setState({ liveItem: null, currentSlideIndex: 0, isLive: false }))

describe("broadcast-store live cursor", () => {
  it("presentItem loads slide 0 and goes on-air", () => {
    useBroadcastStore.getState().presentItem(verseToContentItem(verse, "KJV"))
    const s = useBroadcastStore.getState()
    expect(s.isLive).toBe(true)
    expect(s.currentSlideIndex).toBe(0)
    expect(s.liveItem?.slides[0].reference).toBe("Genesis 1:1 (KJV)")
  })

  it("nextSlide/prevSlide clamp within bounds", () => {
    useBroadcastStore.getState().presentItem(multiSlideItem())
    useBroadcastStore.getState().nextSlide()
    expect(useBroadcastStore.getState().currentSlideIndex).toBe(1)
    useBroadcastStore.getState().nextSlide() // clamp at last
    expect(useBroadcastStore.getState().currentSlideIndex).toBe(1)
    useBroadcastStore.getState().prevSlide()
    useBroadcastStore.getState().prevSlide() // clamp at first
    expect(useBroadcastStore.getState().currentSlideIndex).toBe(0)
  })

  it("setLive(false) blanks the live slide; clearLive removes content", () => {
    const { presentItem, setLive, clearLive } = useBroadcastStore.getState()
    presentItem(verseToContentItem(verse, "KJV"))
    setLive(false)
    expect(useBroadcastStore.getState().isLive).toBe(false)
    clearLive()
    expect(useBroadcastStore.getState().liveItem).toBeNull()
  })
})
