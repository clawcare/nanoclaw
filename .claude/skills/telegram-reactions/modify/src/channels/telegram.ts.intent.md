# Intent: src/channels/telegram.ts modifications

## What changed

Added `reactToMessage()` method to TelegramChannel.

## Key changes

### New method: reactToMessage()
- Added at the end of the class, after `setTyping()`
- Uses `bot.api.setMessageReaction()` to send emoji reactions
- Strips `tg:` prefix from JID, converts messageId to number
- Wraps in try/catch — failures are logged as warnings, never thrown
- Returns early if bot is not initialized

## Invariants
- All other methods unchanged
- No new imports needed (uses existing Bot API)
