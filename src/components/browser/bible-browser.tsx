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
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useBible, bibleActions } from "@/hooks/use-bible"
import { useBibleStore, useQueueStore } from "@/stores"
import { verseToContentItem } from "@/hooks/use-broadcast"
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

  const [showQuickVerses, setShowQuickVerses] = useState(false)
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

  const activeTranslationAbbrev = useMemo(
    () =>
      translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "KJV",
    [translations, activeTranslationId]
  )

  // ── Routing heuristic ────────────────────────────────────────────────────────
  // Derive autocomplete result during render (no setState cascading).
  const autocompleteResult = useMemo(
    () => getAutocompleteSuggestion(unifiedQuery, books),
    [unifiedQuery, books]
  )
  const quickSuggestion = autocompleteResult.suggestion

  /**
   * "reference" when the query is empty (browse chapter) OR when it parses
   * as a Bible book/chapter/verse reference (stage !== "none").
   * "text" when the query has content that doesn't match any book reference —
   * routes to semantic / Fuse full-text search.
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

  // Load chapter when book + chapter are set
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

  // After chapter reloads (e.g. translation change), re-select by verse number
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
          document
            .getElementById(`bb-verse-${target.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
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

  // Arrow key chapter/verse navigation (reference mode only)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        if (chapter > 1) {
          setChapter((c) => c - 1)
          setSelectedVerseId(null)
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setChapter((c) => c + 1)
        setSelectedVerseId(null)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (currentChapter.length === 0) return
        const currentIdx = effectiveSelectedVerseId
          ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
          : -1
        const nextIdx = Math.min(currentIdx + 1, currentChapter.length - 1)
        const next = currentChapter[nextIdx]
        if (next) {
          setSelectedVerseId(next.id)
          bibleActions.selectVerse(next)
          document
            .getElementById(`bb-verse-${next.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        if (currentChapter.length === 0) return
        const currentIdx = effectiveSelectedVerseId
          ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
          : currentChapter.length
        const prevIdx = Math.max(currentIdx - 1, 0)
        const prev = currentChapter[prevIdx]
        if (prev) {
          setSelectedVerseId(prev.id)
          bibleActions.selectVerse(prev)
          document
            .getElementById(`bb-verse-${prev.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }
      }
    },
    [chapter, currentChapter, effectiveSelectedVerseId]
  )

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
      // Switched to reference mode or query too short — discard stale results
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
        setShowQuickVerses(true)
      }).catch(console.error)
    }
  }, [autocompleteResult, activeTranslationId])

  const shouldShowVerseDropdown =
    searchMode === "reference" &&
    showQuickVerses &&
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
      setShowQuickVerses(false)
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setUnifiedQuery("")
      setShowQuickVerses(false)
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
    setShowQuickVerses(false)
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

  // ── Subtle mode indicator icon (no toggle — just visual feedback) ─────────────
  const modeIcon = searchMode === "reference"
    ? <BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors" />
    : <SparklesIcon className="size-3.5 shrink-0 text-lime-400/80 transition-colors" />

  return (
    <div
      ref={panelRef}
      data-slot="bible-browser"
      className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
      onKeyDown={searchMode === "reference" ? handleKeyDown : undefined}
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
          {shouldShowVerseDropdown && quickVersesList.length > 0 && (
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

      {/* REFERENCE MODE — chapter header + verse list ─────────────────────────── */}
      {searchMode === "reference" && (
        <>
          {/* STICKY: Chapter title + prev/next nav */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 min-h-9">
            {selectedBook && (
              <h3 className="text-sm font-semibold text-foreground">
                {selectedBook.name} {chapter}
              </h3>
            )}
            {selectedBook && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    if (chapter > 1) {
                      setChapter((c) => c - 1)
                      setSelectedVerseId(null)
                    }
                  }}
                  disabled={chapter <= 1}
                >
                  <ArrowLeftIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setChapter((c) => c + 1)
                    setSelectedVerseId(null)
                  }}
                >
                  <ArrowRightIcon className="size-3" />
                </Button>
              </div>
            )}
          </div>

          {/* SCROLLABLE: Verse list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-0 p-2">
              {currentChapter.map((verse) => (
                <div
                  key={verse.id}
                  id={`bb-verse-${verse.id}`}
                  onClick={() => handleVerseClick(verse)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors",
                    verse.id === effectiveSelectedVerseId
                      ? "border border-lime-500/50 bg-lime-500/10"
                      : "border border-transparent hover:bg-muted/50"
                  )}
                >
                  <span className="w-6 shrink-0 text-right text-sm font-semibold text-primary">
                    {verse.verse}
                  </span>
                  <p className="flex-1 text-sm leading-relaxed text-foreground/80">
                    {verse.text}
                  </p>
                  {queuedVerseKeys.has(`${verse.book_number}:${verse.chapter}:${verse.verse}`) ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation()
                              const store = useQueueStore.getState()
                              const idx = store.findDuplicate(verse.book_number, verse.chapter, verse.verse)
                              if (idx !== -1) {
                                store.flashItem(store.items[idx].id)
                                document.querySelector(`[data-slot="queue-panel"] [data-queue-idx="${idx}"]`)
                                  ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                              }
                            }}
                          >
                            <CheckIcon className="size-4 text-ai-direct" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left">Already in queue</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className={cn(
                              "shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                              verse.id === effectiveSelectedVerseId
                                ? "hover:bg-lime-500/20 hover:text-lime-500"
                                : "bg-primary/40! text-primary-foreground hover:bg-primary!"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              useQueueStore.getState().addItem(
                                verseToContentItem(verse, activeTranslationAbbrev, { source: "manual" })
                              )
                            }}
                          >
                            <PlusIcon className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Add to queue</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
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
                  const verse: Verse = {
                    id: 0,
                    translation_id: activeTranslationId,
                    book_number: result.book_number,
                    book_name: result.book_name,
                    book_abbreviation: "",
                    chapter: result.chapter,
                    verse: result.verse,
                    text: result.verse_text,
                  }
                  bibleActions.selectVerse(verse)
                  onStage(
                    verseToContentItem(verse, activeTranslationAbbrev, {
                      source: "manual",
                      confidence: result.similarity,
                    })
                  )
                }}
                className="group flex flex-col cursor-pointer gap-1 rounded-lg p-3 transition-colors hover:bg-muted/50 relative"
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
                  <TooltipProvider>
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
                              document.querySelector(`[data-slot="queue-panel"] [data-queue-idx="${dupeIdx}"]`)
                                ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                            }
                          }}
                        >
                          <CheckIcon className="size-4 text-ai-direct" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">Already in queue</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <TooltipProvider>
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
                                {
                                  id: 0,
                                  translation_id: activeTranslationId,
                                  book_number: result.book_number,
                                  book_name: result.book_name,
                                  book_abbreviation: "",
                                  chapter: result.chapter,
                                  verse: result.verse,
                                  text: result.verse_text,
                                },
                                activeTranslationAbbrev,
                                { source: "manual", confidence: result.similarity }
                              )
                            )
                          }}
                        >
                          <PlusIcon className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Add to queue</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
