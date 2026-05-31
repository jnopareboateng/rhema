export interface Segment {
  /** Optional inline number (verses); omitted for lyrics/media. */
  verseNumber?: number
  text: string
}

export type SlideMedia =
  | { type: "image"; src: string; fit: "cover" | "contain" | "stretch" }
  | { type: "video"; src: string; fit: "cover" | "contain" | "stretch"; loop: boolean; muted: boolean }

/** The renderable unit — one screen. Formerly VerseRenderData. */
export interface Slide {
  /** Header line, e.g. "John 3:16 (KJV)" | "Amazing Grace" | "". */
  reference: string
  segments: Segment[]
  /** Operator-facing tag, e.g. "Verse 1" | "Chorus". */
  label?: string
  /** Present in the type now; the renderer honors it in M3. */
  media?: SlideMedia | null
}
