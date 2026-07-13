/**
 * Service to split text into semantic chunks with a sliding window overlap.
 * Respects sentence (.) and word boundaries ( ) within a search window.
 */
export class ChunkingService {
  static splitText(text: string, chunkSize = 500, overlap = 100): string[] {
    if (!text || text.trim() === '') return [];

    const chunks: string[] = [];
    const len = text.length;
    let start = 0;

    while (start < len) {
      let end = start + chunkSize;
      if (end >= len) {
        const lastChunk = text.substring(start).trim();
        if (lastChunk.length > 0) {
          chunks.push(lastChunk);
        }
        break;
      }

      // Look for a period or space near the end boundary to split clean
      let boundary = end;
      const windowStart = Math.max(start, end - 60);
      const windowEnd = Math.min(len, end + 20);
      const searchWindow = text.substring(windowStart, windowEnd);

      const lastDot = searchWindow.lastIndexOf('.');
      const lastSpace = searchWindow.lastIndexOf(' ');

      if (lastDot !== -1 && lastDot > 20) {
        boundary = windowStart + lastDot + 1; // Split after period
      } else if (lastSpace !== -1) {
        boundary = windowStart + lastSpace; // Split on word boundary
      }

      const chunk = text.substring(start, boundary).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Shift starting point by overlap, preventing infinite loop
      const nextStart = boundary - overlap;
      if (nextStart <= start) {
        start = boundary;
      } else {
        start = nextStart;
      }
    }

    return chunks;
  }
}
