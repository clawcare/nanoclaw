---
name: telegram-reactions
description: React to messages with emoji to acknowledge receipt and signal errors.
---

# Telegram Message Reactions

Adds emoji reactions to Telegram messages as user feedback signals:
- Reacts with a thumbs-up when a message is picked up for processing
- Reacts with a thumbs-down when an error occurs
- Reacts with a thumbs-up when piping messages to an active container

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `telegram-reactions` is in `applied_skills`, stop.

### Verify dependency

This skill requires the `telegram` skill. Verify `src/channels/telegram.ts` exists.

## Phase 2: Apply Code Changes

### Merge modified files

Three-way merge into:
- `src/types.ts` — add optional `reactToMessage` method to `Channel` interface
- `src/channels/telegram.ts` — add `reactToMessage()` implementation using `setMessageReaction` API
- `src/channels/telegram.test.ts` — add `setMessageReaction` mock and reaction test suite
- `src/index.ts` — add reaction calls in `processGroupMessages()` and `startMessageLoop()`

If merge conflicts occur, read the intent files in `modify/`.

### Validate

```bash
npm test
npm run build
```

## Phase 3: Verify

Send a message to the Telegram bot. You should see a thumbs-up reaction appear on your message when the agent picks it up for processing.
