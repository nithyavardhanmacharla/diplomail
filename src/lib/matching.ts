import { RecipientRow, PdfFileInfo, MatchedRecipient, MatchStatus } from './types';

/**
 * Normalizes a string for matching by removing extension, converting underscores/hyphens/dots
 * to spaces, lowercasing, and stripping special characters.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/\.zip$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Computes a similarity score between 0.0 and 1.0.
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeString(s1);
  const norm2 = normalizeString(s2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Check if one is a clean substring of the other (e.g., "John Doe" in "John Doe Certificate")
  if (norm2.includes(norm1) || norm1.includes(norm2)) {
    const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    return Math.max(0.88, ratio);
  }

  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  
  if (maxLength === 0) return 1.0;
  
  return Math.max(0, (maxLength - distance) / maxLength);
}

/**
 * Matches a list of recipient rows against uploaded PDF files.
 */
export function matchRecipientsToPdfs(
  recipients: RecipientRow[],
  pdfs: PdfFileInfo[]
): MatchedRecipient[] {
  const usedPdfIds = new Set<string>();

  return recipients.map((recipient) => {
    let bestPdf: PdfFileInfo | null = null;
    let bestScore = 0;

    for (const pdf of pdfs) {
      const score = calculateSimilarity(recipient.name, pdf.originalName);

      if (score > bestScore) {
        bestScore = score;
        bestPdf = pdf;
      }
    }

    let status: MatchStatus = 'UNMATCHED';
    let matchedPdfId: string | null = null;
    let matchedPdfName: string | null = null;

    if (bestPdf && bestScore >= 0.50) {
      matchedPdfId = bestPdf.id;
      matchedPdfName = bestPdf.originalName;
      usedPdfIds.add(bestPdf.id);

      if (bestScore >= 0.88) {
        status = 'MATCHED_EXACT';
      } else {
        status = 'MATCHED_FUZZY';
      }
    }

    return {
      id: recipient.id,
      recipient,
      matchedPdfId,
      matchedPdfName,
      status,
      confidenceScore: Math.round(bestScore * 100) / 100,
      sendStatus: 'PENDING',
    };
  });
}
