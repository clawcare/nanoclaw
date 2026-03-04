# Intent: src/channels/telegram.ts modifications

## What changed

Added markdown-to-HTML conversion for outgoing Telegram messages.

## Key changes

### Import (top of file)
- Added: `import { toTelegramHtml } from '../telegram-html.js';`

### sendMessage() method
- Refactored message chunking to build an array of chunks first
- Each chunk is converted to HTML via `toTelegramHtml()` and sent with `{ parse_mode: 'HTML' }`
- If the HTML send fails (bad parse, unsupported tags), falls back to sending as plain text
- This try/catch is per-chunk, so a failure on one chunk doesn't break the rest

## Invariants
- The 4096 character limit per message is preserved
- All other methods are unchanged
- Error logging for send failures is preserved
