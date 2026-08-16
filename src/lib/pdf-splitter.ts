import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';
import { distance as levenshteinDist } from 'fastest-levenshtein';

export interface SplitPage {
  /** Sanitised filename (e.g. "John_Doe.pdf") */
  filename: string;
  /** Raw PDF bytes for this single-page document */
  buffer: Buffer;
  /** Extracted certificant name for this page */
  matchedName?: string;
  /** Extracted text preview */
  textPreview?: string;
}

export interface RecipientCandidate {
  id?: string;
  name: string;
  email?: string;
  extraData?: Record<string, string>;
}

const TITLE_REGEX = /^(?:mr|mrs|ms|miss|dr|prof|professor|shri|smt|er|rev|mx)\.?\s+/i;
const SUFFIX_REGEX = /\s+(?:md|phd|msc|bsc|btech|mtech|mba|jr|sr|ii|iii)\.?$/i;

/**
 * Normalises a string for fuzzy/substring comparison:
 * lowercases, strips non-alphanumerics, collapses spaces.
 */
function normalise(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips all whitespace and non-alphanumeric characters.
 * Useful for handling spaced-out kerning (e.g. "J O H N  D O E").
 */
function stripAllSpaces(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
}

/**
 * Calculates a sliding-window fuzzy similarity of candidate words across page lines.
 */
function getFuzzyWindowSimilarity(pageLines: string[], candidateNorm: string): number {
  const candidateWords = candidateNorm.split(' ').filter((w) => w.length > 0);
  const wordCount = candidateWords.length;
  if (wordCount === 0) return 0;

  let bestSim = 0;

  for (const line of pageLines) {
    const lineWords = line.split(' ').filter((w) => w.length > 0);
    if (lineWords.length === 0) continue;

    if (lineWords.length <= wordCount) {
      const lineStr = lineWords.join(' ');
      const dist = levenshteinDist(lineStr, candidateNorm);
      const maxLen = Math.max(lineStr.length, candidateNorm.length);
      if (maxLen > 0) {
        const sim = (maxLen - dist) / maxLen;
        if (sim > bestSim) bestSim = sim;
      }
      continue;
    }

    // Sliding window of words
    for (let i = 0; i <= lineWords.length - wordCount; i++) {
      const windowStr = lineWords.slice(i, i + wordCount).join(' ');
      const dist = levenshteinDist(windowStr, candidateNorm);
      const maxLen = Math.max(windowStr.length, candidateNorm.length);
      if (maxLen > 0) {
        const sim = (maxLen - dist) / maxLen;
        if (sim > bestSim) bestSim = sim;
      }
    }
  }

  return bestSim;
}

/**
 * Computes a comprehensive match score (0 to 2000) between a page text and a candidate recipient.
 */
function scoreCandidate(
  pageText: string,
  pageLinesNorm: string[],
  candidate: RecipientCandidate,
): number {
  if (!pageText || !candidate.name) return 0;

  const normPage = normalise(pageText);
  const compactPage = stripAllSpaces(pageText);

  const rawName = candidate.name.trim();
  const normName = normalise(rawName);
  const compactName = stripAllSpaces(rawName);

  const cleanName = rawName.replace(TITLE_REGEX, '').replace(SUFFIX_REGEX, '').trim();
  const normCleanName = normalise(cleanName);
  const compactCleanName = stripAllSpaces(cleanName);

  let bestScore = 0;

  // 1. Direct exact normalized substring match
  if (normName.length >= 3 && normPage.includes(normName)) {
    bestScore = Math.max(bestScore, 1200 + normName.length * 10);
  }

  // 2. Compact / kerning-stripped match (e.g. "J O H N  D O E")
  if (compactName.length >= 4 && compactPage.includes(compactName)) {
    bestScore = Math.max(bestScore, 1100 + compactName.length * 10);
  }

  // 3. Title/suffix stripped matches (e.g. "Dr. John Doe" vs "John Doe")
  if (normCleanName.length >= 3 && normPage.includes(normCleanName)) {
    bestScore = Math.max(bestScore, 1050 + normCleanName.length * 10);
  }
  if (compactCleanName.length >= 4 && compactPage.includes(compactCleanName)) {
    bestScore = Math.max(bestScore, 1000 + compactCleanName.length * 10);
  }

  // 4. Token overlap match (all words present, even if order is inverted, e.g. "Macharla Nithya" vs "Nithya Macharla")
  const tokens = normName.split(' ').filter((t) => t.length >= 2);
  if (tokens.length >= 2) {
    const allTokensPresent = tokens.every((t) => normPage.includes(t) || compactPage.includes(t));
    if (allTokensPresent) {
      bestScore = Math.max(bestScore, 950 + tokens.length * 20);
    }
  }

  // 5. Email matching (if certificate contains email)
  if (candidate.email && candidate.email.trim().length >= 5) {
    const normEmail = candidate.email.trim().toLowerCase();
    if (normPage.includes(normEmail) || compactPage.includes(stripAllSpaces(normEmail))) {
      bestScore = Math.max(bestScore, 1300);
    }
  }

  // 6. ExtraData fields matching (e.g. Roll No, ID, Cert No)
  if (candidate.extraData) {
    for (const val of Object.values(candidate.extraData)) {
      if (val && typeof val === 'string' && val.trim().length >= 4) {
        const normVal = normalise(val);
        if (normVal.length >= 4 && normPage.includes(normVal)) {
          bestScore = Math.max(bestScore, 900);
        }
      }
    }
  }

  // 7. Sliding-window fuzzy Levenshtein match (handles OCR errors / minor typos)
  if (normName.length >= 4) {
    const sim = getFuzzyWindowSimilarity(pageLinesNorm, normName);
    if (sim >= 0.82) {
      const fuzzyScore = 800 + Math.round(sim * 200);
      bestScore = Math.max(bestScore, fuzzyScore);
    }
  }

  return bestScore;
}

/**
 * Directly extracts a certificant's name from standard certificate layout patterns.
 * (e.g. lines after "presented to", "awarded to", "certify that", etc.)
 */
function extractNameFromCertificatePattern(pageText: string): string | null {
  const lines = pageText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const pattern = /\b(?:presented\s+to|awarded\s+to|certify\s+that|certifies\s+that|granted\s+to|conferred\s+upon|in\s+recognition\s+of|honors?)\b/i;

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      // Check if the name is on the same line after the trigger phrase
      const after = lines[i]
        .replace(/.*?\b(?:presented\s+to|awarded\s+to|certify\s+that|certifies\s+that|granted\s+to|conferred\s+upon|in\s+recognition\s+of|honors?)\s*[:\s]*/i, '')
        .trim();

      if (after.length >= 2 && after.split(' ').length <= 6 && !/^(?:for|in|on|with|date|at|from)\b/i.test(after)) {
        return after;
      }

      // Check next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine.length >= 2 &&
          nextLine.split(' ').length <= 6 &&
          !/^(?:for|in|on|with|date|at|from|certificate|successful|participation)\b/i.test(nextLine)
        ) {
          return nextLine;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts per-page text from the full multi-page PDF buffer in one pass.
 * Returns an array of strings, one per page (index-aligned).
 */
async function extractAllPageTexts(pdfBuffer: Buffer): Promise<string[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const result = await extractText(pdf, { mergePages: false });

    if (Array.isArray(result.text)) {
      return result.text;
    } else if (typeof result.text === 'string') {
      return [result.text];
    }
    return [];
  } catch (err: unknown) {
    console.error('[pdf-splitter] extractAllPageTexts error:', err);
    return [];
  }
}

/**
 * Splits a multi-page PDF into individual single-page PDF files.
 *
 * For each page, the function:
 * 1. Uses multi-tier scoring (exact, kerning-stripped, title-stripped, token-set, fuzzy, email)
 *    to find the most accurate recipient match.
 * 2. Falls back to pattern-based direct name extraction if no spreadsheet candidate matches.
 * 3. Sanitises the recipient/extracted name to create a clean, descriptive PDF filename.
 *
 * @returns An array of `SplitPage` objects — one per page.
 *          Returns an empty array when the PDF has only 1 page (no split needed).
 */
export async function splitPdfIntoPages(
  pdfBuffer: Buffer,
  recipientsInput?: Array<RecipientCandidate | string> | string[],
): Promise<SplitPage[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = srcDoc.getPageCount();

  // Single-page PDFs don't need splitting
  if (pageCount <= 1) {
    return [];
  }

  // Convert input to RecipientCandidate objects
  const candidates: RecipientCandidate[] = (recipientsInput || []).map((item) => {
    if (typeof item === 'string') {
      return { name: item };
    }
    return item;
  });

  // Extract text from all pages using unpdf
  const pageTexts = await extractAllPageTexts(pdfBuffer);

  const results: SplitPage[] = [];
  const assignedCandidateIds = new Set<string>();

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);

    const pdfBytes = await newDoc.save();
    const pageBuffer = Buffer.from(pdfBytes);

    const rawPageText = pageTexts[i] || '';
    const pageLinesNorm = rawPageText
      .split(/[\r\n]+/)
      .map((l) => normalise(l))
      .filter((l) => l.length > 0);

    // --- Tiered Candidate Scoring ---
    let bestCandidate: RecipientCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateKey = candidate.id || candidate.name;
      if (assignedCandidateIds.has(candidateKey)) continue;

      const score = scoreCandidate(rawPageText, pageLinesNorm, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    let finalName: string | null = null;

    if (bestCandidate && bestScore >= 500) {
      finalName = bestCandidate.name;
      assignedCandidateIds.add(bestCandidate.id || bestCandidate.name);
    } else {
      // Pattern-based fallback extraction
      const directName = extractNameFromCertificatePattern(rawPageText);
      if (directName) {
        finalName = directName;
      }
    }

    if (!finalName) {
      finalName = `Certificate_Page_${i + 1}`;
    }

    // Sanitise filename: replace non-alphanumeric chars with underscores
    const safeName = finalName.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_');
    const filename = `${safeName}.pdf`;

    results.push({
      filename,
      buffer: pageBuffer,
      matchedName: finalName,
      textPreview: rawPageText.slice(0, 100),
    });
  }

  return results;
}
