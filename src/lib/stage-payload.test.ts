import { describe, expect, it } from "vitest"
import type { ContentItem } from "@/types/content"
import { buildStageNextItem } from "./stage-payload"

describe("buildStageNextItem", () => {
  const items = [
    { id: "1", kind: "verse", title: "John 3:16" },
    { id: "2", kind: "lyrics", title: "Amazing Grace" },
  ] as unknown as ContentItem[]
  it("returns the item after the active index", () => {
    expect(buildStageNextItem(items, 0)).toEqual({ title: "Amazing Grace", kind: "lyrics" })
  })
  it("returns null at the end of the queue", () => {
    expect(buildStageNextItem(items, 1)).toBeNull()
  })
  it("returns the first item when nothing is active", () => {
    expect(buildStageNextItem(items, null)).toEqual({ title: "John 3:16", kind: "verse" })
  })
  it("returns null for an empty queue", () => {
    expect(buildStageNextItem([], null)).toBeNull()
  })
})
