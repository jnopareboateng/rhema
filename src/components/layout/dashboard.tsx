import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ContentItem } from "@/types/content"
import { TopBar } from "@/components/shell/top-bar"
import { ServiceQueue } from "@/components/shell/service-queue"
import { PreviewStagingPanel } from "@/components/panels/preview-staging-panel"
import { LiveOutput } from "@/components/panels/live-output"
import { ContentBrowser } from "@/components/browser/content-browser"
import { VerseDetailPanel } from "@/components/panels/verse-detail-panel"

const TOP_RATIO_KEY = "rhema.shell.topRatio"
const QUEUE_COLLAPSED_KEY = "rhema.shell.queueCollapsed"
const MIN_RATIO = 0.25
const MAX_RATIO = 0.75
const DEFAULT_RATIO = 0.5
/** Height of the drag-handle hit zone in px (the 1px rule sits at centre). */
const HANDLE_H = 8
/** Uniform vertical padding on the right content area in px. */
const AREA_PAD = 6

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

function readStoredCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(QUEUE_COLLAPSED_KEY)
    if (raw !== null) return raw === "true"
  } catch {
    // localStorage blocked
  }
  return false
}

/**
 * Dashboard — Rhema presentation shell.
 *
 * Grid (1440×900 target, min 1280×800):
 *   Row 1: TopBar (56px, full width)
 *   Row 2: ServiceQueue (280px fixed, collapsible) | [PreviewStaging / LiveOutput] over [ContentBrowser / VerseDetail]
 *
 * Staged-item state is owned here and threaded to all four content panels.
 * Top/bottom split in the right content area is draggable, defaults to 50:50,
 *   and persisted in localStorage ("rhema.shell.topRatio").
 * Queue collapse: the 280px column is hideable; state persisted to localStorage
 *   ("rhema.shell.queueCollapsed", default false). Toggle via the ServiceQueue
 *   header button or the Queue toggle in TopBar.
 */
export function Dashboard() {
  const [stagedItem, setStagedItem] = useState<ContentItem | null>(null)
  // R1: below 1280px the dense 2×2 right grid would clip; reflow to a single
  // scrollable column (Verse Detail drops under the Content Browser).
  const [narrow, setNarrow] = useState(false)
  // topRatio: fraction of the right-area inner height assigned to the top row.
  // Range: 0.25–0.75. Default: 0.5. Persisted to localStorage.
  // Lazy initialiser reads localStorage once at mount.
  const [topRatio, setTopRatio] = useState<number>(() => readStoredRatio())
  const [dragActive, setDragActive] = useState(false)
  // queueCollapsed: whether the 280px left queue column is hidden.
  const [queueCollapsed, setQueueCollapsed] = useState<boolean>(() => readStoredCollapsed())
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

  // Persist queue collapsed state.
  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_COLLAPSED_KEY, String(queueCollapsed))
    } catch {
      // ignore
    }
  }, [queueCollapsed])

  const toggleQueue = useCallback(() => setQueueCollapsed((v) => !v), [])

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
        // When collapsed, drop the 280px queue column entirely.
        gridTemplateColumns: queueCollapsed
          ? "minmax(0, 1fr)"
          : "280px minmax(0, 1fr)",
        // Row 1: Top Bar. Row 2: main content (fills remaining height).
        gridTemplateRows: "56px minmax(0, 1fr)",
        overflow: "hidden",
      }}
      className="bg-background"
    >
      {/* ── Row 1: Top Bar (spans both columns) ─────────────────────────────── */}
      <div style={{ gridColumn: "1 / -1" }}>
        <TopBar queueCollapsed={queueCollapsed} onToggleQueue={toggleQueue} />
      </div>

      {/* ── Row 2, Col 1: Service Queue (unmounted when collapsed) ───────────── */}
      {!queueCollapsed && (
        <div
          className="min-h-0 overflow-hidden"
          style={{ padding: "6px 3px 6px 6px" }}
        >
          <ServiceQueue onPresent={setStagedItem} onCollapse={toggleQueue} />
        </div>
      )}

      {/* ── Row 2, Col 2 (Col 1 when collapsed): flex column — two panel rows ── */}
      <div
        ref={contentAreaRef}
        className="min-h-0"
        style={{
          display: "flex",
          flexDirection: "column",
          // When expanded: 3px left matches the queue column's 3px right gap.
          // When collapsed: symmetric 6px on all sides.
          padding: queueCollapsed ? "6px 6px 6px 6px" : "6px 6px 6px 3px",
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
            gap: "4px",
          }}
        >
          <PreviewStagingPanel
            stagedItem={stagedItem}
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
              zIndex: 10,
            }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            {/* The 1px rule IS the drag target — no pill widget.
                Subtle tint on hover; primary accent while dragging. */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px transition-colors duration-150"
              style={{
                backgroundColor: dragActive
                  ? "hsl(var(--primary) / 0.6)"
                  : "hsl(var(--border) / 0.8)",
              }}
            />
            {/* 6px hover zone: faint strip centred on the line */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-border/[0.06] rounded-sm" />
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
            gap: "4px",
            // In narrow mode, restore the gap between the two stacked groups.
            marginTop: narrow ? "4px" : 0,
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
