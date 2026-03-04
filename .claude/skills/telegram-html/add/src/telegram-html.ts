import { marked } from 'marked';

/**
 * Convert standard markdown to Telegram-compatible HTML.
 *
 * Telegram only supports a subset of HTML tags:
 *   <b>, <strong>, <i>, <em>, <u>, <s>, <del>, <code>, <pre>, <a href="...">
 *
 * This function uses `marked` to parse markdown, then strips/converts
 * unsupported HTML tags to their Telegram-safe equivalents.
 */
export function toTelegramHtml(markdown: string): string {
  const html = marked(markdown, { async: false }) as string;

  return (
    html
      // Headings → bold
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n')
      // Paragraphs → content + double newline
      .replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n')
      // List items → bullet points
      .replace(/<li>([\s\S]*?)<\/li>/gi, '• $1\n')
      // Strip list wrappers
      .replace(/<\/?[ou]l[^>]*>/gi, '')
      // Blockquote → strip tags
      .replace(/<\/?blockquote[^>]*>/gi, '')
      // <br> and <hr> → newline
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n')
      // Strip class attributes from code/pre (e.g. class="language-js")
      .replace(/<(code|pre)\s+class="[^"]*">/gi, '<$1>')
      // Strip any remaining unsupported tags (img, table, thead, tbody, tr, td, th, etc.)
      .replace(
        /<\/?(img|table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col|div|span|section|article|nav|header|footer|main|aside|figure|figcaption|details|summary|mark|abbr|cite|dfn|kbd|samp|var|sub|sup|small|ruby|rt|rp|bdi|bdo|wbr|data|time|meter|progress|output|dialog|template|slot)\b[^>]*\/?>/gi,
        '',
      )
      // Collapse 3+ newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
