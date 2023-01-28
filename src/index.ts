import { Env, ServerBotConfig } from './config.js';

import { Tcp } from './health/tcp.js';

import { Client as StreamClient } from './stream/client.js';
import { Stream } from './stream/stream.js';

import { Manager as BotManager } from './bots/manager.js';
import { Bot } from './bots/bot.js';

import { ready } from './events/ready.js';
import { interactionCreate } from './events/interactionCreate.js';

import log from './logger.js';

import { Client, Events, GatewayIntentBits, WebhookClient, } from 'discord.js';
import { createClient } from 'redis';

log.info('[Startup] Launching bot server ...');

// Server chatbots and bot manager setup.
log.info('[Startup] Setting up server bots ...');
const serverBotConfigs = Env.discordServerBots();
const serverBotsAndClient = await Promise.all(
  serverBotConfigs.map(
    async (config: ServerBotConfig) => {
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ]
      });
      await client.login(config.token);
      return {
        serverId: config.id,
        bot: new Bot(client),
        client: client,
      };
    }),
)
const serverBots = serverBotsAndClient.map(({serverId, bot}) => {
  return { serverId: serverId, bot: bot };
});

const botManager = new BotManager(serverBots);
log.info('[Startup] Server bots configured and logged-in.');

// Stream handling setup and processing kickoff.
log.info('[Startup] Setting up Redis client ...');
const redisClient = createClient({ url: Env.redisURL() });
redisClient.on('error', (err) => { console.log('Redis Error', err) });
await redisClient.connect();
log.info('[Startup] Connected to Redis.');

log.info('[Startup] Setting up stream ...');
const webhookClient = new WebhookClient({ url: Env.discordWebhookURL() });
const streamClient = await StreamClient.initialize(redisClient, 'bot');
const stream = new Stream(botManager, streamClient, webhookClient);
void stream.process();
log.info('[Startup] Stream setup and is being processed.');

// Rustpm chatbot setup and event handler registration.
log.info('[Startup] Setting up Rustpm chatbot');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.once(Events.ClientReady, (...args) => ready(...args));
client.on(Events.InteractionCreate, (...args) => interactionCreate(...args));

await client.login(Env.discordToken());
log.info('[Startup] Rustpm chatbot logged-in and running.');

// Create TCP health check.
log.info('[Startup] Setting up TCP healthcheck');
const healthCheck = new Tcp();
await healthCheck.listen(Env.healthPort());
log.info('[Startup] Healthcheck launched.');

// Cleanup for entire application and associations with OS signals.
const cleanup = async () => {
  await healthCheck.shutdown();
  await redisClient.quit();

  serverBotsAndClient.map(({ client }: {client: Client}) => {
    client.destroy();
  });
  client.destroy();
  process.exit(2);
};

['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, () => {
    cleanup().catch((err) => {
      console.log('Cleanup Error', err);
    });
  });
});


