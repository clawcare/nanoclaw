# Intent: src/channels/telegram.test.ts modifications

## What changed

Updated sendMessage tests to expect HTML mode, added mock for telegram-html module.

## Key changes

### Mocks (top of file)
- Added: `vi.mock('../telegram-html.js', ...)` — pass-through mock so tests can assert exact content without actual HTML conversion

### sendMessage test suite
- Renamed: 'sends message via bot API' → 'sends message via bot API with HTML'
- All `sendMessage` assertions now expect third argument `{ parse_mode: 'HTML' }`
- Added: 'falls back to plain text when HTML send fails' test — first call rejects, second succeeds without parse_mode
- Updated: 'handles send failure gracefully' test — now verifies both HTML and plain text attempts fail gracefully

## Invariants
- All other test suites unchanged
- Bot mock API shape unchanged except for the new assertions
