import type { APIMessage } from 'discord.js';
import type { StreamMessage } from './client.js';
import type { Status } from '../bots/bot.js';
import type { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import log from '../logger.js';

export interface Bot {
  setStatus(status: Status): void;
  setActivePlayers(active: number): void;
  setMaxPlayers(max: number): void;
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

    for (; ;) {
      const message = await this.streamClient.claimRead(minute)

      const {event, success} = this.parseEvent(message);
      if (success && event) {
        // If an event may be parsed from the message, proceed to handle it.
        // Otherwise, acknowledge the malformed message and proceed.
        await this.handle(event);
      }

      await this.streamClient.ack(message);
    }
  }

  private async handle(event: Event): Promise<void> {
    switch (event.kind) {
      case 'server_status_change':
        await this.handleServerStatusChange(event as ServerStatusChangeEvent);
        break;
      default: 
        log.info(
          'unrecognized event read from stream',
          { kind: event.kind },
        );
    }
    return
  }

  private async handleServerStatusChange(event: ServerStatusChangeEvent): Promise<void> {
    const res = serverStatusChangeEventSchema.safeParse(event);
    if (!res.success) {
      log.error(
        'while handling server status change; invalid event',
        { issues: res.error.issues, event: event },
      );
      return;
    }

    await this.webhookClient.send(`Server ${event.serverId} status change being processed.`);

    const { bot, ok } = this.botManager.fetchBot(event.serverId)
    if (!ok || bot == null) {
      return;
    }
    
    const details = event.details
    const mask = details.mask;

    if (mask.includes('status') && details.status === 'live') {
      bot.setStatus('online');
    }
    if (mask.includes('status') && details.status === 'offline') {
      bot.setStatus('dnd');
    }
    if (mask.includes('activePlayers') && details.activePlayers) {
      bot.setActivePlayers(details.activePlayers);
    }
    if (mask.includes('maxPlayers') && details.maxPlayers) {
      bot.setMaxPlayers(details.maxPlayers);
    }

    return;
  }

  private parseEvent(message: StreamMessage): {event?: Event, success: boolean} {
    const json = JSON.parse(message.payload) as Event;
    const res = eventSchema.passthrough().safeParse(json);
    if (!res.success) {
      log.error('while parsing stream event', res.error);
      return { success: false }
    }
    return { event: res.data, success: res.success };
  }
}

const eventSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  createdAt: z.string().datetime(),
});

const maskLiterals = ['status', 'activePlayers', 'maxPlayers'];
const oneOfMaskLiterals = (mask: string[]) => mask.some((field) => maskLiterals.includes(field));
const serverStatusChangeDetailsSchema = z.object({
  status: z.union([z.literal('live'), z.literal('offline')]).optional(),
  activePlayers: z.number().optional(),
  maxPlayers: z.number().optional(),
  mask: z.string().array().refine(oneOfMaskLiterals),
});

const serverStatusChangeEventSchema = eventSchema.merge(
  z.object({
    kind: z.literal('server_status_change'),
    serverId: z.string().uuid(),
    details: serverStatusChangeDetailsSchema,
  }),
);

type ServerStatusChangeEvent = z.infer<typeof serverStatusChangeEventSchema>
type Event = z.infer<typeof eventSchema>;
