'use strict';

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config()

/**
  * Env holds all environment related configuration for the bot application.
  */
export class Env {
  /**
    * discordToken retrieves a sensitive token used to connect the bot to 
    * Discord.
    */
  static discordToken(): string {
    const token = process.env['BOT_DISCORD_TOKEN'];
    if (!token) throw new Error('BOT_DISCORD_TOKEN environment variable not found');
    return token;
  }

  /**
    * discordWebhookURL retrieves a sensitive webhook URL used to connect the
    * bot to a Discord webhook.
    */
  static discordWebhookURL(): string {
    const url = process.env['BOT_DISCORD_WEBHOOK_URL'];
    if (!url) throw new Error('BOT_DISCORD_WEBHOOK_URL environment variable not found');

    return url;
  }

  /**
    * discordServerBots retrieves an array of server Discord bot configurations
    * used to connect to a set of Discord bots associated with Rustpm servers.
    */
  static discordServerBots(): ServerBotConfigs {
    const envVar = process.env['BOT_DISCORD_SERVER_BOTS']
    if (!envVar) throw new Error('BOT_DISCORD_SERVER_BOTS environment variable not found');

    const json = JSON.parse(envVar) as ServerBotConfigs;
    const serverBots = serverBotConfigsSchema.parse(json)
    return serverBots
  }

  /**
    * redisURL retrieves a sensitive Redis URL used to connect the bot to a
    * Redis instance.
    */
  static redisURL(): string {
    const url = process.env['BOT_REDIS_URL'];
    if (!url) throw new Error('BOT_REDIS_URL environment variable not found');

    return url;
  }

  /**
    * healthPort retrieves the port used to expose the bot's health check.
    */
  static healthPort(): number {
    const portSchema = z.number().min(1).max(65535);
    const envVar = parseInt(process.env['BOT_HEALTH_PORT']);
    return portSchema.parse(envVar);
  }
}

const serverBotConfigSchema = z.object({
  id: z.string(),
  token: z.string()
});

const serverBotConfigsSchema = serverBotConfigSchema.array().nonempty();

export type ServerBotConfig = z.infer<typeof serverBotConfigSchema>;
export type ServerBotConfigs = z.infer<typeof serverBotConfigsSchema>;
