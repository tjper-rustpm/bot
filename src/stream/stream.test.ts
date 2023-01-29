import type { Bot } from './stream.js';
import { Stream } from './stream.js';
import type { StreamMessage } from './client.js';
import type { Status } from '../bots/bot.js';

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import type { APIMessage } from 'discord.js';

describe('Stream', () => {
  const bot = {
    active: 0,
    setActivePlayers: (active: number): void => {
      bot.active = active;
    },
    max: 0,
    setMaxPlayers: (max: number): void => {
      bot.max = max;
    },
    status: 'dnd',
    setStatus: (status: Status): void => {
      bot.status = status;
    },
  }
  const botManager = {
    fetchBot: (): { bot?: Bot, ok: boolean } => {
      return { bot: bot, ok: true };
    },
  }

  type ResolveFunction = (value: StreamMessage | PromiseLike<StreamMessage>) => void;

  const streamClient = {
    emitter: new EventEmitter(),
    waiting: new Array<ResolveFunction>,
    stream: new Array<StreamMessage>,
    write: (message: StreamMessage) => {
      // If there are resolves waiting, retrieve the oldest and resolve it
      // with the passed message.
      const item = streamClient.waiting.at(0);
      if (item != null) {
        streamClient.waiting = streamClient.waiting.slice(1);
        const resolve = item;
        resolve(message);
        return;
      }

      streamClient.stream.push(message);
    },
    claimRead: async (): Promise<StreamMessage> => {
      // If a message already exists in the stream, return it to the caller.
      const item = streamClient.stream.at(0);
      if (item != null) {
        streamClient.stream = streamClient.stream.slice(1);
        return new Promise<StreamMessage>((resolve) => resolve(item));
      }

      // If no item exists in the stream, insert a promise into the waiting 
      // queue. This promise will be resolved when a new item is written.
      const promise = new Promise<StreamMessage>((resolve) => {
        streamClient.waiting.push(resolve);
      });
      return promise;
    },
    ack: async (): Promise<void> => {
      streamClient.emitter.emit('acked');
      return new Promise((resolve) => resolve())
    },
  }
  const webhookClient = {
    sent: '',
    send: async (message: string): Promise<APIMessage> => {
      webhookClient.sent = message;
      return new Promise((resolve) => resolve({} as APIMessage))
    },
  }

  const stream = new Stream(botManager, streamClient, webhookClient);
  stream.process().catch((err) => {
    expect(err).toBeNull();
  });

  const tests = [
    {
      name: 'should handle server is live',
      details: {
        status: 'live',
        mask: ['status'],
      },
      expected: {
        active: 0,
        max: 0,
        status: 'online',
      }, 
    },
    {
      name: 'should handle server is offline',
      details: {
        status: 'offline',
        mask: ['status'],
      },
      expected: {
        active: 0,
        max: 0,
        status: 'dnd',
      },
    },
    {
      name: 'should handle active players change',
      details: {
        activePlayers: 100,
        mask: ['activePlayers'],
      },
      expected: {
        active: 100,
        max: 0,
        status: 'dnd',
      },
    },
    {
      name: 'should handle max players change',
      details: {
        maxPlayers: 200,
        mask: ['maxPlayers'],
      },
      expected: {
        active: 100,
        max: 200,
        status: 'dnd',
        sent: 'Server test-server status change being processed.',
      },
    },
  ];

  tests.forEach((kase): void => {
    test(kase.name, (done) => {
      const serverId = uuidv4();

      streamClient.emitter.once('acked', () => {
        expect(bot.active).toStrictEqual(kase.expected.active);
        expect(bot.max).toStrictEqual(kase.expected.max);
        expect(bot.status).toStrictEqual(kase.expected.status);

        const expectedSent = `Server ${serverId} status change being processed.`;
        expect(webhookClient.sent).toStrictEqual(expectedSent);
        done();
      });

      const event = {
        id: uuidv4(),
        kind: 'server_status_change',
        createdAt: DateTime.utc(),
        serverId: serverId,
        details: kase.details,
      };
      const message = {
        id: uuidv4(),
        payload: JSON.stringify(event),
      };
      streamClient.write(message)
    });
  });

});
