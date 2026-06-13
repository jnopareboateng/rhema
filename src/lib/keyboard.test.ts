import { describe, expect, it } from "vitest"
import { shouldIgnoreGlobalKey } from "./keyboard"

/** Baseline: no modifier held. */
const noMod = {
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
} as const

/** Build a minimal DocLike for testing. */
function makeDoc(opts?: {
  tagName?: string
  contentEditable?: string
  hasOverlay?: boolean
}): Parameters<typeof shouldIgnoreGlobalKey>[1] {
  return {
    activeElement: {
      tagName: opts?.tagName ?? "BODY",
      contentEditable: opts?.contentEditable ?? "inherit",
    } as unknown as Element,
    querySelector: () =>
      opts?.hasOverlay ? ({ tagName: "DIV" } as Element) : null,
  }
}

describe("shouldIgnoreGlobalKey", () => {
  describe("modifier keys — any modifier suppresses the handler", () => {
    it("returns true when ctrlKey is held", () => {
      expect(shouldIgnoreGlobalKey({ ...noMod, ctrlKey: true }, makeDoc())).toBe(true)
    })
    it("returns true when metaKey is held", () => {
      expect(shouldIgnoreGlobalKey({ ...noMod, metaKey: true }, makeDoc())).toBe(true)
    })
    it("returns true when altKey is held", () => {
      expect(shouldIgnoreGlobalKey({ ...noMod, altKey: true }, makeDoc())).toBe(true)
    })
    it("returns true when shiftKey is held", () => {
      expect(shouldIgnoreGlobalKey({ ...noMod, shiftKey: true }, makeDoc())).toBe(true)
    })
  })

  describe("plain key with body focus and no overlay", () => {
    it("returns false — handler should proceed", () => {
      expect(shouldIgnoreGlobalKey(noMod, makeDoc())).toBe(false)
    })
  })

  describe("focused form elements suppress the handler", () => {
    it("returns true when an <input> is focused", () => {
      expect(shouldIgnoreGlobalKey(noMod, makeDoc({ tagName: "INPUT" }))).toBe(true)
    })
    it("returns true when a <textarea> is focused", () => {
      expect(shouldIgnoreGlobalKey(noMod, makeDoc({ tagName: "TEXTAREA" }))).toBe(true)
    })
    it("returns true when a <select> is focused", () => {
      expect(shouldIgnoreGlobalKey(noMod, makeDoc({ tagName: "SELECT" }))).toBe(true)
    })
    it("returns true when a contentEditable element is focused", () => {
      expect(
        shouldIgnoreGlobalKey(
          noMod,
          makeDoc({ tagName: "DIV", contentEditable: "true" }),
        ),
      ).toBe(true)
    })
  })

  describe("open overlays suppress the handler", () => {
    it("returns true when a dialog / menu / listbox is open", () => {
      expect(shouldIgnoreGlobalKey(noMod, makeDoc({ hasOverlay: true }))).toBe(true)
    })
  })

  describe("combination: modifier + form element still returns true", () => {
    it("returns true (modifier wins before DOM check)", () => {
      expect(
        shouldIgnoreGlobalKey(
          { ...noMod, ctrlKey: true },
          makeDoc({ tagName: "INPUT" }),
        ),
      ).toBe(true)
    })
  })
})
