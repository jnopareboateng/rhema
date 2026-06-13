/**
 * DEV-ONLY: Bible command bridge for browser-based dev/test sessions.
 *
 * Opens data/rhema.db via bun:sqlite and serves Tauri-compatible Bible command
 * responses over HTTP so Playwright E2E tests can run without a Tauri backend.
 *
 * Usage:  bun scripts/dev-bible-bridge.ts
 *
 * NOT built into the production bundle — this file lives in scripts/ which is
 * excluded from tsconfig.app.json and never imported by src/.
 */
import { Database } from "bun:sqlite"

/** Port shared with the browser-side shim (src/dev/tauri-bridge.ts). */
export const DEV_BRIDGE_PORT = 8765

const DB_PATH = new URL("../data/rhema.db", import.meta.url).pathname
const db = new Database(DB_PATH, { readonly: true })

// ── helpers ──────────────────────────────────────────────────────────────────

type Args = Record<string, unknown>

/**
 * Wrap a user query in FTS5 phrase-search double-quotes.
 * Strips embedded double-quotes to prevent FTS5 syntax errors.
 */
function fts5Phrase(query: string): string {
  const cleaned = query.replace(/"/g, "'").trim()
  return `"${cleaned}"`
}

// ── command handlers ─────────────────────────────────────────────────────────

function listTranslations(): unknown[] {
  type Row = {
    id: number
    abbreviation: string
    title: string
    language: string
    is_copyrighted: number
    is_downloaded: number
  }
  const rows = db
    .query<Row, []>(
      "SELECT id, abbreviation, title, language, is_copyrighted, is_downloaded FROM translations"
    )
    .all()
  // SQLite stores booleans as integers; convert to JS booleans to match Translation shape.
  return rows.map((row) => ({
    ...row,
    is_copyrighted: Boolean(row.is_copyrighted),
    is_downloaded: Boolean(row.is_downloaded),
  }))
}

function listBooks(args: Args): unknown {
  const translationId = args.translationId as number
  return db
    .query(
      "SELECT id, translation_id, book_number, name, abbreviation, testament FROM books WHERE translation_id = ? ORDER BY book_number"
    )
    .all(translationId)
}

function getChapter(args: Args): unknown {
  const translationId = args.translationId as number
  const bookNumber = args.bookNumber as number
  const chapter = args.chapter as number
  return db
    .query(
      "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? ORDER BY verse"
    )
    .all(translationId, bookNumber, chapter)
}

function getVerse(args: Args): unknown {
  const translationId = args.translationId as number
  const bookNumber = args.bookNumber as number
  const chapter = args.chapter as number
  const verse = args.verse as number
  return (
    db
      .query(
        "SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text FROM verses WHERE translation_id = ? AND book_number = ? AND chapter = ? AND verse = ?"
      )
      .get(translationId, bookNumber, chapter, verse) ?? null
  )
}

function searchVerses(args: Args): unknown {
  const query = args.query as string
  const translationId = args.translationId as number
  const limit = (args.limit as number) ?? 20
  try {
    return db
      .query(
        `SELECT v.id, v.translation_id, v.book_number, v.book_name, v.book_abbreviation, v.chapter, v.verse, v.text
         FROM verses_fts fts
         JOIN verses v ON v.rowid = fts.rowid
         WHERE fts.text MATCH ? AND v.translation_id = ?
         LIMIT ?`
      )
      .all(fts5Phrase(query), translationId, limit)
  } catch {
    // FTS5 fallback: LIKE scan (slower but safe)
    return db
      .query(
        `SELECT id, translation_id, book_number, book_name, book_abbreviation, chapter, verse, text
         FROM verses
         WHERE translation_id = ? AND text LIKE ?
         LIMIT ?`
      )
      .all(translationId, `%${query}%`, limit)
  }
}

/**
 * DEV APPROXIMATION: semantic_search falls back to FTS5 BM25 across English
 * translations because ONNX vector embeddings are not available outside Tauri.
 * Mirrors the BM25 confidence scoring from detection.rs
 * (rank 0 → 0.75, −0.04/step, floor 0.50). Sufficient for E2E test coverage.
 */
function semanticSearch(args: Args): unknown {
  const query = args.query as string
  const limit = (args.limit as number | undefined) ?? 10
  const fetchLimit = limit * 4

  type FtsRow = {
    rank: number
    book_number: number
    book_name: string
    chapter: number
    verse: number
    text: string
  }

  let rows: FtsRow[] = []
  try {
    rows = db
      .query<FtsRow, [string, number]>(
        `SELECT bm25(verses_fts) as rank, v.book_number, v.book_name, v.chapter, v.verse, v.text
         FROM verses_fts fts
         JOIN verses v ON v.rowid = fts.rowid
         JOIN translations t ON v.translation_id = t.id
         WHERE fts.text MATCH ? AND t.language = 'en'
         ORDER BY rank
         LIMIT ?`
      )
      .all(fts5Phrase(query), fetchLimit)
  } catch {
    return []
  }

  // Deduplicate by (book_number, chapter, verse), keep first occurrence (best BM25 rank)
  const seen = new Set<string>()
  const deduped: FtsRow[] = []
  for (const row of rows) {
    const key = `${row.book_number}:${row.chapter}:${row.verse}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(row)
      if (deduped.length >= limit) break
    }
  }

  return deduped.map((row, i) => ({
    verse_ref: `${row.book_name} ${row.chapter}:${row.verse}`,
    verse_text: row.text,
    book_name: row.book_name,
    book_number: row.book_number,
    chapter: row.chapter,
    verse: row.verse,
    // Synthetic similarity from BM25 rank — approximation only
    similarity: Math.max(0.5, 0.75 - i * 0.04),
  }))
}

function getCrossReferences(args: Args): unknown {
  const bookNumber = args.bookNumber as number
  const chapter = args.chapter as number
  const verse = args.verse as number
  // The DB schema stores refs as numeric columns (from_book, from_chapter, …).
  // Build the "book:chapter:verse" string format expected by CrossReference.from_ref/to_ref.
  return db
    .query(
      `SELECT
         CAST(from_book AS TEXT) || ':' || CAST(from_chapter AS TEXT) || ':' || CAST(from_verse AS TEXT) AS from_ref,
         CAST(to_book AS TEXT) || ':' || CAST(to_chapter AS TEXT) || ':' || CAST(to_verse_start AS TEXT) AS to_ref,
         votes
       FROM cross_references
       WHERE from_book = ? AND from_chapter = ? AND from_verse = ?
       ORDER BY votes DESC`
    )
    .all(bookNumber, chapter, verse)
}

// ── dispatch ─────────────────────────────────────────────────────────────────

function dispatch(cmd: string, args: Args): unknown {
  switch (cmd) {
    case "list_translations":
      return listTranslations()
    case "list_books":
      return listBooks(args)
    case "get_chapter":
      return getChapter(args)
    case "get_verse":
      return getVerse(args)
    case "search_verses":
      return searchVerses(args)
    case "semantic_search":
      return semanticSearch(args)
    case "get_cross_references":
      return getCrossReferences(args)
    case "set_active_translation":
      // No persistent state in the dev bridge; acknowledge and move on.
      return null
    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

Bun.serve({
  port: DEV_BRIDGE_PORT,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(req.url)
    if (req.method === "POST" && url.pathname === "/invoke") {
      let body: { cmd: string; args: Args }
      try {
        body = (await req.json()) as { cmd: string; args: Args }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        })
      }

      const { cmd, args } = body
      // Log command name only — never log verse text to keep output clean
      console.log(`[bridge] ${cmd}`)

      try {
        const result = dispatch(cmd, args ?? {})
        return Response.json(result, { headers: CORS_HEADERS })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[bridge] ERROR ${cmd}: ${message}`)
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        })
      }
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`[bridge] Listening on http://localhost:${DEV_BRIDGE_PORT}`)
