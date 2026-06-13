/**
 * data/convert-bible-xml.ts
 * Convert scrollmapper-format Bible XML to the ScrollmapperJSON shape expected
 * by data/build-bible-db.ts.
 *
 * Usage:
 *   bun data/convert-bible-xml.ts <input.xml> <ABBR> ["Full Title"]
 *
 * Output:
 *   data/sources/<ABBR>.json
 *
 * XML format expected:
 *   <bible translation="..." ...>
 *     <testament name="Old|New">
 *       <book number="N">
 *         <chapter number="M">
 *           <verse number="K">text (may contain inline tags)</verse>
 *
 * Book number is canonical 1..66 (Genesis=1 … Revelation=66).
 * Inline tags are stripped; XML entities are decoded. Empty verse text is
 * preserved as-is (some translations intentionally merge verses).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// ---------------------------------------------------------------------------
// Canonical 66 book names in order — keys must match BOOK_ABBREVS in
// build-bible-db.ts exactly so the abbreviation lookup always hits.
// ---------------------------------------------------------------------------
const CANONICAL_BOOKS: readonly string[] = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
  "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter",
  "2 Peter", "1 John", "2 John", "3 John", "Jude",
  "Revelation",
] as const

// ---------------------------------------------------------------------------
// Types (mirrors ScrollmapperJSON in build-bible-db.ts)
// ---------------------------------------------------------------------------
interface VerseEntry {
  verse: number
  text: string
}

interface ChapterEntry {
  chapter: number
  verses: VerseEntry[]
}

interface BookEntry {
  name: string
  chapters: ChapterEntry[]
}

interface ScrollmapperJSON {
  translation: { name: string; abbreviation: string }
  books: BookEntry[]
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)))
}

/** Remove any XML/HTML inline tags that may appear inside verse content. */
function stripInlineTags(text: string): string {
  return text.replace(/<[^>]+>/g, "")
}

function cleanVerseText(raw: string): string {
  return decodeXmlEntities(stripInlineTags(raw)).trim()
}

// ---------------------------------------------------------------------------
// Parser — string-split approach avoids regex backtracking on large XML files
// ---------------------------------------------------------------------------
function parseBooks(xmlContent: string): Map<number, ChapterEntry[]> {
  const books = new Map<number, ChapterEntry[]>()

  // Split on every <book number= boundary; element [0] is the preamble.
  const bookChunks = xmlContent.split("<book number=")

  for (let bi = 1; bi < bookChunks.length; bi++) {
    const bChunk = bookChunks[bi]

    // Extract the book number from the opening attribute, e.g. "3">
    const bNumMatch = /^"(\d+)"/.exec(bChunk)
    if (!bNumMatch) continue
    const bookNum = parseInt(bNumMatch[1], 10)

    if (bookNum < 1 || bookNum > 66) {
      console.warn(`  WARNING: book number ${bookNum} is outside 1-66, skipping`)
      continue
    }

    // Isolate book body (stop at </book>)
    const bCloseIdx = bChunk.indexOf("</book>")
    const bBody = bCloseIdx >= 0 ? bChunk.substring(0, bCloseIdx) : bChunk

    // Parse chapters
    const chapters: ChapterEntry[] = []
    const chapterChunks = bBody.split("<chapter number=")

    for (let ci = 1; ci < chapterChunks.length; ci++) {
      const cChunk = chapterChunks[ci]

      const cNumMatch = /^"(\d+)"/.exec(cChunk)
      if (!cNumMatch) continue
      const chapterNum = parseInt(cNumMatch[1], 10)

      const cCloseIdx = cChunk.indexOf("</chapter>")
      const cBody = cCloseIdx >= 0 ? cChunk.substring(0, cCloseIdx) : cChunk

      // Parse verses
      const verses: VerseEntry[] = []
      const verseChunks = cBody.split("<verse number=")

      for (let vi = 1; vi < verseChunks.length; vi++) {
        const vChunk = verseChunks[vi]

        // Match: "K">  (attribute value + closing >)
        const vNumMatch = /^"(\d+)"[^>]*>/.exec(vChunk)
        if (!vNumMatch) continue
        const verseNum = parseInt(vNumMatch[1], 10)

        const openEnd = vChunk.indexOf(">")
        const closeStart = vChunk.indexOf("</verse>")
        const rawText =
          openEnd >= 0 && closeStart > openEnd
            ? vChunk.substring(openEnd + 1, closeStart)
            : ""

        verses.push({ verse: verseNum, text: cleanVerseText(rawText) })
      }

      chapters.push({ chapter: chapterNum, verses })
    }

    books.set(bookNum, chapters)
  }

  return books
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error("Usage: bun data/convert-bible-xml.ts <input.xml> <ABBR> [\"Full Title\"]")
    process.exit(1)
  }

  const inputPath = args[0]
  const abbreviation = args[1]
  const fullTitle = args[2] ?? abbreviation

  console.log(`\nConverting: ${inputPath}`)
  console.log(`  Abbreviation : ${abbreviation}`)
  console.log(`  Title        : ${fullTitle}`)

  if (!existsSync(inputPath)) {
    console.error(`  ERROR: Input file not found: ${inputPath}`)
    process.exit(1)
  }

  // Read, strip BOM if present
  const raw = readFileSync(inputPath, "utf-8")
  const xmlContent = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw

  // Extract translation name from the <bible> root element
  const transAttrMatch = /<bible\s[^>]*translation="([^"]*)"/.exec(xmlContent)
  const xmlTranslationName = transAttrMatch ? transAttrMatch[1] : fullTitle

  // Parse
  const bookMap = parseBooks(xmlContent)

  // Validate book count
  const foundCount = bookMap.size
  if (foundCount !== 66) {
    console.warn(`  WARNING: expected 66 canonical books, found ${foundCount}`)
    const missing: number[] = []
    for (let i = 1; i <= 66; i++) {
      if (!bookMap.has(i)) missing.push(i)
    }
    if (missing.length > 0) {
      console.warn(`  WARNING: missing book numbers: ${missing.join(", ")}`)
    }
    const extra = [...bookMap.keys()].filter((n) => n < 1 || n > 66)
    if (extra.length > 0) {
      console.warn(`  WARNING: out-of-range book numbers ignored: ${extra.join(", ")}`)
    }
  }

  // Build canonical 66-entry books array
  const books: BookEntry[] = []
  let totalVerses = 0

  for (let i = 0; i < 66; i++) {
    const bookNum = i + 1
    const chapters = bookMap.get(bookNum) ?? []

    let bookVerses = 0
    for (const ch of chapters) bookVerses += ch.verses.length
    totalVerses += bookVerses

    books.push({ name: CANONICAL_BOOKS[i] as string, chapters })
  }

  // Resolve display name: prefer caller-supplied title, fall back to XML attr
  const displayName = args[2] !== undefined ? fullTitle : xmlTranslationName

  const output: ScrollmapperJSON = {
    translation: { name: displayName, abbreviation },
    books,
  }

  // Ensure sources dir exists
  const sourcesDir = join(import.meta.dir, "sources")
  if (!existsSync(sourcesDir)) mkdirSync(sourcesDir, { recursive: true })

  const outputPath = join(sourcesDir, `${abbreviation}.json`)
  writeFileSync(outputPath, JSON.stringify(output), "utf-8")

  console.log(`  Books  : ${foundCount} in XML  →  66 canonical slots`)
  console.log(`  Verses : ${totalVerses.toLocaleString()} total`)
  console.log(`  Output : ${outputPath}\n`)
}

main()
