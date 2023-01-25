// import type { Activity, Status } from '../bots/bot.js';
import type { Bot } from './stream.js';
import { Stream } from './stream.js';
import type { StreamMessage } from './client.js';
import type { Activity, Status } from '../bots/bot.js';

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';

describe('Stream', () => {
  const bot = {
    activity: '',
    setActivity: (activity: Activity): void => {
      bot.activity = activity;
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
    send: async (message: string): Promise<void> => {
      webhookClient.sent = message;
      return new Promise((resolve) => resolve())
    },
  }

  const stream = new Stream(botManager, streamClient, webhookClient);
  stream.process().catch((err) => {
    expect(err).toBeNull();
  });

  const tests = [
    {
      name: 'should handle ServerLiveEvent',
      kind: 'server_live',
      expected: {
        activity: 'Playing Rust',
        status: 'online',
        sent: 'test-server is online',
      },
    },
    {
      name: 'should handle ServerOfflineEvent',
      kind: 'server_offline',
      expected: {
        activity: '',
        status: 'dnd',
        sent: 'test-server is offline',
      },
    },
  ];

  tests.forEach((kase): void => {
    test(kase.name, (done) => {
      streamClient.emitter.once('acked', () => {
        expect(bot.activity).toStrictEqual(kase.expected.activity);
        expect(bot.status).toStrictEqual(kase.expected.status);
        expect(webhookClient.sent).toStrictEqual(kase.expected.sent);
        done();
      });

      const event = {
        id: uuidv4(),
        kind: kase.kind,
        createdAt: DateTime.now(),
        serverId: uuidv4(),
        serverName: 'test-server',
      };
      const message = {
        id: uuidv4(),
        message: JSON.stringify(event),
      };
      streamClient.write(message)
    });
  });

});
