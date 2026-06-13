/**
 * Minimal document-like interface injected for unit testing.
 * Production code uses the global `document` object.
 */
interface DocLike {
  readonly activeElement: Element | null
  querySelector(selector: string): Element | null
}

/**
 * True when a global arrow-key handler should ignore the event (R5).
 *
 * Suppresses when:
 * - Any modifier (Ctrl/Meta/Alt/Shift) is held.
 * - Focus is inside an editable element (`input`, `textarea`, `select`,
 *   or any `[contenteditable]`).
 * - An open dialog, menu, or listbox is present in the DOM.
 *
 * @param e     The keyboard event (or a subset of its modifier flags).
 * @param _doc  Optional document substitute — used only in unit tests.
 */
export function shouldIgnoreGlobalKey(
  e: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  _doc?: DocLike,
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return true

  const doc: DocLike =
    _doc ??
    (typeof document !== "undefined"
      ? document
      : { activeElement: null, querySelector: () => null })

  const el = doc.activeElement
  if (el) {
    const tag = el.tagName.toLowerCase()
    if (tag === "input" || tag === "textarea" || tag === "select") return true
    if ((el as HTMLElement).contentEditable === "true") return true
  }

  if (
    doc.querySelector(
      '[role="dialog"], [role="menu"][data-state="open"], [role="listbox"]',
    )
  ) {
    return true
  }

  return false
}
