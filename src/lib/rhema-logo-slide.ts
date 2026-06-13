import type { ContentItem, MediaContentItem } from "@/types/content"
import type { Slide } from "@/types/slide"

export const RHEMA_LOGO_ID = "__rhema_logo_slate__"

export const RHEMA_LOGO_SLIDE: Slide = {
  reference: "",
  segments: [],
  label: "Rhema",
  media: { type: "image", src: "/rhema.svg", fit: "contain" },
}

export const RHEMA_LOGO_ITEM: MediaContentItem = {
  kind: "media",
  id: RHEMA_LOGO_ID,
  title: "Rhema",
  slides: [RHEMA_LOGO_SLIDE],
  source: "manual",
  added_at: 0,
  asset: { mediaType: "image", src: "/rhema.svg" },
}

export function isLogoItem(item: ContentItem | null): boolean {
  return item?.id === RHEMA_LOGO_ID
}
