import { describe, it, expect } from 'vitest';

import { toTelegramHtml } from './telegram-html.js';

describe('toTelegramHtml', () => {
  it('converts bold and italic', () => {
    expect(toTelegramHtml('**bold** and *italic*')).toBe(
      '<strong>bold</strong> and <em>italic</em>',
    );
  });

  it('converts inline code', () => {
    expect(toTelegramHtml('Use `const x = 1`')).toBe(
      'Use <code>const x = 1</code>',
    );
  });

  it('converts links', () => {
    expect(toTelegramHtml('[click](https://example.com)')).toBe(
      '<a href="https://example.com">click</a>',
    );
  });

  it('converts code blocks and strips language class', () => {
    const input = '```js\nconst x = 1;\n```';
    const result = toTelegramHtml(input);
    expect(result).toContain('<pre><code>');
    expect(result).toContain('const x = 1;');
    expect(result).not.toContain('class=');
  });

  it('converts headings to bold', () => {
    expect(toTelegramHtml('# Title')).toBe('<b>Title</b>');
  });

  it('converts h2 and h3 to bold', () => {
    expect(toTelegramHtml('## Subtitle')).toBe('<b>Subtitle</b>');
    expect(toTelegramHtml('### Section')).toBe('<b>Section</b>');
  });

  it('converts unordered lists to bullet points', () => {
    const input = '- item 1\n- item 2\n- item 3';
    const result = toTelegramHtml(input);
    expect(result).toContain('• item 1');
    expect(result).toContain('• item 2');
    expect(result).toContain('• item 3');
  });

  it('handles unbalanced markdown gracefully', () => {
    // marked handles unbalanced markers without errors
    const result = toTelegramHtml('Unbalanced *asterisk and _underscore');
    expect(result).toContain('Unbalanced');
    expect(result).not.toContain('<p>');
  });

  it('strips paragraph tags', () => {
    const result = toTelegramHtml('Hello world');
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('</p>');
    expect(result).toBe('Hello world');
  });

  it('strips blockquote tags', () => {
    const result = toTelegramHtml('> quoted text');
    expect(result).not.toContain('<blockquote>');
    expect(result).toContain('quoted text');
  });

  it('converts horizontal rules to newlines', () => {
    const result = toTelegramHtml('above\n\n---\n\nbelow');
    expect(result).not.toContain('<hr');
    expect(result).toContain('above');
    expect(result).toContain('below');
  });

  it('collapses excessive newlines', () => {
    const result = toTelegramHtml('first\n\n\n\n\nsecond');
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('preserves strikethrough', () => {
    const result = toTelegramHtml('~~removed~~');
    expect(result).toContain('<del>removed</del>');
  });

  it('handles mixed formatting', () => {
    const input =
      '# Hello\n\nSome **bold** and `code` with a [link](https://x.com)\n\n- one\n- two';
    const result = toTelegramHtml(input);
    expect(result).toContain('<b>Hello</b>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<code>code</code>');
    expect(result).toContain('<a href="https://x.com">link</a>');
    expect(result).toContain('• one');
    expect(result).toContain('• two');
  });

  it('handles empty input', () => {
    expect(toTelegramHtml('')).toBe('');
  });

  it('handles plain text with no markdown', () => {
    expect(toTelegramHtml('just plain text')).toBe('just plain text');
  });
});
