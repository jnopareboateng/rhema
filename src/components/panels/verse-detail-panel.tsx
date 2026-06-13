import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  BookOpen,
  Clipboard,
  Play,
  ListPlus,
  RefreshCw,
} from "lucide-react"

import type { ContentItem } from "@/types/content"
import { PanelHeader } from "@/components/ui/panel-header"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useBible, bibleActions, useActiveAbbrev, getActiveAbbrev } from "@/hooks/use-bible"
import { useBibleStore } from "@/stores"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { verseToContentItem } from "@/hooks/use-broadcast"
import { shouldIgnoreGlobalKey } from "@/lib/keyboard"

interface VerseDetailPanelProps {
  /** The item currently staged (drives the chapter context display). */
  stagedItem: ContentItem | null
  /** Called on verse selection or arrow-key nav. */
  setStagedItem: (i: ContentItem | null) => void
}

export function VerseDetailPanel({ stagedItem, setStagedItem }: VerseDetailPanelProps) {
  const { translations, activeTranslationId, currentChapter } = useBible()

  // Ref that tracks the active verse row DOM node for scroll-into-view.
  const activeVerseRef = useRef<HTMLDivElement | null>(null)

  // Refs for the keydown handler — avoid stale closures without re-attaching.
  const stagedItemRef = useRef(stagedItem)
  const currentChapterRef = useRef(currentChapter)

  useEffect(() => { stagedItemRef.current = stagedItem }, [stagedItem])
  useEffect(() => { currentChapterRef.current = currentChapter }, [currentChapter])

  // Narrow staged item to VerseContentItem once.
  const verseItem = stagedItem?.kind === "verse" ? stagedItem : null

  // Derived primitives used as effect deps so React can diff them cheaply.
  const verseBook = verseItem?.verseRef.book_number
  const verseChapter = verseItem?.verseRef.chapter
  const verseNumber = verseItem?.verseRef.verse

  // Active translation abbreviation (for building new ContentItems).
  const abbrev = useActiveAbbrev()

  // ── Chapter loading ────────────────────────────────────────────────────────
  // Re-load whenever the staged verse's book/chapter changes or the translation
  // changes.
  useEffect(() => {
    if (verseBook == null || verseChapter == null) return
    void bibleActions.loadChapter(verseBook, verseChapter, activeTranslationId)
  }, [verseBook, verseChapter, activeTranslationId])

  // ── Auto-scroll active verse into view ────────────────────────────────────
  // Fires after the DOM has committed the new active row (ref is updated
  // during the commit phase, before effects run).
  useEffect(() => {
    if (currentChapter.length === 0) return
    activeVerseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [verseNumber, verseChapter, currentChapter.length])

  // ── Global arrow-key navigation ───────────────────────────────────────────
  // Attached once; uses refs so it always reads the latest state without
  // re-attaching.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (shouldIgnoreGlobalKey(e)) return
      if ((document.activeElement as HTMLElement | null)?.closest?.('[data-slot="content-browser"]')) return
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return

      const item = stagedItemRef.current
      if (!item || item.kind !== "verse") return

      const chapter = currentChapterRef.current
      if (chapter.length === 0) return

      const currentVerseNum = item.verseRef.verse
      const idx = chapter.findIndex((v) => v.verse === currentVerseNum)
      if (idx === -1) return

      e.preventDefault()

      const nextIdx =
        e.key === "ArrowLeft"
          ? Math.max(0, idx - 1)
          : Math.min(chapter.length - 1, idx + 1)

      const nextVerse = chapter[nextIdx]
      setStagedItem(verseToContentItem(nextVerse, getActiveAbbrev(), { source: "manual" }))
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [setStagedItem])

  // ── Translation change ────────────────────────────────────────────────────
  function handleTranslationChange(value: string) {
    const id = Number(value)
    void invoke("set_active_translation", { translationId: id })
    useBibleStore.getState().setActiveTranslation(id)
    // Chapter reload is triggered by the loadChapter effect (activeTranslationId dep).
  }

  // Header title: reference when a verse is staged, otherwise panel label.
  const headerTitle = verseItem
    ? verseItem.title
    : "Verse Detail"

  return (
    <div
      data-slot="verse-detail-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card",
      )}
    >
      {/* ── Header ── */}
      <PanelHeader title={headerTitle} icon={<BookOpen className="size-3.5" />}>
        {verseItem && translations.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground/50">
              Translation
            </span>
            <Select
              value={String(activeTranslationId)}
              onValueChange={handleTranslationChange}
            >
              <SelectTrigger
                size="sm"
                className="h-6 min-w-[3.75rem] border-border/50 bg-transparent text-[0.6875rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {translations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PanelHeader>

      {/* ── Empty state ── */}
      {!verseItem ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <BookOpen className="size-8 text-muted-foreground/20" />
            <p className="text-[0.6875rem] text-muted-foreground/60">
              Select a verse to see chapter context
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Chapter verse list ── */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="py-0.5">
              {currentChapter.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-[0.6875rem] text-muted-foreground/50">
                  <RefreshCw className="size-3 animate-spin" />
                  Loading chapter…
                </div>
              ) : (
                currentChapter.map((verse) => {
                  const isActive = verse.verse === verseItem.verseRef.verse
                  return (
                    <div
                      key={verse.id}
                      ref={isActive ? activeVerseRef : null}
                      className={cn(
                        "flex cursor-pointer select-none items-start gap-2.5 py-1.5 pr-3 text-[0.75rem] transition-colors duration-100",
                        "hover:bg-foreground/[0.04]",
                        isActive
                          ? "border-l-2 border-blue-500 bg-blue-500/10 pl-[calc(0.75rem-2px)]"
                          : "border-l-2 border-transparent pl-3",
                      )}
                      onClick={() => {
                        setStagedItem(
                          verseToContentItem(verse, abbrev, { source: "manual" }),
                        )
                      }}
                      onDoubleClick={() => {
                        const item = verseToContentItem(verse, abbrev, {
                          source: "manual",
                        })
                        useBroadcastStore.getState().presentItem(item)
                        setStagedItem(item)
                      }}
                    >
                      {/* Verse number */}
                      <span className="w-5 shrink-0 pt-[0.0625rem] text-right font-mono text-[0.625rem] tabular-nums leading-relaxed text-muted-foreground/50">
                        {verse.verse}
                      </span>
                      {/* Verse text */}
                      <span
                        className={cn(
                          "leading-relaxed",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {verse.text}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* ── Action bar ── */}
          <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card/80 px-2.5 py-2">
            {/* Present Now */}
            <button
              type="button"
              onClick={() => useBroadcastStore.getState().presentItem(stagedItem!)}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded",
                "bg-emerald-600/90 px-2 text-[0.6875rem] font-medium text-white",
                "transition-colors hover:bg-emerald-500 active:bg-emerald-700",
              )}
            >
              <Play className="size-3 fill-current" />
              Present Now
            </button>

            {/* Add to Queue */}
            <button
              type="button"
              onClick={() => useQueueStore.getState().addItem(stagedItem!)}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded",
                "border border-border bg-transparent px-2 text-[0.6875rem] text-muted-foreground",
                "transition-colors hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <ListPlus className="size-3" />
              Queue
            </button>

            {/* Copy Text */}
            <button
              type="button"
              title="Copy verse text"
              onClick={() => {
                const text =
                  currentChapter.find((v) => v.verse === verseItem.verseRef.verse)
                    ?.text ??
                  verseItem.slides[0]?.segments[0]?.text ??
                  ""
                void navigator.clipboard.writeText(text)
              }}
              className={cn(
                "flex h-7 w-8 shrink-0 items-center justify-center rounded",
                "border border-border bg-transparent text-muted-foreground",
                "transition-colors hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Clipboard className="size-3" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
