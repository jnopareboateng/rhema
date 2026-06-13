import type { ContentItem, ContentKind } from "@/types/content"
import type { BroadcastTheme } from "@/types/broadcast"
import type { Slide } from "@/types/slide"

export interface StageNextItem { title: string; kind: ContentKind }
export interface StagePayload { theme: BroadcastTheme; currentSlide: Slide | null; nextItem: StageNextItem | null }

/** The item the operator should preview next: item after activeIndex, or the first if none active. */
export function buildStageNextItem(items: ContentItem[], activeIndex: number | null): StageNextItem | null {
  const nextIndex = activeIndex === null ? 0 : activeIndex + 1
  const next = items[nextIndex]
  return next ? { title: next.title, kind: next.kind } : null
}
