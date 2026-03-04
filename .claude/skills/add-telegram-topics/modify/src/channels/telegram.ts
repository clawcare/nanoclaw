import fs from 'fs';
import path from 'path';

import { Bot } from 'grammy';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { resolveGroupFolderPath } from '../group-folder.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024; // 20 MB (Telegram Bot API limit)

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class TelegramChannel implements Channel {
  name = 'telegram';

  private bot: Bot | null = null;
  private opts: TelegramChannelOpts;
  private botToken: string;
  private lastTopicPerChat = new Map<string, number>();

  constructor(botToken: string, opts: TelegramChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
  }

  /**
   * Parse a JID into chat ID and optional thread/topic ID.
   * Supports plain JIDs (tg:123) and topic-qualified JIDs (tg:123:t:456).
   */
  private parseJid(jid: string): { chatId: string; threadId?: number } {
    const stripped = jid.replace(/^tg:/, '');
    const match = stripped.match(/^(.+):t:(\d+)$/);
    if (match) {
      return { chatId: match[1], threadId: parseInt(match[2], 10) };
    }
    return { chatId: stripped };
  }

  /**
   * Download a file from Telegram and save it to the group's downloads folder.
   * Returns the container-visible path on success, or null on failure.
   */
  private async downloadTelegramFile(
    ctx: any,
    groupFolder: string,
    fileName: string,
  ): Promise<string | null> {
    try {
      const fileObj = await ctx.getFile();
      if (!fileObj.file_path) return null;

      // Check size before downloading
      if (fileObj.file_size && fileObj.file_size > MAX_DOWNLOAD_SIZE) {
        logger.warn(
          { fileName, size: fileObj.file_size },
          'File too large to download',
        );
        return null;
      }

      const groupDir = resolveGroupFolderPath(groupFolder);
      const downloadsDir = path.join(groupDir, 'downloads');
      fs.mkdirSync(downloadsDir, { recursive: true });

      // Sanitize filename: strip path separators, collapse dots
      const sanitized = fileName
        .replace(/[/\\]/g, '_')
        .replace(/\.{2,}/g, '.')
        .slice(0, 200);
      const diskName = `${Date.now()}-${sanitized}`;
      const hostPath = path.join(downloadsDir, diskName);

      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${fileObj.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        logger.warn(
          { status: res.status, fileName },
          'Telegram file download failed',
        );
        return null;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(hostPath, buffer);

      logger.info(
        { fileName, size: buffer.length, hostPath },
        'Telegram file downloaded',
      );

      // Return the path as the agent sees it inside the container
      return `/workspace/group/downloads/${diskName}`;
    } catch (err) {
      logger.error({ err, fileName }, 'Failed to download Telegram file');
      return null;
    }
  }

  async connect(): Promise<void> {
    this.bot = new Bot(this.botToken);

    // Command to get chat ID (useful for registration)
    this.bot.command('chatid', (ctx) => {
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const chatName =
        chatType === 'private'
          ? ctx.from?.first_name || 'Private'
          : (ctx.chat as any).title || 'Unknown';

      ctx.reply(
        `Chat ID: \`tg:${chatId}\`\nName: ${chatName}\nType: ${chatType}`,
        { parse_mode: 'Markdown' },
      );
    });

    // Command to check bot status
    this.bot.command('ping', (ctx) => {
      ctx.reply(`${ASSISTANT_NAME} is online.`);
    });

    this.bot.on('message:text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;

      const chatJid = `tg:${ctx.chat.id}`;
      let content = ctx.message.text;
      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const msgId = ctx.message.message_id.toString();

      // Capture Telegram topic/thread ID
      const threadId = ctx.message.message_thread_id;
      if (threadId) {
        this.lastTopicPerChat.set(chatJid, threadId);
      }

      // Determine chat name
      const chatName =
        ctx.chat.type === 'private'
          ? senderName
          : (ctx.chat as any).title || chatJid;

      // Translate Telegram @bot_username mentions into TRIGGER_PATTERN format.
      // Telegram @mentions (e.g., @andy_ai_bot) won't match TRIGGER_PATTERN
      // (e.g., ^@Andy\b), so we prepend the trigger when the bot is @mentioned.
      const botUsername = ctx.me?.username?.toLowerCase();
      if (botUsername) {
        const entities = ctx.message.entities || [];
        const isBotMentioned = entities.some((entity) => {
          if (entity.type === 'mention') {
            const mentionText = content
              .substring(entity.offset, entity.offset + entity.length)
              .toLowerCase();
            return mentionText === `@${botUsername}`;
          }
          return false;
        });
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Store chat metadata for discovery
      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        chatName,
        'telegram',
        isGroup,
      );

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Telegram chat',
        );
        return;
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
        topic_id: threadId?.toString(),
      });

      logger.info(
        { chatJid, chatName, sender: senderName, threadId },
        'Telegram message stored',
      );
    });

    // Handle non-text messages with placeholders so the agent knows something was sent
    const storeNonText = (ctx: any, placeholder: string) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id?.toString() ||
        'Unknown';
      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';

      // Capture Telegram topic/thread ID
      const threadId = ctx.message.message_thread_id;
      if (threadId) {
        this.lastTopicPerChat.set(chatJid, threadId);
      }

      const isGroup =
        ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      this.opts.onChatMetadata(
        chatJid,
        timestamp,
        undefined,
        'telegram',
        isGroup,
      );
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content: `${placeholder}${caption}`,
        timestamp,
        is_from_me: false,
        topic_id: threadId?.toString(),
      });
    };

    this.bot.on('message:document', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const name = ctx.message.document?.file_name || 'file';
      const containerPath = await this.downloadTelegramFile(
        ctx,
        group.folder,
        name,
      );

      if (containerPath) {
        storeNonText(
          ctx,
          `[Document: ${name}]\nFile saved to: ${containerPath}`,
        );
      } else {
        storeNonText(ctx, `[Document: ${name}]`);
      }
    });

    this.bot.on('message:photo', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      // Pick highest-resolution photo (last in array)
      const photos = ctx.message.photo;
      const best = photos?.[photos.length - 1];
      if (!best) {
        storeNonText(ctx, '[Photo]');
        return;
      }

      // Build a context-like object with getFile for the specific photo
      const photoCtx = {
        getFile: () => this.bot!.api.getFile(best.file_id),
      };
      const ext = 'jpg';
      const containerPath = await this.downloadTelegramFile(
        photoCtx,
        group.folder,
        `photo.${ext}`,
      );

      if (containerPath) {
        storeNonText(ctx, `[Photo]\nFile saved to: ${containerPath}`);
      } else {
        storeNonText(ctx, '[Photo]');
      }
    });

    this.bot.on('message:video', (ctx) => storeNonText(ctx, '[Video]'));
    this.bot.on('message:voice', (ctx) => storeNonText(ctx, '[Voice message]'));
    this.bot.on('message:audio', (ctx) => storeNonText(ctx, '[Audio]'));
    this.bot.on('message:sticker', (ctx) => {
      const emoji = ctx.message.sticker?.emoji || '';
      storeNonText(ctx, `[Sticker ${emoji}]`);
    });
    this.bot.on('message:location', (ctx) => storeNonText(ctx, '[Location]'));
    this.bot.on('message:contact', (ctx) => storeNonText(ctx, '[Contact]'));

    // Handle errors gracefully
    this.bot.catch((err) => {
      logger.error({ err: err.message }, 'Telegram bot error');
    });

    // Start polling — returns a Promise that resolves when started
    return new Promise<void>((resolve) => {
      this.bot!.start({
        onStart: (botInfo) => {
          logger.info(
            { username: botInfo.username, id: botInfo.id },
            'Telegram bot connected',
          );
          console.log(`\n  Telegram bot: @${botInfo.username}`);
          console.log(
            `  Send /chatid to the bot to get a chat's registration ID\n`,
          );
          resolve();
        },
      });
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    try {
      const { chatId, threadId } = this.parseJid(jid);
      // Use explicit thread ID from JID, or fall back to last known topic for this chat
      const baseJid = `tg:${chatId}`;
      const effectiveThreadId = threadId ?? this.lastTopicPerChat.get(baseJid);
      const opts = effectiveThreadId
        ? { message_thread_id: effectiveThreadId }
        : {};

      // Telegram has a 4096 character limit per message — split if needed
      const MAX_LENGTH = 4096;
      if (text.length <= MAX_LENGTH) {
        await this.bot.api.sendMessage(chatId, text, opts);
      } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          await this.bot.api.sendMessage(
            chatId,
            text.slice(i, i + MAX_LENGTH),
            opts,
          );
        }
      }
      logger.info(
        { jid, threadId: effectiveThreadId, length: text.length },
        'Telegram message sent',
      );
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram message');
    }
  }

  /**
   * Create a new forum topic in a Telegram chat.
   * Returns the message_thread_id of the created topic.
   */
  async createForumTopic(jid: string, name: string): Promise<number> {
    if (!this.bot) throw new Error('Telegram bot not initialized');
    const { chatId } = this.parseJid(jid);
    const result = await this.bot.api.createForumTopic(chatId, name);
    return result.message_thread_id;
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tg:');
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      logger.info('Telegram bot stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.bot || !isTyping) return;
    try {
      const { chatId, threadId } = this.parseJid(jid);
      const baseJid = `tg:${chatId}`;
      const effectiveThreadId = threadId ?? this.lastTopicPerChat.get(baseJid);
      await this.bot.api.sendChatAction(chatId, 'typing', {
        message_thread_id: effectiveThreadId,
      });
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram typing indicator');
    }
  }
}
