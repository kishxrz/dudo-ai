import zlib from 'zlib';

/**
 * Service to extract and normalize text from PDF, DOCX, TXT, MD, and URLs.
 */
export class TextExtractionService {
  /**
   * Main entry point to extract text from a base64 string or raw content.
   */
  static extractText(
    base64OrText: string,
    type: 'pdf' | 'docx' | 'txt' | 'md' | 'url' | 'faq'
  ): string {
    if (!base64OrText) return '';

    try {
      switch (type) {
        case 'txt':
        case 'md':
          // TXT and MD are stored directly as base64 or plaintext
          return this.decodeBase64IfNeeded(base64OrText);

        case 'pdf':
          return this.extractFromPDF(base64OrText);

        case 'docx':
          return this.extractFromDocx(base64OrText);

        case 'url':
        case 'faq':
          // These are already text/JSON formats
          return base64OrText.trim();

        default:
          return base64OrText.trim();
      }
    } catch (e) {
      console.error(`[TextExtractionService] Extraction failed for type ${type}:`, e);
      return '';
    }
  }

  private static decodeBase64IfNeeded(str: string): string {
    if (this.isBase64(str)) {
      return Buffer.from(str, 'base64').toString('utf8');
    }
    return str;
  }

  private static isBase64(str: string): boolean {
    if (!str || str.length % 4 !== 0) return false;
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    return base64Regex.test(str);
  }

  private static decodeASCII85(str: string): Buffer {
    let cleaned = str.replace(/\s/g, '');
    if (cleaned.endsWith('~>')) {
      cleaned = cleaned.slice(0, -2);
    }
    
    const bytes: number[] = [];
    let i = 0;
    
    while (i < cleaned.length) {
      const c = cleaned[i];
      if (c === 'z') {
        bytes.push(0, 0, 0, 0);
        i++;
        continue;
      }
      
      const block: number[] = [];
      let count = 0;
      while (count < 5 && i < cleaned.length) {
        const code = cleaned.charCodeAt(i);
        if (code >= 33 && code <= 117) {
          block.push(code - 33);
          count++;
        }
        i++;
      }
      
      if (count > 0) {
        while (block.length < 5) {
          block.push(84);
        }
        
        let value = 0;
        for (let j = 0; j < 5; j++) {
          value = value * 85 + block[j];
        }
        
        const b1 = (value >> 24) & 0xff;
        const b2 = (value >> 16) & 0xff;
        const b3 = (value >> 8) & 0xff;
        const b4 = value & 0xff;
        
        if (count >= 2) bytes.push(b1);
        if (count >= 3) bytes.push(b2);
        if (count >= 4) bytes.push(b3);
        if (count >= 5) bytes.push(b4);
      }
    }
    
    return Buffer.from(bytes);
  }

  /**
   * PDF Parsing via binary character grouping and octal normalization.
   * Handles /FlateDecode and /ASCII85Decode streams recursively.
   */
  private static extractFromPDF(base64Str: string): string {
    const buffer = Buffer.from(base64Str, 'base64');
    let textContent = '';
    let pos = 0;
    
    while (true) {
      const streamIdx = buffer.indexOf('stream', pos);
      if (streamIdx === -1) break;
      
      const endStreamIdx = buffer.indexOf('endstream', streamIdx);
      if (endStreamIdx === -1) break;
      
      let start = streamIdx + 6;
      if (buffer[start] === 0x0d) start++;
      if (buffer[start] === 0x0a) start++;
      
      let end = endStreamIdx;
      if (buffer[end - 1] === 0x0a) end--;
      if (buffer[end - 1] === 0x0d) end--;
      
      const streamData = buffer.subarray(start, end);
      const prefix = buffer.subarray(Math.max(0, streamIdx - 200), streamIdx).toString('ascii');
      
      const isASCII85 = prefix.includes('/ASCII85Decode');
      const isFlate = prefix.includes('/FlateDecode') || prefix.includes('/Flate');
      
      try {
        let data: Buffer = Buffer.from(streamData);
        if (isASCII85) {
          data = this.decodeASCII85(streamData.toString('ascii'));
        }
        
        if (isFlate) {
          let decompressed: Buffer;
          try {
            decompressed = zlib.inflateSync(data);
          } catch {
            decompressed = zlib.inflateRawSync(data);
          }
          const text = decompressed.toString('utf8');
          
          const matches = text.match(/\(([^)]+)\)/g);
          if (matches) {
            const chunk = matches.map(m => m.slice(1, -1)).join(' ');
            textContent += chunk + '\n';
          }
        } else {
          const matches = data.toString('ascii').match(/\(([^)]+)\)/g);
          if (matches) {
            textContent += matches.map(m => m.slice(1, -1)).join(' ') + '\n';
          }
        }
      } catch (e) {
        console.warn('[TextExtractionService] PDF stream processing warning:', e);
      }
      
      pos = endStreamIdx + 9;
    }
    
    // Clean up escapes in PDF strings
    textContent = textContent.replace(/\\(\d{3})/g, (_, octal) => {
      return String.fromCharCode(parseInt(octal, 8));
    });
    textContent = textContent.replace(/\\(.)/g, '$1');
    
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    if (cleanText) return cleanText;
    
    // Final fallback to raw ASCII replacement if streams yielded no text
    return buffer.toString('binary').replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * DOCX Parsing via structural ASCII text scanning and header filtering.
   */
  private static extractFromDocx(base64Str: string): string {
    const buffer = Buffer.from(base64Str, 'base64');
    const ascii = buffer.toString('ascii');
    // Regex matches sequences of readable English characters of length >= 4
    const matches = ascii.match(/[A-Za-z0-9\s.,!?:;@()'-]{4,}/g);
    if (matches) {
      return matches.join(' ')
        .replace(/word\/[a-zA-Z._]+/g, '')
        .replace(/\[Content_Types\]/g, '')
        .replace(/_rels\/\.rels/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return ascii.replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  }
}
