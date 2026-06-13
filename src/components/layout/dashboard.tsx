import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { ContentItem } from "@/types/content"
import { TopBar } from "@/components/shell/top-bar"
import { ServiceQueue } from "@/components/shell/service-queue"
import { PreviewStagingPanel } from "@/components/panels/preview-staging-panel"
import { LiveOutput } from "@/components/panels/live-output"
import { ContentBrowser } from "@/components/browser/content-browser"
import { VerseDetailPanel } from "@/components/panels/verse-detail-panel"

const TOP_RATIO_KEY = "rhema.shell.topRatio"
const MIN_RATIO = 0.25
const MAX_RATIO = 0.75
const DEFAULT_RATIO = 0.5
/** Height of the drag-handle flex item in px. */
const HANDLE_H = 12
/** Uniform padding on the right content area in px. */
const AREA_PAD = 8

function readStoredRatio(): number {
  try {
    const raw = localStorage.getItem(TOP_RATIO_KEY)
    if (raw !== null) {
      const v = parseFloat(raw)
      if (Number.isFinite(v) && v >= MIN_RATIO && v <= MAX_RATIO) return v
    }
  } catch {
    // localStorage blocked (private mode, SSR guard, etc.)
  }
  return DEFAULT_RATIO
}

/**
 * Dashboard — Rhema presentation shell.
 *
 * Grid (1440×900 target, min 1280×800):
 *   Row 1: TopBar (56px, full width)
 *   Row 2: ServiceQueue (280px fixed) | [PreviewStaging / LiveOutput] over [ContentBrowser / VerseDetail]
 *
 * Staged-item state is owned here and threaded to all four content panels (R4).
 * R1 follow-up: the top/bottom split in the right content area is draggable,
 *   defaults to 50:50, and is persisted in localStorage ("rhema.shell.topRatio").
 * Old AI-era panels (TransportBar, TranscriptPanel, DetectionsPanel, SearchPanel,
 * PreviewPanel, LiveOutputPanel, QueuePanel) are no longer mounted.
 */
export function Dashboard() {
  const [stagedItem, setStagedItem] = useState<ContentItem | null>(null)
  // R1: below 1280px the dense 2×2 right grid would clip; reflow to a single
  // scrollable column (Verse Detail drops under the Content Browser).
  const [narrow, setNarrow] = useState(false)
  // topRatio: fraction of the right-area inner height assigned to the top row.
  // Range: 0.25–0.75. Default: 0.5. Persisted to localStorage.
  // Lazy initialiser reads localStorage once at mount — avoids a sync setState in an effect.
  const [topRatio, setTopRatio] = useState<number>(() => readStoredRatio())
  const [dragActive, setDragActive] = useState(false)
  const isDraggingRef = useRef(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1280)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Persist ratio whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(TOP_RATIO_KEY, String(topRatio))
    } catch {
      // ignore
    }
  }, [topRatio])

  // ── Drag-handle pointer events ────────────────────────────────────────────
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    setDragActive(true)
  }

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDraggingRef.current || !contentAreaRef.current) return
    const rect = contentAreaRef.current.getBoundingClientRect()
    // innerH = total available height minus padding (top+bottom) and handle.
    // This is exactly the space shared between the two flex row sections.
    const innerH = rect.height - AREA_PAD * 2 - HANDLE_H
    const relY = e.clientY - rect.top - AREA_PAD
    setTopRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, relY / innerH)))
  }

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    isDraggingRef.current = false
    setDragActive(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: "0px",
        display: "grid",
        // Col 1: Service Queue (fixed). Col 2: right content area (fills remaining).
        gridTemplateColumns: "280px minmax(0, 1fr)",
        // Row 1: Top Bar. Row 2: main content (fills remaining height).
        gridTemplateRows: "56px minmax(0, 1fr)",
        overflow: "hidden",
      }}
      className="bg-background"
    >
      {/* ── Row 1: Top Bar (spans both columns) ─────────────────────────────── */}
      <div style={{ gridColumn: "1 / -1" }}>
        <TopBar />
      </div>

      {/* ── Row 2, Col 1: Service Queue ──────────────────────────────────────── */}
      <div
        className="min-h-0 overflow-hidden"
        style={{ padding: "8px 4px 8px 8px" }}
      >
        <ServiceQueue onPresent={setStagedItem} />
      </div>

      {/* ── Row 2, Col 2: flex column — two panel rows with draggable divider ── */}
      <div
        ref={contentAreaRef}
        className="min-h-0"
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "8px 8px 8px 4px",
          overflowX: "hidden",
          overflowY: narrow ? "auto" : "hidden",
        }}
      >
        {/* Top row: PreviewStaging | LiveOutput ───────────────────────────── */}
        <div
          style={{
            // non-narrow: flex-grow is topRatio so remaining space is split proportionally.
            // narrow: auto-size so panels flow naturally in the scrollable column.
            flex: narrow ? "0 0 auto" : `${topRatio} 1 0`,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "55fr 45fr",
            gridAutoRows: narrow ? "minmax(220px, auto)" : undefined,
            gap: "8px",
          }}
        >
          <PreviewStagingPanel
            stagedItem={stagedItem}
            setStagedItem={setStagedItem}
          />
          <LiveOutput />
        </div>

        {/* ── Horizontal drag handle (non-narrow only) ───────────────────── */}
        {!narrow && (
          <div
            className="group"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize top and bottom panels"
            style={{
              flex: `0 0 ${HANDLE_H}px`,
              cursor: "row-resize",
              userSelect: "none",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            {/* Full-width rule */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px transition-colors duration-150"
              style={{
                backgroundColor: dragActive
                  ? "hsl(var(--primary) / 0.5)"
                  : "hsl(var(--border))",
              }}
            />
            {/* Grip pill: 2×3 dot matrix — classic resize affordance */}
            <div
              className={[
                "relative z-10 inline-grid rounded border bg-background",
                "transition-all duration-150",
                dragActive
                  ? "border-primary/50"
                  : "border-border group-hover:border-muted-foreground/30",
              ].join(" ")}
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: "2.5px",
                padding: "4px 7px",
              }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={[
                    "rounded-full transition-colors duration-150",
                    dragActive
                      ? "bg-primary"
                      : "bg-muted-foreground/40 group-hover:bg-muted-foreground/70",
                  ].join(" ")}
                  style={{ width: "2.5px", height: "2.5px" }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottom row: ContentBrowser | VerseDetail ───────────────────────── */}
        <div
          style={{
            flex: narrow ? "0 0 auto" : `${1 - topRatio} 1 0`,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "55fr 45fr",
            gridAutoRows: narrow ? "minmax(220px, auto)" : undefined,
            gap: "8px",
            // In narrow mode, restore the gap between the two stacked groups.
            marginTop: narrow ? "8px" : 0,
          }}
        >
          <ContentBrowser setStagedItem={setStagedItem} />
          <VerseDetailPanel
            stagedItem={stagedItem}
            setStagedItem={setStagedItem}
          />
        </div>
      </div>
    </div>
  )
}
