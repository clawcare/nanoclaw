# Intent: src/channels/telegram.ts modifications

## What changed
Added Telegram Topics/Threads support — the bot now tracks which topic messages come from and replies to the correct topic.

## Key sections

### New private members
- `lastTopicPerChat: Map<string, number>` — tracks the most recent topic ID per base chat JID
- `parseJid(jid)` — helper to extract chatId and optional threadId from plain or topic-qualified JIDs (`tg:123` or `tg:123:t:456`)

### Incoming message handlers (message:text, storeNonText)
- Capture `ctx.message.message_thread_id` from incoming messages
- Update `lastTopicPerChat` when a thread ID is present
- Pass `topic_id: threadId?.toString()` on the `NewMessage` object

### sendMessage()
- Use `parseJid(jid)` to extract explicit `threadId` from topic-qualified JIDs
- Fall back to `lastTopicPerChat.get(baseJid)` when no explicit thread in JID
- Pass `{ message_thread_id: effectiveThreadId }` to `bot.api.sendMessage()`

### setTyping()
- Use `parseJid(jid)` to extract chatId (strips topic suffix)
- Pass `message_thread_id` to `sendChatAction()` so typing indicator appears in correct topic

### New: createForumTopic()
- Public method that calls `bot.api.createForumTopic()` and returns `message_thread_id`
- Used by IPC handler for the `create_topic` agent tool

## Invariants
- All existing message processing logic (bot mention translation, metadata storage, attachment handling) is preserved
- JID format for registration and DB storage remains `tg:{chatId}` (base JID, no topic suffix)
- Topic-qualified JIDs (`tg:123:t:456`) are only used in IPC message routing and sendMessage calls
- `ownsJid()` still works with topic-qualified JIDs since they start with `tg:`
- Error handling patterns unchanged

## Must-keep
- The download helper and all media handlers
- Bot mention → trigger translation logic
- Chat metadata reporting via onChatMetadata
- The 4096 character message splitting
- Error catching on bot.catch
- The onStart polling setup
