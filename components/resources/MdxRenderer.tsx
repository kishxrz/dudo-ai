import React from 'react';
import { Info, Lightbulb, AlertTriangle, Check, ShieldAlert, CheckSquare, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MdxRendererProps {
  content: string;
}

export default function MdxRenderer({ content }: MdxRendererProps) {
  // Simple MDX parser
  // Matches tags: <Introduction>, <Callout>, <Tip>, <Warning>, <Quote>, <ComparisonTable>, <FAQ>, <StepByStep>, <Conclusion>, <Problem>, <HowDudoSolvesIt>, <ArchitectureDiagram>, <PromptExample>, <ProTip>, <BestPractices>, <CommonMistakes>, <SuccessCallout>, <Statistics>, <pre>
  const blocks: React.ReactNode[] = [];
  
  const blockRegex = /<(Introduction|Callout|Tip|Warning|Quote|ComparisonTable|FAQ|StepByStep|Conclusion|Problem|HowDudoSolvesIt|ArchitectureDiagram|PromptExample|ProTip|BestPractices|CommonMistakes|SuccessCallout|Statistics|pre)([^>]*)>([\s\S]*?)<\/\1>/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = blockRegex.exec(content)) !== null) {
    // 1. Add preceding plain text
    const plainText = content.substring(lastIndex, match.index).trim();
    if (plainText) {
      blocks.push(<div key={`plain-${lastIndex}`}>{formatMarkdownText(plainText)}</div>);
    }
    
    const [_, tagName, attrsRaw, innerContentRaw] = match;
    const innerContent = innerContentRaw.trim();
    const attrs = parseAttributes(attrsRaw);
    
    // 2. Add parsed tags
    switch (tagName) {
      case 'pre':
        // Strip code tag wrapper inside pre if present
        let codeContent = innerContent;
        let lang = 'code';
        const codeMatch = innerContent.match(/<code[^>]*className="(?:language-)?([^"]+)"[^>]*>([\s\S]*?)<\/code>/i);
        if (codeMatch) {
          lang = codeMatch[1];
          codeContent = codeMatch[2];
        } else {
          const codeMatchSimple = innerContent.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
          if (codeMatchSimple) {
            codeContent = codeMatchSimple[1];
          }
        }
        blocks.push(
          <div key={`pre-${match.index}`} className="my-8 bg-zinc-50 border border-zinc-150 rounded-lg p-5 space-y-2 select-text">
            <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              <span>{lang} configuration</span>
            </div>
            <pre className="text-[11px] sm:text-xs font-mono text-zinc-700 bg-white p-3.5 rounded-md border border-zinc-200 overflow-x-auto leading-relaxed whitespace-pre">
              {codeContent}
            </pre>
          </div>
        );
        break;

      case 'ArchitectureDiagram':
        blocks.push(
          <div key={`arch-${match.index}`} className="my-12 bg-zinc-50 border border-zinc-150 rounded-lg p-5 overflow-x-auto text-[10px] sm:text-xs font-mono text-zinc-600 leading-relaxed select-none">
            <pre className="whitespace-pre">{innerContent}</pre>
          </div>
        );
        break;

      case 'PromptExample':
        blocks.push(
          <div key={`prompt-${match.index}`} className="my-8 bg-zinc-50 border border-zinc-150 rounded-lg p-5 space-y-2 select-none">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
              SYSTEM PROMPT TEMPLATE
            </div>
            <pre className="text-[11px] sm:text-xs font-mono text-zinc-700 bg-white p-3.5 rounded-md border border-zinc-200 overflow-x-auto leading-relaxed">
              {innerContent}
            </pre>
          </div>
        );
        break;

      case 'ProTip':
        blocks.push(
          <p key={`protip-${match.index}`} className="text-zinc-600 italic my-6 text-xs sm:text-sm leading-relaxed pl-4 border-l-2 border-amber-500/60">
            <span className="font-bold text-zinc-800 not-italic mr-1.5">Note:</span>
            {innerContent}
          </p>
        );
        break;

      case 'BestPractices':
        blocks.push(
          <div key={`best-${match.index}`} className="my-8 space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight uppercase">Best Practices</h4>
            <div className="text-zinc-655 leading-relaxed text-xs sm:text-sm">
              {formatMarkdownText(innerContent)}
            </div>
          </div>
        );
        break;

      case 'CommonMistakes':
        blocks.push(
          <div key={`mistakes-${match.index}`} className="my-8 space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight uppercase">Common Mistakes to Avoid</h4>
            <div className="text-zinc-655 leading-relaxed text-xs sm:text-sm">
              {formatMarkdownText(innerContent)}
            </div>
          </div>
        );
        break;

      case 'SuccessCallout':
        blocks.push(
          <p key={`success-${match.index}`} className="text-zinc-600 italic my-6 text-xs sm:text-sm leading-relaxed pl-4 border-l-2 border-emerald-500/60">
            {innerContent}
          </p>
        );
        break;

      case 'Statistics':
        blocks.push(
          <div key={`stats-${match.index}`} className="my-10 border-b border-zinc-150 overflow-x-auto select-none">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="pb-3 pt-1 font-bold text-zinc-900 w-24">Metric</th>
                  <th className="pb-3 pt-1 font-bold text-zinc-900">Finding</th>
                </tr>
              </thead>
              <tbody>
                {innerContent.split('\n').filter(Boolean).map((line, idx) => {
                  const cleaned = line.replace(/^- /, '').trim();
                  const spaceIdx = cleaned.indexOf(' ');
                  const statVal = spaceIdx > -1 ? cleaned.substring(0, spaceIdx) : cleaned;
                  const statDesc = spaceIdx > -1 ? cleaned.substring(spaceIdx + 1) : '';
                  return (
                    <tr key={idx} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/20">
                      <td className="py-3 font-bold text-[#22577A] align-top pr-4">{statVal}</td>
                      <td className="py-3 text-zinc-600 font-medium leading-relaxed">{statDesc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        break;

      case 'Problem':
        blocks.push(
          <div key={`problem-${match.index}`} className="my-8 space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">The Problem</h3>
            <p className="text-zinc-650 leading-relaxed text-xs sm:text-sm">{innerContent}</p>
          </div>
        );
        break;

      case 'HowDudoSolvesIt':
        blocks.push(
          <p key={`solves-${match.index}`} className="text-zinc-650 my-6 text-xs sm:text-sm leading-relaxed">
            {innerContent}
          </p>
        );
        break;

      case 'Introduction':
        blocks.push(
          <div key={`intro-${match.index}`} className="border-l-2 border-zinc-900 pl-5 py-0.5 my-8 select-none">
            <p className="text-sm sm:text-base font-medium text-zinc-700 leading-relaxed italic">{innerContent}</p>
          </div>
        );
        break;
        
      case 'Callout':
      case 'Tip':
      case 'Warning':
        blocks.push(
          <p key={`callout-${match.index}`} className="text-zinc-600 italic my-6 text-xs sm:text-sm leading-relaxed pl-4 border-l-2 border-zinc-200">
            {innerContent}
          </p>
        );
        break;
        
      case 'Quote':
        blocks.push(
          <div key={`quote-${match.index}`} className="border-l-2 border-zinc-900 pl-5 py-0.5 my-8 select-none">
            <p className="text-sm sm:text-base italic font-medium text-zinc-700 leading-relaxed">"{innerContent}"</p>
          </div>
        );
        break;
        
      case 'FAQ':
        blocks.push(
          <div key={`faq-${match.index}`} className="my-12 border-t border-zinc-100 pt-8 space-y-4">
            <h4 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">Frequently Asked Questions</h4>
            <div className="space-y-4">{formatMarkdownText(innerContent)}</div>
          </div>
        );
        break;
        
      case 'StepByStep':
        blocks.push(
          <div key={`steps-${match.index}`} className="my-12 space-y-4">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-950 uppercase tracking-widest">Implementation Steps</h4>
            <div className="space-y-3">{formatMarkdownText(innerContent)}</div>
          </div>
        );
        break;

      case 'Conclusion':
        blocks.push(
          <div key={`conclusion-${match.index}`} className="border-t border-zinc-100 pt-8 my-12 space-y-2">
            <h4 className="text-sm sm:text-base font-bold text-zinc-900 block tracking-tight">Conclusion</h4>
            <p className="text-xs sm:text-sm text-zinc-650 font-medium leading-relaxed">{innerContent}</p>
          </div>
        );
        break;
        
      case 'ComparisonTable':
        // Try parsing parameters from attributes (rough evaluation helper)
        const headers = attrs.headers ? JSON.parse(attrs.headers) : [];
        const rows = attrs.rows ? JSON.parse(attrs.rows) : [];
        blocks.push(
          <div key={`table-${match.index}`} className="my-10 border-b border-zinc-150 overflow-x-auto select-none">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  {headers.map((h: string, idx: number) => (
                    <th key={idx} className="pb-3 pt-1 font-bold text-zinc-900 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: string[], rIdx: number) => (
                  <tr key={rIdx} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/20">
                    {row.map((cell: string, cIdx: number) => (
                      <td key={cIdx} className="py-3 text-zinc-600 font-medium pr-4 leading-relaxed">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        break;
    }
    
    lastIndex = blockRegex.lastIndex;
  }
  
  // 3. Add any remaining text
  const remainingText = content.substring(lastIndex).trim();
  if (remainingText) {
    blocks.push(<div key={`plain-${lastIndex}`}>{formatMarkdownText(remainingText)}</div>);
  }
  
  return <div className="space-y-4">{blocks}</div>;
}

/**
 * Attribute parser for tags (e.g. headers={["A"]} rows={[["B"]]})
 */
function parseAttributes(attrsRaw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attrsRaw) return result;
  
  // Regex to extract matches like name={JSON_VALUE} or name="STRING_VALUE"
  const matches = attrsRaw.matchAll(/(\w+)\s*=\s*(?:{([\s\S]*?)}|"([^"]*)")/g);
  for (const m of matches) {
    const [_, name, jsonValue, stringValue] = m;
    result[name] = jsonValue !== undefined ? jsonValue.trim() : stringValue;
  }
  
  return result;
}

/**
 * Simple helper to parse bold, italic, and inline code in string and return React nodes
 */
function parseInlineMarkdown(text: string): React.ReactNode {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-zinc-950">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-zinc-800">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-800 font-mono text-[11px] rounded-md">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

/**
 * Markdown text formatter — handles headings, fenced code blocks,
 * ordered/unordered lists, markdown tables, blockquotes, and paragraphs.
 */
function formatMarkdownText(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let currentUnorderedList: React.ReactNode[] = [];
  let currentOrderedList: React.ReactNode[] = [];
  let listKey = 0;

  // Fenced code block state
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let codeKey = 0;

  // Table state
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let tableKey = 0;

  const flushUnorderedList = () => {
    if (currentUnorderedList.length > 0) {
      elements.push(
        <ul key={`ulist-${listKey++}`} className="list-disc list-inside pl-4 space-y-2 my-6 text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
          {currentUnorderedList}
        </ul>
      );
      currentUnorderedList = [];
    }
  };

  const flushOrderedList = () => {
    if (currentOrderedList.length > 0) {
      elements.push(
        <ol key={`olist-${listKey++}`} className="list-decimal list-inside pl-4 space-y-2 my-6 text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
          {currentOrderedList}
        </ol>
      );
      currentOrderedList = [];
    }
  };

  const flushTable = () => {
    if (tableHeaders.length > 0) {
      elements.push(
        <div key={`tbl-${tableKey++}`} className="my-8 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead className="bg-zinc-50">
              <tr>
                {tableHeaders.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 font-bold text-zinc-800 border-b border-zinc-200">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-zinc-600 font-medium leading-relaxed">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const flushCodeBlock = () => {
    if (codeLines.length > 0) {
      const lang = codeLang || 'code';
      const codeContent = codeLines.join('\n');
      elements.push(
        <div key={`cb-${codeKey++}`} className="my-6 rounded-lg border border-zinc-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border-b border-zinc-700">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{lang}</span>
          </div>
          <pre className="text-[11px] sm:text-xs font-mono text-zinc-200 bg-zinc-900 p-4 overflow-x-auto leading-relaxed whitespace-pre">
            {codeContent}
          </pre>
        </div>
      );
      codeLines = [];
      codeLang = '';
      inCodeBlock = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // ── Fenced code block open/close ─────────────────────────────────
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushUnorderedList();
        flushOrderedList();
        flushTable();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim() || 'code';
        codeLines = [];
      } else {
        flushCodeBlock();
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // ── Markdown table rows ──────────────────────────────────────────
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      // Skip separator rows like | --- | --- |
      if (cells.every(c => /^[-: ]+$/.test(c.trim()))) return;
      if (!inTable) {
        flushUnorderedList();
        flushOrderedList();
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) {
      flushUnorderedList();
      flushOrderedList();
      return;
    }

    // ── Heading ID injection support ─────────────────────────────────
    let idAttr: string | undefined = undefined;
    let cleanLine = trimmed;
    const idMatch = trimmed.match(/^(#+)\s+id="([^"]+)"\s+(.+)$/i);
    if (idMatch) {
      idAttr = idMatch[2];
      cleanLine = `${idMatch[1]} ${idMatch[3]}`;
    }

    // ── Headings ─────────────────────────────────────────────────────
    if (cleanLine === '---') {
      flushUnorderedList();
      flushOrderedList();
      elements.push(<hr key={idx} className="border-t border-zinc-200/60 my-10 select-none" />);
    } else if (cleanLine.startsWith('#### ')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <h5 key={idx} id={idAttr} className="text-xs sm:text-sm font-bold text-zinc-900 uppercase tracking-wider mt-10 mb-3">
          {parseInlineMarkdown(cleanLine.slice(5))}
        </h5>
      );
    } else if (cleanLine.startsWith('### ')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <h4 key={idx} id={idAttr} className="text-xs sm:text-sm font-bold text-zinc-900 uppercase tracking-wider mt-14 mb-3">
          {parseInlineMarkdown(cleanLine.slice(4))}
        </h4>
      );
    } else if (cleanLine.startsWith('## ')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <h3 key={idx} id={idAttr} className="text-sm sm:text-base font-extrabold text-zinc-900 mt-20 mb-5">
          {parseInlineMarkdown(cleanLine.slice(3))}
        </h3>
      );
    } else if (cleanLine.startsWith('# ')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <h2 key={idx} id={idAttr} className="text-base sm:text-lg font-black text-zinc-950 mt-24 mb-6">
          {parseInlineMarkdown(cleanLine.slice(2))}
        </h2>
      );

    // ── Unordered list items (- or *) ────────────────────────────────
    } else if (trimmed.startsWith('- ') || (trimmed.startsWith('* ') && !trimmed.startsWith('**'))) {
      flushOrderedList();
      currentUnorderedList.push(
        <li key={`li-${idx}`} className="mb-1.5">{parseInlineMarkdown(trimmed.slice(2))}</li>
      );

    // ── Ordered list items (1. 2. 3.) ────────────────────────────────
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushUnorderedList();
      const itemContent = trimmed.replace(/^\d+\.\s/, '');
      currentOrderedList.push(
        <li key={`oli-${idx}`} className="mb-1.5">{parseInlineMarkdown(itemContent)}</li>
      );

    // ── Blockquotes ──────────────────────────────────────────────────
    } else if (trimmed.startsWith('> ')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <blockquote key={idx} className="pl-4 border-l-2 border-zinc-300 my-4 text-zinc-500 italic text-xs sm:text-sm leading-relaxed">
          {parseInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );

    // ── FAQ Q&A bold pattern ─────────────────────────────────────────
    } else if (trimmed.startsWith('**Q:') || trimmed.startsWith('* **Q:')) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <div key={idx} className="my-6 text-xs sm:text-sm text-zinc-900 font-extrabold border-l-2 border-zinc-900 pl-4 py-0.5 italic">
          {parseInlineMarkdown(trimmed.replace(/^\* /, ''))}
        </div>
      );

    // ── Plain paragraph ──────────────────────────────────────────────
    } else {
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <p key={idx} className="text-xs sm:text-sm text-zinc-650 font-medium leading-relaxed mb-6">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    }
  });

  // Flush any remaining open state
  flushUnorderedList();
  flushOrderedList();
  flushTable();
  if (inCodeBlock) flushCodeBlock();

  return elements;
}
