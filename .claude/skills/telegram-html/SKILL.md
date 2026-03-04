---
name: telegram-html
description: Convert markdown to Telegram-compatible HTML before sending messages. Falls back to plain text if HTML parsing fails.
---

# Telegram HTML Markdown Fix

Telegram's Bot API supports a small subset of HTML. This skill adds a markdown-to-Telegram-HTML converter and wires it into `sendMessage()` so agent output renders correctly (bold, italic, code blocks, links, lists, headings).

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `telegram-html` is in `applied_skills`, stop — the changes are already in place.

### Verify dependency

This skill requires the `telegram` skill to be applied first. Verify `src/channels/telegram.ts` exists.

## Phase 2: Apply Code Changes

### Install dependency

```bash
npm install marked
```

### Add new files

Copy from the `add/` directory:
- `src/telegram-html.ts` — markdown-to-HTML converter using `marked`
- `src/telegram-html.test.ts` — 15 unit tests covering all supported formatting

### Merge modified files

Three-way merge into:
- `src/channels/telegram.ts` — import `toTelegramHtml`, use it in `sendMessage()` with HTML parse_mode and plain-text fallback
- `src/channels/telegram.test.ts` — add mock for `telegram-html.js`, update sendMessage tests for HTML mode

If merge conflicts occur, read the intent files:
- `modify/src/channels/telegram.ts.intent.md`
- `modify/src/channels/telegram.test.ts.intent.md`

### Validate

```bash
npm test
npm run build
```

## Phase 3: Verify

Send a message with markdown to the Telegram bot. It should render with proper formatting (bold, code blocks, links). If HTML parsing fails, it falls back to plain text silently.
