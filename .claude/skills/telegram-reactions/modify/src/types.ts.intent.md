# Intent: src/types.ts modifications

## What changed

Added optional `reactToMessage` method to the `Channel` interface.

## Key changes

### Channel interface
- Added: `reactToMessage?(jid: string, messageId: string, emoji: string): Promise<void>` — optional method for emoji reactions
- Placed after `setTyping?` with a similar doc comment pattern

## Invariants
- All other types unchanged
- The method is optional (?) so existing channel implementations don't need to implement it
