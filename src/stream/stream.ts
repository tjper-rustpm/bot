import type { APIMessage } from 'discord.js';
import type { StreamMessage } from './client.js';
import type { Activity, Status } from '../bots/bot.js';
import type { v4 as uuidv4 } from 'uuid';
import type { DateTime } from 'luxon';

export interface Bot {
  setActivity(activity: Activity): void;
  setStatus(status: Status): void;
}

export interface BotManager {
  fetchBot(serverId: ReturnType<typeof uuidv4>): { bot?: Bot, ok: boolean };
}

export interface StreamClient {
  claimRead(idle: number): Promise<StreamMessage>;
  ack(message: StreamMessage): Promise<void>;
}

export interface WebhookClient {
  send(message: string): Promise<APIMessage>;
}

export class Stream {
  protected botManager: BotManager;
  protected streamClient: StreamClient;
  protected webhookClient: WebhookClient;

  constructor(
    botManager: BotManager,
    streamClient: StreamClient,
    webhookClient: WebhookClient
  ) {
    this.botManager = botManager;
    this.streamClient = streamClient;
    this.webhookClient = webhookClient;
  }

  async process(): Promise<void> {
    const second = 1000;
    const minute = 60 * second;

    while (true) {
      const message = await this.streamClient.claimRead(minute)

      const event = this.parseEvent(message);
      if (event) {
        // If an event may be parsed from the message, proceed to handle it.
        // Otherwise, acknowledge the malformed message and proceed.
        await this.handle(event);
      }

      await this.streamClient.ack(message);
    }
  }

  private async handle(event: Event): Promise<void> {
    switch (event?.kind) {
      case 'server_live':
        await this.handleServerLive(event);
        break;
      case 'server_offline':
        await this.handleServerOffline(event);
        break;
    }
    return
  }

  private async handleServerLive(event: ServerLiveEvent): Promise<void> {
    await this.webhookClient.send(`${event.serverName} is online`)

    const { bot, ok } = this.botManager.fetchBot(event.serverId)
    if (!ok || bot == null) {
      return;
    }

    bot.setActivity('Playing Rust');
    bot.setStatus('online');

    return;
  }

  private async handleServerOffline(event: ServerOfflineEvent): Promise<void> {
    await this.webhookClient.send(`${event.serverName} is offline`)

    const { bot, ok } = this.botManager.fetchBot(event.serverId)
    if (!ok || bot == null) {
      return;
    }

    bot.setActivity('');
    bot.setStatus('dnd');
    return;
  }

  private parseEvent(message: StreamMessage): Event {
    try {
      const event = JSON.parse(message.message);
      return event;
    } catch (err) {
      return null;
    }
  }
}

type Event = ServerLiveEvent | ServerOfflineEvent | null;

interface EventHeader {
  id: ReturnType<typeof uuidv4>;
  createdAt: DateTime;
}

type ServerEvent = EventHeader & {
  serverId: ReturnType<typeof uuidv4>;
  serverName: string
}

type ServerLiveEvent = ServerEvent & {
  kind: 'server_live';
}
type ServerOfflineEvent = ServerEvent & {
  kind: 'server_offline';
}
