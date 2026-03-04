# Intent: src/channels/telegram.test.ts modifications

## What changed

Added `setMessageReaction` to the Grammy mock API and a new test suite for `reactToMessage()`.

## Key changes

### Grammy mock (top of file)
- Added: `setMessageReaction: vi.fn().mockResolvedValue(true)` to the `api` object in MockBot

### New test suite: reactToMessage
- Added after the `setTyping` describe block, before `Bot commands`
- Tests: sends reaction via bot API, does nothing when bot not initialized, handles failure gracefully
- Pattern mirrors the `setTyping` test structure

## Invariants
- All other test suites unchanged
- No changes to test helpers or other mocks
