# Intent: src/index.ts modifications

## What changed

Added emoji reactions to acknowledge message receipt and signal errors.

## Key changes

### processGroupMessages()
- Added: `const lastMsg = missedMessages[missedMessages.length - 1]` before typing indicator
- Added: `await channel.reactToMessage?.(chatJid, lastMsg.id, '👍')` — thumbs up when starting to process
- Added: `await channel.reactToMessage?.(chatJid, lastMsg.id, '👎')` — thumbs down on error, before cursor rollback

### startMessageLoop()
- Added: reaction acknowledgment when piping messages to active container
- Uses fire-and-forget pattern with `.catch()` (same as the typing indicator)
- Reacts to the last piped message with thumbs up

### main()
- Fixed: indentation of WhatsApp channel creation block (was 2-space, now 4-space to match surrounding code)

## Invariants
- All reaction calls use optional chaining (`channel.reactToMessage?.()`) so channels without reaction support are unaffected
- No new imports needed
- Error handling and cursor rollback logic unchanged
- Recovery logic unchanged
