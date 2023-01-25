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
    const token = process.env['DISCORD_TOKEN'];
    if (!token) throw new Error('DISCORD_TOKEN environment variable not found');
    return token;
  }

  /**
    * discordWebhookURL retrieves a sensitive webhook URL used to connect the
    * bot to a Discord webhook.
    */
  static discordWebhookURL(): string {
    const url = process.env['DISCORD_WEBHOOK_URL'];
    if (!url) throw new Error('DISCORD_WEBHOOK_URL environment variable not found');

    return url;
  }

  /**
    * discordServerBots retrieves an array of server Discord bot configurations
    * used to connect to a set of Discord bots associated with Rustpm servers.
    */
  static discordServerBots(): ServerBotConfigs {
    const json = process.env['DISCORD_SERVER_BOTS']
    if (!json) throw new Error('DISCORD_SERVER_BOTS environment variable not found');

    const res = serverBotConfigsValidator.safeParse(json)
    if (!res.success) {
      throw new Error('DISCORD_SERVER_BOTS should be an Array')
    }

    const serverBots = res.data;
    return serverBots
  }

  /**
    * redisURL retrieves a sensitive Redis URL used to connect the bot to a
    * Redis instance.
    */
  static redisURL(): string {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL environment variable not found');

    return url;
  }
}

const serverBotConfigValidator = z.object({
  id: z.string(),
  token: z.string()
});

const serverBotConfigsValidator = serverBotConfigValidator.array().nonempty();

export type ServerBotConfig = z.infer<typeof serverBotConfigValidator>;
export type ServerBotConfigs = z.infer<typeof serverBotConfigsValidator>;
