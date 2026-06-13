import { useState, useCallback } from "react"
import {
  BookOpenIcon,
  Music2Icon,
  VideoIcon,
  GripVerticalIcon,
  PlayIcon,
  PlusIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Loader2Icon,
  GalleryVerticalEndIcon,
  InfoIcon,
} from "lucide-react"
import type { ContentItem } from "@/types/content"
import type { Verse } from "@/types"
import { PanelHeader } from "@/components/ui/panel-header"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useQueueStore } from "@/stores/queue-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useBibleStore } from "@/stores"
import { bibleActions } from "@/hooks/use-bible"
import { verseToContentItem } from "@/hooks/use-broadcast"
import { DragDropProvider } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"

// ── Helpers ───────────────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: ContentItem["kind"] }) {
  switch (kind) {
    case "verse":
      return <BookOpenIcon className="size-3 shrink-0 text-blue-400" />
    case "lyrics":
      return <Music2Icon className="size-3 shrink-0 text-purple-400" />
    case "media":
      return <VideoIcon className="size-3 shrink-0 text-teal-400" />
  }
}

function SectionLabel({
  label,
  count,
}: {
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2 px-2 pb-0.5 pt-2.5 first:pt-1.5">
      <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted/60 px-1.5 py-px text-[0.5rem] font-semibold tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
      <div className="h-px flex-1 bg-border/30" />
    </div>
  )
}

// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableRow({
  item,
  index,
  isCurrentSection,
  onPresent,
}: {
  item: ContentItem
  index: number
  isCurrentSection: boolean
  onPresent: (item: ContentItem) => void
}) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: item.id,
    index,
  })

  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItemId = useBroadcastStore((s) => s.liveItem?.id)
  const showLive = isLive && liveItemId === item.id

  const handlePlay = () => {
    useQueueStore.getState().setActive(index)
    useBroadcastStore.getState().presentItem(item)
    onPresent(item)
  }

  return (
    <div
      ref={(el) => ref(el)}
      className={cn(
        "group flex h-10 cursor-default select-none items-center gap-1.5 transition-all duration-100",
        isCurrentSection
          ? // Green left border + tinted background for CURRENT
            "rounded-r-md border-l-2 border-emerald-500 bg-emerald-500/[0.07] pl-1.5 pr-2"
          : "rounded-md px-2 hover:bg-white/[0.04]",
        isDragging && "opacity-30",
        isDropTarget && !isDragging && "bg-white/[0.06]",
      )}
    >
      {/* Drag handle — only visible on hover */}
      <span
        ref={(el) => handleRef(el)}
        className="flex shrink-0 cursor-grab items-center text-muted-foreground/25 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVerticalIcon className="size-3" />
      </span>

      {/* Content-kind icon */}
      <KindIcon kind={item.kind} />

      {/* Title + kind label */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.75rem] font-medium leading-[1.2] text-foreground/90">
          {item.title}
        </p>
        <p className="truncate text-[0.5625rem] capitalize leading-[1.2] text-muted-foreground/50">
          {item.kind}
        </p>
      </div>

      {/* ● LIVE badge */}
      {showLive && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-[3px] text-[0.5rem] font-bold uppercase tracking-[0.1em] text-emerald-400"
          aria-label="Live"
        >
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      )}

      {/* ▶ Play button — visible on hover */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handlePlay}
        aria-label={`Present ${item.title}`}
        title="Present"
      >
        <PlayIcon className="size-2.5" />
      </Button>
    </div>
  )
}

// ── Add Item popover ──────────────────────────────────────────────────────────

function AddItemPopover() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Verse[]>([])

  const translations = useBibleStore((s) => s.translations)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const abbrev =
    translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "KJV"

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const verses = await bibleActions.searchVerses(q.trim(), 15)
      setResults(verses)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSelect = useCallback(
    (verse: Verse) => {
      const item = verseToContentItem(verse, abbrev, { source: "manual" })
      useQueueStore.getState().addItem(item)
      setOpen(false)
      setQuery("")
      setResults([])
    },
    [abbrev],
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery("")
      setResults([])
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="h-6 gap-1 text-[0.625rem] font-semibold uppercase tracking-wide"
        >
          <PlusIcon className="size-3" />
          Add Item
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-72 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Popover header */}
        <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
          Quick Add — Bible
        </p>

        {/* Search input */}
        <div className="relative mb-2">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            className="h-8 pl-7 text-xs"
            placeholder="Search verses…"
            value={query}
            onChange={(e) => {
              void handleSearch(e.target.value)
            }}
            autoFocus
          />
          {searching && (
            <Loader2Icon className="absolute right-2.5 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground/40" />
          )}
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ScrollArea className="max-h-52">
            <div className="flex flex-col gap-px">
              {results.map((verse) => (
                <button
                  key={verse.id}
                  onClick={() => handleSelect(verse)}
                  className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span className="text-[0.6875rem] font-semibold text-foreground/90">
                    {verse.book_name} {verse.chapter}:{verse.verse}
                  </span>
                  <span className="line-clamp-2 text-[0.5625rem] leading-relaxed text-muted-foreground/70">
                    {verse.text}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : query && !searching ? (
          <p className="py-3 text-center text-[0.6875rem] text-muted-foreground/50">
            No results found
          </p>
        ) : !query ? (
          <div className="rounded-md border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-[0.5625rem] text-muted-foreground/40">
              Songs · Media · Text — coming in a future update
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

// ── Overflow menu ─────────────────────────────────────────────────────────────

function OverflowMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Queue options"
          title="More options"
        >
          <MoreHorizontalIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-44 p-1">
        <button
          onClick={() => {
            useQueueStore.getState().clearQueue()
            setOpen(false)
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[0.75rem] text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Clear All
        </button>
      </PopoverContent>
    </Popover>
  )
}

// ── Service Queue (root component) ────────────────────────────────────────────

interface ServiceQueueProps {
  /** Called when a queue item's play button is clicked. */
  onPresent: (item: ContentItem) => void
}

export function ServiceQueue({ onPresent }: ServiceQueueProps) {
  const items = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)

  // ── Visual sections (positional only — no data model change) ──────────────
  const currentItem = activeIndex !== null ? (items[activeIndex] ?? null) : null
  const currentGlobalIndex = activeIndex ?? -1

  type IndexedItem = { item: ContentItem; globalIndex: number }

  const upNextItems: IndexedItem[] =
    activeIndex === null
      ? items.map((item, i) => ({ item, globalIndex: i }))
      : items
          .slice(activeIndex + 1, activeIndex + 6)
          .map((item, offset) => ({
            item,
            globalIndex: activeIndex + 1 + offset,
          }))

  const laterItems: IndexedItem[] =
    activeIndex === null
      ? []
      : items.slice(activeIndex + 6).map((item, offset) => ({
          item,
          globalIndex: activeIndex + 6 + offset,
        }))

  // ── Drag end: reorder + preserve active-item identity ────────────────────
  const handleDragEnd = useCallback(
    (event: {
      canceled: boolean
      operation: {
        source: { initialIndex?: number } | null
        target: { index?: number } | null
      }
    }) => {
      if (event.canceled) return
      const { source, target } = event.operation
      if (!source || !target) return

      const fromIndex = source.initialIndex
      const toIndex = target.index
      if (fromIndex === undefined || toIndex === undefined) return
      if (fromIndex === toIndex) return

      // Snapshot the active item's ID before the reorder mutates indices
      const { activeIndex: currActive, items: currItems } =
        useQueueStore.getState()
      const activeItemId =
        currActive !== null ? (currItems[currActive]?.id ?? null) : null

      useQueueStore.getState().reorderItems(fromIndex, toIndex)

      // Recompute and restore activeIndex so it still points at the same item
      if (activeItemId !== null) {
        const newItems = useQueueStore.getState().items
        const newIdx = newItems.findIndex((i) => i.id === activeItemId)
        if (newIdx !== -1 && newIdx !== currActive) {
          useQueueStore.getState().setActive(newIdx)
        }
      }
    },
    [],
  )

  const isEmpty = items.length === 0

  return (
    <div
      data-slot="service-queue"
      className={cn(
        "flex min-h-0 h-full flex-col overflow-hidden rounded-lg",
        "border border-border/60 bg-card",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_1px_4px_0_rgba(0,0,0,0.25)]",
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PanelHeader title="Service Queue">
        <AddItemPopover />
        <OverflowMenu />
      </PanelHeader>

      {/* ── Scrollable item list ───────────────────────────────────────────── */}
      <ScrollArea className="min-h-0 flex-1">
        {/* DragDropProvider scoped to the list */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DragDropProvider onDragEnd={handleDragEnd as any}>
          <div className="flex flex-col pb-1 pt-0.5">
            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <GalleryVerticalEndIcon className="size-5 text-muted-foreground/20" />
                <p className="text-[0.6875rem] font-medium text-muted-foreground/40">
                  Queue is empty
                </p>
                <p className="text-[0.5625rem] text-muted-foreground/30">
                  Use + Add Item to get started
                </p>
              </div>
            )}

            {/* CURRENT section */}
            {!isEmpty && (
              <>
                <SectionLabel label="Current" />
                {currentItem !== null ? (
                  <div className="px-1.5">
                    <SortableRow
                      key={currentItem.id}
                      item={currentItem}
                      index={currentGlobalIndex}
                      isCurrentSection
                      onPresent={onPresent}
                    />
                  </div>
                ) : (
                  <p className="px-3 pb-1 text-[0.5625rem] italic text-muted-foreground/30">
                    Nothing presented yet
                  </p>
                )}
              </>
            )}

            {/* UP NEXT section */}
            {upNextItems.length > 0 && (
              <>
                <SectionLabel
                  label="Up Next"
                  count={upNextItems.length}
                />
                <div className="flex flex-col gap-px px-1.5">
                  {upNextItems.map(({ item, globalIndex }) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      index={globalIndex}
                      isCurrentSection={false}
                      onPresent={onPresent}
                    />
                  ))}
                </div>
              </>
            )}

            {/* LATER section */}
            {laterItems.length > 0 && (
              <>
                <SectionLabel label="Later" count={laterItems.length} />
                <div className="flex flex-col gap-px px-1.5">
                  {laterItems.map(({ item, globalIndex }) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      index={globalIndex}
                      isCurrentSection={false}
                      onPresent={onPresent}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DragDropProvider>
      </ScrollArea>

      {/* ── Footer hint ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-t border-border/40 px-3 py-2">
        <InfoIcon className="size-2.5 shrink-0 text-muted-foreground/25" />
        <p className="text-[0.5rem] text-muted-foreground/35">
          Drag items to reorder
        </p>
      </div>
    </div>
  )
}
