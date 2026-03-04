---
name: add-telegram-topics
description: Add Telegram Topics/Threads support. Bot replies in the correct topic, can target specific topics, and can create new topics. Requires Telegram channel to be set up first.
---

# Add Telegram Topics Support

This skill adds Telegram Topics (forum threads) support to NanoClaw. After applying, the bot will:
- Reply in the same topic where the message was received
- Allow the agent to target specific topics via `send_message` with `topic_id`
- Allow the agent to create new topics via `create_topic` MCP tool

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `telegram-topics` is in `applied_skills`, inform the user the skill is already applied.

### Check prerequisites

This skill requires the `telegram` skill to be applied first. If Telegram is not set up:

> Telegram Topics requires the Telegram channel. Run `/add-telegram` first.

### Ask the user

AskUserQuestion: Have you enabled Topics in your Telegram chat with the bot?

If not, tell them:

> To enable Topics in a DM with your bot:
>
> 1. Open your DM with the bot in Telegram
> 2. Tap the bot's name at the top
> 3. Look for **Topics** and enable it
>
> Note: Topics in DMs with bots was added in Telegram's February 2026 update. Make sure your Telegram app is up to date.

## Phase 2: Apply Code Changes

Run the skills engine to apply this skill's code package.

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist yet:

```bash
npx tsx scripts/apply-skill.ts --init
```

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-telegram-topics
```

This deterministically:
- Three-way merges topic support into `src/channels/telegram.ts` (parseJid, lastTopicPerChat, topic capture, topic routing, createForumTopic)
- Adds `topic_id` to `NewMessage` in `src/types.ts`
- Adds `topic_id` column migration and query updates to `src/db.ts`
- Adds topic attribute to XML prompt in `src/router.ts`
- Fixes IPC authorization for topic-qualified JIDs and adds `create_topic` handler in `src/ipc.ts`
- Adds `topic_id` param to `send_message` and `create_topic` tool in `container/agent-runner/src/ipc-mcp-stdio.ts`
- Wires `createTopic` callback in IPC deps in `src/index.ts`
- Records the application in `.nanoclaw/state.yaml`

If the apply reports merge conflicts, read the intent file:
- `modify/src/channels/telegram.ts.intent.md` — what changed and invariants

### Validate code changes

```bash
npm test
npm run build
```

All tests must pass and build must be clean before proceeding.

## Phase 3: Rebuild and Restart

Rebuild the container (for MCP tool changes):

```bash
./container/build.sh
```

Restart the service:

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.cortex-nanoclaw  # macOS
# Linux: systemctl --user restart cortex-nanoclaw
```

## Phase 4: Verify

### Test topic routing

Tell the user:

> 1. Open a topic in your Telegram DM with the bot
> 2. Send a message — the bot should reply in that same topic
> 3. Try a different topic — the reply should go to that topic instead
> 4. Send a message in General (no topic) — should reply in General

### Test topic creation

Tell the user:

> Ask the bot to create a new topic. For example: "Create a topic called 'Daily Notes'"
>
> The bot should create a new topic and send a confirmation message in it.

### Check logs if needed

```bash
tail -f logs/nanoclaw.log
```

## How It Works

### Topic Routing

When a message arrives from a Telegram topic, the bot captures `message_thread_id` and tracks it per chat. When sending a reply, it automatically includes `message_thread_id` so the response appears in the correct topic.

### Topic-Qualified JIDs

For explicit topic targeting (via `send_message` MCP tool), the system uses a JID format: `tg:{chatId}:t:{threadId}`. The Telegram channel parses this and routes to the specified topic.

### Agent Awareness

The XML prompt includes a `topic` attribute on messages from topics:
```xml
<message sender="Marco" time="..." topic="123">Hello from a topic</message>
```

This lets the agent know which topic each message came from.

### MCP Tools

- `send_message(text, topic_id?)` — Send to a specific topic (or last active topic if omitted)
- `create_topic(name)` — Create a new topic in the chat
