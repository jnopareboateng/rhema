import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { getAutocompleteSuggestion, getTabNavigationResult } from "@/lib/quick-search"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  BookOpenIcon,
  SparklesIcon,
  CheckIcon,
  PlusIcon,
  Loader2,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useBible, bibleActions, useActiveAbbrev } from "@/hooks/use-bible"
import { useBibleStore, useQueueStore } from "@/stores"
import { verseToContentItem, semanticResultToVerse } from "@/hooks/use-broadcast"
import type { Book, Verse, SemanticSearchResult } from "@/types"
import type { ContentItem } from "@/types/content"
import { Input } from "@/components/ui/input"
import { searchContextWithFuse } from "@/lib/context-search"

interface BibleBrowserProps {
  /** Called when user clicks a verse row — stages it in Preview/Staging. */
  onStage: (item: ContentItem) => void
}

/** Highlights words from the query that appear in the text. */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>

  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
  )
  if (queryWords.size === 0) return <>{text}</>

  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, i) => {
        const cleaned = part.toLowerCase().replace(/[^a-z']/g, "")
        if (cleaned.length >= 2 && queryWords.has(cleaned)) {
          return (
            <mark key={i} className="rounded-[2px] bg-emerald-800/90 px-0.5 text-foreground">
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function BibleBrowser({ onStage }: BibleBrowserProps) {
  /** Single input drives both reference navigation and free-text search. */
  const [unifiedQuery, setUnifiedQuery] = useState("")
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState(1)
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null)

  const [quickVersesList, setQuickVersesList] = useState<Verse[]>([])

  const quickInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const {
    translations,
    books,
    currentChapter,
    semanticResults,
    activeTranslationId,
    selectedVerse,
  } = useBible()

  const queueItems = useQueueStore((s) => s.items)
  const queuedVerseKeys = useMemo(() => {
    return new Set(
      queueItems
        .filter((item) => item.kind === "verse")
        .map((item) => `${item.verseRef.book_number}:${item.verseRef.chapter}:${item.verseRef.verse}`)
    )
  }, [queueItems])

  const selectedBookNumber = selectedBook?.book_number

  const activeTranslationAbbrev = useActiveAbbrev()

  // ── Routing heuristic ────────────────────────────────────────────────────────
  const autocompleteResult = useMemo(
    () => getAutocompleteSuggestion(unifiedQuery, books),
    [unifiedQuery, books]
  )
  const quickSuggestion = autocompleteResult.suggestion

  /**
   * "reference" when the query is empty (browse) OR it parses as a Bible
   * book/chapter/verse reference (stage !== "none").
   * "text" when the query has content that doesn't match any book reference.
   */
  const searchMode: "reference" | "text" =
    unifiedQuery.length === 0 || autocompleteResult.stage !== "none"
      ? "reference"
      : "text"

  // ── Initialisation ───────────────────────────────────────────────────────────
  useEffect(() => {
    bibleActions.loadTranslations().catch(console.error)
    bibleActions.loadBooks().then(() => {
      useBibleStore.getState().setPendingNavigation({
        bookNumber: 1,
        chapter: 1,
        verse: 1,
      })
    }).catch(console.error)
  }, [])

  // Load chapter when book + chapter state changes (e.g. translation switch)
  useEffect(() => {
    if (selectedBookNumber && chapter >= 1) {
      bibleActions.loadChapter(selectedBookNumber, chapter).catch(console.error)
    }
  }, [selectedBookNumber, chapter, activeTranslationId])

  const effectiveSelectedVerseId = useMemo(() => {
    if (!selectedVerseId || currentChapter.length === 0) return null
    if (currentChapter.some((v) => v.id === selectedVerseId)) return selectedVerseId
    if (!selectedVerse) return null
    return currentChapter.find((v) => v.verse === selectedVerse.verse)?.id ?? null
  }, [currentChapter, selectedVerseId, selectedVerse])

  // After chapter reloads (translation change), re-select by verse number
  useEffect(() => {
    if (!selectedVerseId || !selectedVerse || currentChapter.length === 0) return
    const stillExists = currentChapter.some((v) => v.id === selectedVerseId)
    if (!stillExists) {
      const match = currentChapter.find((v) => v.verse === selectedVerse.verse)
      if (match && match.id !== selectedVerse.id) {
        bibleActions.selectVerse(match)
      }
    }
  }, [currentChapter, selectedVerseId, selectedVerse])

  /**
   * Focused result: the resolved target verse plus up to one neighbour on each
   * side for disambiguation context. Only populated when a complete reference
   * has been typed and the chapter has loaded.
   */
  const focusedResultVerses = useMemo(() => {
    if (!effectiveSelectedVerseId || currentChapter.length === 0) return []
    const targetIdx = currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
    if (targetIdx === -1) return []
    const start = Math.max(0, targetIdx - 1)
    const end = Math.min(currentChapter.length - 1, targetIdx + 1)
    return currentChapter.slice(start, end + 1)
  }, [effectiveSelectedVerseId, currentChapter])

  const applyNavigationSelection = useCallback(
    (book: Book, navChapter: number) => {
      setSelectedBook(book)
      setChapter(navChapter)
    },
    []
  )

  // Auto-navigate when a detection or "Present" click sets pendingNavigation
  useEffect(() => {
    let lastHandledKey: string | null = null

    const unsubscribe = useBibleStore.subscribe((state) => {
      const pendingNavigation = state.pendingNavigation
      if (!pendingNavigation) {
        lastHandledKey = null
        return
      }

      const { bookNumber, chapter: navChapter, verse: navVerse } = pendingNavigation
      const pendingKey = `${bookNumber}:${navChapter}:${navVerse}`
      if (pendingKey === lastHandledKey) return

      const book = state.books.find((b) => b.book_number === bookNumber)
      if (!book) return

      lastHandledKey = pendingKey
      applyNavigationSelection(book, navChapter)

      bibleActions.loadChapter(bookNumber, navChapter).then((verses) => {
        const target = verses.find((v) => v.verse === navVerse)
        if (target) {
          setSelectedVerseId(target.id)
          bibleActions.selectVerse(target)
        }
        panelRef.current?.focus()
      }).catch(console.error).finally(() => {
        useBibleStore.getState().setPendingNavigation(null)
      })
    })

    return unsubscribe
  }, [applyNavigationSelection])

  // ── Verse interaction ────────────────────────────────────────────────────────
  const handleVerseClick = useCallback((verse: Verse) => {
    setSelectedVerseId(verse.id)
    bibleActions.selectVerse(verse)
    onStage(verseToContentItem(verse, activeTranslationAbbrev, { source: "manual" }))
  }, [onStage, activeTranslationAbbrev])

  // ── Text / semantic search ───────────────────────────────────────────────────
  const contextDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextSearchRequestIdRef = useRef(0)

  const runContextSearch = useCallback(async (query: string, translationId: number) => {
    const requestId = ++contextSearchRequestIdRef.current
    const isStale = () => requestId !== contextSearchRequestIdRef.current

    const hybridResults = await invoke<SemanticSearchResult[]>(
      "semantic_search", { query, limit: 15 }
    ).catch(() => null)

    if (isStale()) return

    if (hybridResults && hybridResults.length > 0) {
      useBibleStore.getState().setSemanticResults(hybridResults)
      return
    }

    const fuseResults = await searchContextWithFuse(query, translationId, 15).catch(() => [])
    if (isStale()) return
    useBibleStore.getState().setSemanticResults(fuseResults)
  }, [])

  /**
   * Unified input handler:
   * - Detects mode synchronously via getAutocompleteSuggestion.
   * - Debounces text search; clears semantic results immediately on reference mode.
   */
  const handleUnifiedQueryChange = useCallback((query: string) => {
    setUnifiedQuery(query)
    if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)

    const result = getAutocompleteSuggestion(query, books)
    const isTextMode = query.length > 0 && result.stage === "none"

    if (isTextMode && query.length >= 5) {
      const translationId = useBibleStore.getState().activeTranslationId
      contextDebounceRef.current = setTimeout(() => {
        runContextSearch(query, translationId).catch(console.error)
      }, 280)
    } else {
      contextSearchRequestIdRef.current += 1
      useBibleStore.getState().setSemanticResults([])
    }
  }, [runContextSearch, books])

  // Re-fire text search when translation changes while in text mode
  useEffect(() => {
    if (searchMode !== "text" || unifiedQuery.length < 5) return
    if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
    contextDebounceRef.current = setTimeout(() => {
      runContextSearch(unifiedQuery, activeTranslationId).catch(console.error)
    }, 120)
  }, [activeTranslationId, searchMode, unifiedQuery, runContextSearch])

  useEffect(() => {
    return () => {
      if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
    }
  }, [])

  // ── Reference-mode side effects: navigation + quick verse list ───────────────
  useEffect(() => {
    const result = autocompleteResult

    if (result.matchedBook && result.chapter && result.verse) {
      useBibleStore.getState().setPendingNavigation({
        bookNumber: result.matchedBook.book_number,
        chapter: result.chapter,
        verse: result.verse,
      })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (quickInputRef.current && document.activeElement !== quickInputRef.current) {
            quickInputRef.current.focus()
          }
        })
      })
    }

    if ((result.stage === "chapter" || result.stage === "verse") && result.matchedBook && result.chapter) {
      invoke<Verse[]>("get_chapter", {
        translationId: activeTranslationId,
        bookNumber: result.matchedBook.book_number,
        chapter: result.chapter,
      }).then(verses => {
        setQuickVersesList(verses)
      }).catch(console.error)
    }
  }, [autocompleteResult, activeTranslationId])

  const shouldShowVerseDropdown =
    searchMode === "reference" &&
    quickVersesList.length > 0 &&
    (autocompleteResult.stage === "chapter" || autocompleteResult.stage === "verse")

  const handleQuickKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "ArrowRight") && quickSuggestion && quickSuggestion !== unifiedQuery) {
      e.preventDefault()
      const nextInput = getTabNavigationResult(unifiedQuery, quickSuggestion)
      setUnifiedQuery(nextInput)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      setUnifiedQuery("")
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setUnifiedQuery("")
      return
    }
  }, [unifiedQuery, quickSuggestion])

  const handleQuickVerseClick = useCallback((verse: Verse) => {
    useBibleStore.getState().setPendingNavigation({
      bookNumber: verse.book_number,
      chapter: verse.chapter,
      verse: verse.verse,
    })
    setUnifiedQuery("")
  }, [])

  // ── Translation selector (shared between modes) ──────────────────────────────
  const translationSelector = (
    <Select
      value={String(activeTranslationId)}
      onValueChange={async (v) => {
        const id = Number(v)
        try {
          await invoke("set_active_translation", { translationId: id })
          useBibleStore.getState().setActiveTranslation(id)
        } catch (err) { console.error(err) }
      }}
    >
      <SelectTrigger size="sm" className="h-7 w-[72px] shrink-0 text-xs">
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
  )

  // ── Subtle mode indicator icon ────────────────────────────────────────────────
  const modeIcon = searchMode === "reference"
    ? <BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors" />
    : <SparklesIcon className="size-3.5 shrink-0 text-lime-400/80 transition-colors" />

  return (
    <TooltipProvider>
    <div
      ref={panelRef}
      data-slot="bible-browser"
      className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
      tabIndex={-1}
    >
      {/* STICKY: Single unified search row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 min-h-11">
        {modeIcon}

        {/* Input with ghost-suggestion overlay (reference mode) */}
        <div className="relative flex-1">
          {searchMode === "reference" && quickSuggestion && quickSuggestion !== unifiedQuery && (
            <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-10">
              <span className="text-xs font-normal">
                <span className="text-foreground">{unifiedQuery}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {quickSuggestion.slice(unifiedQuery.length)}
                </span>
              </span>
            </div>
          )}
          <Input
            ref={quickInputRef}
            value={unifiedQuery}
            onChange={(e) => handleUnifiedQueryChange(e.target.value)}
            onKeyDown={handleQuickKeyDown}
            placeholder="Type a reference (Jn 3:16) or phrase…"
            className={cn(
              "h-7 text-xs bg-background",
              searchMode === "reference" && quickSuggestion && quickSuggestion !== unifiedQuery
                ? "text-transparent"
                : ""
            )}
            style={
              searchMode === "reference" && quickSuggestion && quickSuggestion !== unifiedQuery
                ? { caretColor: "var(--foreground)" }
                : undefined
            }
          />

          {/* Quick verse dropdown (reference mode: chapter/verse stage) */}
          {shouldShowVerseDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              <div className="p-1">
                {quickVersesList.map((verse) => (
                  <button
                    key={verse.id}
                    onClick={() => handleQuickVerseClick(verse)}
                    className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="shrink-0 font-semibold text-primary w-6 text-right">
                      {verse.verse}
                    </span>
                    <span className="flex-1 text-muted-foreground line-clamp-1">
                      {verse.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {translationSelector}
      </div>

      {/* REFERENCE MODE — focused verse result ──────────────────────────────────
          Shows the resolved verse + up to 1 neighbour on each side as a search-
          result card. The full chapter reading view lives exclusively in Verse Detail. */}
      {searchMode === "reference" && (
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* Empty state: no query typed yet */}
          {!unifiedQuery && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <BookOpenIcon className="size-7 text-muted-foreground/20" />
              <p className="text-[0.6875rem] text-muted-foreground/50">
                Type a reference like{" "}
                <span className="font-mono text-muted-foreground/70">Jn 3:16</span>
              </p>
            </div>
          )}

          {/* Partial reference: book / chapter typed, waiting for verse */}
          {unifiedQuery &&
            autocompleteResult.stage !== "complete" &&
            autocompleteResult.stage !== "none" && (
              <div className="flex items-center justify-center p-8">
                <p className="text-[0.6875rem] text-muted-foreground/50">
                  Keep typing to resolve a verse…
                </p>
              </div>
            )}

          {/* Loading: complete reference parsed but chapter not yet loaded */}
          {unifiedQuery &&
            autocompleteResult.stage === "complete" &&
            focusedResultVerses.length === 0 && (
              <div className="flex items-center justify-center gap-2 p-8 text-[0.6875rem] text-muted-foreground/50">
                <Loader2 className="size-3 animate-spin" />
                Loading…
              </div>
            )}

          {/* Focused result: resolved reference with loaded verses */}
          {unifiedQuery &&
            autocompleteResult.stage === "complete" &&
            focusedResultVerses.length > 0 && (
              <div className="p-2">
                {/* Result label row */}
                <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                  <span className="text-[0.5625rem] uppercase tracking-wider text-muted-foreground/40">
                    Result
                  </span>
                  {selectedBook && (
                    <span className="rounded-sm bg-muted/40 px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground/60">
                      {selectedBook.name} {chapter}
                    </span>
                  )}
                </div>

                {/* Result card — target verse prominent, neighbours secondary */}
                <div className="overflow-hidden rounded-md border border-border">
                  {focusedResultVerses.map((verse, i) => {
                    const isTarget = verse.id === effectiveSelectedVerseId
                    const isQueued = queuedVerseKeys.has(
                      `${verse.book_number}:${verse.chapter}:${verse.verse}`
                    )
                    return (
                      <div
                        key={verse.id}
                        id={`bb-verse-${verse.id}`}
                        onClick={() => handleVerseClick(verse)}
                        className={cn(
                          "group relative flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors",
                          i < focusedResultVerses.length - 1 &&
                            "border-b border-border/50",
                          isTarget
                            ? "border-l-2 border-l-lime-500 bg-lime-500/10"
                            : "border-l-2 border-l-transparent opacity-60 hover:bg-muted/40 hover:opacity-100",
                        )}
                      >
                        {/* Verse number */}
                        <span
                          className={cn(
                            "mt-[0.1875rem] w-5 shrink-0 text-right font-mono text-[0.625rem] tabular-nums leading-relaxed",
                            isTarget
                              ? "font-semibold text-lime-500/90"
                              : "text-muted-foreground/40",
                          )}
                        >
                          {verse.verse}
                        </span>

                        {/* Verse text */}
                        <p
                          className={cn(
                            "flex-1 leading-relaxed",
                            isTarget
                              ? "text-sm text-foreground"
                              : "text-xs text-muted-foreground",
                          )}
                        >
                          {verse.text}
                        </p>

                        {/* Queue indicator / add button */}
                        {isQueued ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="mt-[0.1875rem] flex size-5 shrink-0 cursor-pointer items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const store = useQueueStore.getState()
                                  const idx = store.findDuplicate(
                                    verse.book_number,
                                    verse.chapter,
                                    verse.verse,
                                  )
                                  if (idx !== -1) {
                                    store.flashItem(store.items[idx].id)
                                    document
                                      .querySelector(
                                        `[data-slot="service-queue"] [data-queue-idx="${idx}"]`,
                                      )
                                      ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                                  }
                                }}
                              >
                                <CheckIcon className="size-3.5 text-ai-direct" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">Already in queue</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className={cn(
                                  "mt-[0.1875rem] shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                                  isTarget
                                    ? "hover:bg-lime-500/20 hover:text-lime-500"
                                    : "bg-primary/40! text-primary-foreground hover:bg-primary!",
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  useQueueStore.getState().addItem(
                                    verseToContentItem(verse, activeTranslationAbbrev, {
                                      source: "manual",
                                    }),
                                  )
                                }}
                              >
                                <PlusIcon className="size-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Add to queue</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Compact hint: chapter context is in Verse Detail */}
                <p className="mt-2 px-0.5 text-[0.5625rem] text-muted-foreground/35">
                  Click to stage. Full chapter context appears in Verse Detail.
                </p>
              </div>
            )}
        </div>
      )}

      {/* TEXT SEARCH MODE — semantic / hybrid search results ────────────────── */}
      {searchMode === "text" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-0 p-2">
            {unifiedQuery.length < 5 && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Search by meaning — type a phrase, paraphrase, or topic…
              </p>
            )}
            {unifiedQuery.length >= 5 && semanticResults.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No results found
              </p>
            )}
            {semanticResults.map((result, idx) => (
              <div
                key={`${result.book_number}-${result.chapter}-${result.verse}-${idx}`}
                onClick={() => {
                  const verse = semanticResultToVerse(result, activeTranslationId)
                  bibleActions.selectVerse(verse)
                  onStage(
                    verseToContentItem(verse, activeTranslationAbbrev, {
                      source: "manual",
                      confidence: result.similarity,
                    })
                  )
                }}
                className="group flex flex-col cursor-pointer gap-1 rounded-sm p-3 transition-colors hover:bg-muted/50 relative"
              >
                <div className="flex shrink-0 flex-row items-start gap-2">
                  <span className="text-xs font-semibold">
                    {result.book_name} {result.chapter}:{result.verse}
                  </span>
                  <span className="mt-0.5 text-[0.5rem] text-muted-foreground">
                    {Math.round(result.similarity * 100)}%
                  </span>
                </div>
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                  <HighlightedText text={result.verse_text} query={unifiedQuery} />
                </p>
                {queuedVerseKeys.has(`${result.book_number}:${result.chapter}:${result.verse}`) ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="flex size-6 absolute right-2 top-1/2 -translate-y-1/2 shrink-0 cursor-pointer items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          const store = useQueueStore.getState()
                          const dupeIdx = store.findDuplicate(result.book_number, result.chapter, result.verse)
                          if (dupeIdx !== -1) {
                            store.flashItem(store.items[dupeIdx].id)
                            document.querySelector(`[data-slot="service-queue"] [data-queue-idx="${dupeIdx}"]`)
                              ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                          }
                        }}
                      >
                        <CheckIcon className="size-4 text-ai-direct" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">Already in queue</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/80"
                        onClick={(e) => {
                          e.stopPropagation()
                          useQueueStore.getState().addItem(
                            verseToContentItem(
                              semanticResultToVerse(result, activeTranslationId),
                              activeTranslationAbbrev,
                              { source: "manual", confidence: result.similarity },
                            )
                          )
                        }}
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Add to queue</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}
