import zlib from 'zlib';

/**
 * Service to extract and normalize text from PDF, DOCX, TXT, MD, CSV, Excel, PowerPoint, and URLs.
 */
export class TextExtractionService {
  /**
   * Main entry point to extract text from a base64 string or raw content.
   */
  static extractText(
    base64OrText: string,
    type: 'pdf' | 'docx' | 'txt' | 'md' | 'url' | 'faq' | 'csv' | 'xlsx' | 'xls' | 'pptx' | 'ppt'
  ): string {
    if (!base64OrText) return '';

    try {
      switch (type) {
        case 'txt':
        case 'md':
          return this.decodeBase64IfNeeded(base64OrText);

        case 'pdf':
          return this.extractFromPDF(base64OrText);

        case 'docx':
          return this.extractFromDocx(base64OrText);

        case 'csv':
          return this.extractFromCSV(base64OrText);

        case 'xlsx':
        case 'xls':
          return this.extractFromXlsx(base64OrText);

        case 'pptx':
        case 'ppt':
          return this.extractFromPptx(base64OrText);

        case 'url':
        case 'faq':
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
            decompressed = zlib.inflateSync(data, { maxOutputLength: 10 * 1024 * 1024 });
          } catch {
            decompressed = zlib.inflateRawSync(data, { maxOutputLength: 10 * 1024 * 1024 });
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
    
    textContent = textContent.replace(/\\(\d{3})/g, (_, octal) => {
      return String.fromCharCode(parseInt(octal, 8));
    });
    textContent = textContent.replace(/\\(.)/g, '$1');
    
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    if (cleanText) return cleanText;
    
    return buffer.toString('binary').replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  }

  private static extractFromDocx(base64Str: string): string {
    try {
      const buffer = Buffer.from(base64Str, 'base64');
      const files = this.unzip(buffer);
      const documentXml = files['word/document.xml'];
      if (documentXml) {
        const textMatches = documentXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
        if (textMatches) {
          const text = textMatches.map(m => this.decodeXmlEntities(m.slice(m.indexOf('>') + 1, -6))).join(' ');
          if (text.trim()) return text.trim();
        }
      }
    } catch (e) {
      console.warn('[TextExtractionService] Docx unzipping failed, falling back to structural scan:', e);
    }

    const buffer = Buffer.from(base64Str, 'base64');
    const ascii = buffer.toString('ascii');
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

  private static extractFromCSV(base64Str: string): string {
    const csvContent = this.decodeBase64IfNeeded(base64Str);
    return csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  private static extractFromXlsx(base64Str: string): string {
    try {
      const buffer = Buffer.from(base64Str, 'base64');
      const files = this.unzip(buffer);
      let sheetText = '';

      let sharedStrings: string[] = [];
      const sharedStringsXml = files['xl/sharedStrings.xml'];
      if (sharedStringsXml) {
        const stringMatches = sharedStringsXml.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
        if (stringMatches) {
          sharedStrings = stringMatches.map(m => this.decodeXmlEntities(m.slice(m.indexOf('>') + 1, -4)));
        }
      }

      const sheets = Object.keys(files).filter(k => k.startsWith('xl/worksheets/sheet'));
      for (const sheet of sheets) {
        const sheetXml = files[sheet];
        if (sheetXml) {
          const rowMatches = sheetXml.match(/<row[^>]*>([\s\S]*?)<\/row>/g);
          if (rowMatches) {
            for (const row of rowMatches) {
              const cellMatches = row.match(/<c[^>]*>([\s\S]*?)<\/c>/g);
              if (cellMatches) {
                const rowValues = cellMatches.map(cell => {
                  const typeMatch = cell.match(/t="([^"]+)"/);
                  const valMatch = cell.match(/<v>(.*?)<\/v>/);
                  const val = valMatch ? valMatch[1] : '';
                  if (typeMatch && typeMatch[1] === 's') {
                    const idx = parseInt(val, 10);
                    return sharedStrings[idx] || '';
                  }
                  return val;
                }).filter(v => v !== '').join('\t');
                if (rowValues) sheetText += rowValues + '\n';
              }
            }
          }
        }
      }
      
      if (sheetText.trim()) return sheetText.trim();
    } catch (e) {
      console.warn('[TextExtractionService] Excel parsing failed, falling back:', e);
    }

    const raw = Buffer.from(base64Str, 'base64').toString('ascii');
    return raw.replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  }

  private static extractFromPptx(base64Str: string): string {
    try {
      const buffer = Buffer.from(base64Str, 'base64');
      const files = this.unzip(buffer);
      let pptxText = '';

      const slides = Object.keys(files).filter(k => k.startsWith('ppt/slides/slide')).sort();
      for (const slide of slides) {
        const slideXml = files[slide];
        if (slideXml) {
          const textMatches = slideXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches.map(m => this.decodeXmlEntities(m.slice(m.indexOf('>') + 1, -6))).join(' ');
            if (slideText.trim()) {
              pptxText += `[Slide ${slide.match(/\d+/)?.[0] || ''}]: ${slideText.trim()}\n`;
            }
          }
        }
      }

      if (pptxText.trim()) return pptxText.trim();
    } catch (e) {
      console.warn('[TextExtractionService] PowerPoint parsing failed, falling back:', e);
    }

    const raw = Buffer.from(base64Str, 'base64').toString('ascii');
    return raw.replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  }

  private static decodeXmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private static unzip(buffer: Buffer): Record<string, string> {
    const files: Record<string, string> = {};
    let offset = 0;
    while (offset < buffer.length) {
      if (offset + 30 > buffer.length) break;
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) {
        break;
      }
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      if (offset + 30 + nameLen > buffer.length) break;
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;
      if (dataStart + compressedSize > buffer.length) break;
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
      
      if (compression === 8) {
        try {
          const decompressed = zlib.inflateRawSync(compressedData, { maxOutputLength: 10 * 1024 * 1024 });
          files[fileName] = decompressed.toString('utf8');
        } catch {
          // Decompression error
        }
      } else if (compression === 0) {
        files[fileName] = compressedData.toString('utf8');
      }
      
      offset = dataStart + compressedSize;
    }
    return files;
  }
}
