import { describe, expect, test } from '@jest/globals';
import { createClient } from 'redis';

import { Client } from './client.js'
import { Env } from '../config.js'

/* eslint-disable-next-line @typescript-eslint/no-misused-promises */
describe('Client', () => {
  let redisURL: string;
  try {
    redisURL = Env.redisURL();
    expect(redisURL).toBe('redis://localhost:6379')
  } catch (err) {
    console.log('[SKIP] REDIS_URL not defined.');
    return;
  }


  let redisClient: ReturnType<typeof createClient>;
  let client: Client;
  beforeAll(async () => {
    redisClient = createClient({ url: redisURL })
    redisClient.on('error', (err: Error) => console.log('Redis Error', err));
    await redisClient.connect()

    client = await Client.initialize(redisClient, 'test');
  })

  afterAll(async () => {
    await redisClient.quit()
  });

  test('should write, read, and ack message', async () => {
    const message = 'test message';
    await client.write(message);
    const resp = await client.read();

    expect(resp.id).toBeTruthy();
    expect(resp.payload).toBe(message);

    await client.ack(resp);
  });

  test('should write, read, claim and ack message', async () => {
    const firstClient = client;
    const secondClient = await Client.initialize(redisClient, 'test');

    const message = 'test message';
    await firstClient.write(message);
    const firstResp = await firstClient.read();

    expect(firstResp.id).toBeTruthy();
    expect(firstResp.payload).toBe(message);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const idle = 250; // milliseconds
    const secondResp = await secondClient.claim(idle);
    expect(secondResp).toStrictEqual(firstResp);

    if (secondResp === null) {
      expect(secondResp).toBeDefined();
      return;
    }
    await client.ack(secondResp);
  });
});
