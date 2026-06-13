import { describe, expect, it } from "vitest"
import { RHEMA_LOGO_SLIDE, RHEMA_LOGO_ITEM, isLogoItem } from "./rhema-logo-slide"

describe("rhema logo slate", () => {
  it("slide points at the rhema svg, contain fit, on black", () => {
    expect(RHEMA_LOGO_SLIDE.media).toEqual({ type: "image", src: "/rhema.svg", fit: "contain" })
    expect(RHEMA_LOGO_SLIDE.segments).toEqual([])
  })
  it("logo content item is a stable identifiable media item", () => {
    expect(RHEMA_LOGO_ITEM.kind).toBe("media")
    expect(isLogoItem(RHEMA_LOGO_ITEM)).toBe(true)
  })
})
