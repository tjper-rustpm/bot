import type { Bot } from './bot.js';
import type { v4 as uuidv4 } from 'uuid';

export class Manager {
  protected serverBots: Map<ReturnType<typeof uuidv4>, Bot>;

  constructor(serverBots: Array<ServerBot>) {
    this.serverBots = serverBots.reduce<typeof this.serverBots>(
      (hash, current) => {
        hash.set(current.serverId, current.bot);
        return hash;
      }, new Map(),
    );
  }

  /**
    * fetchBot retireves a Discord Bot from the Manager.
    * @param serverId - A unique identifier associated with the Discord Bot.
    * @return bot - The Discord Bot client.
    * @return ok - Whether the bot was found while fetching.
    */
  fetchBot(serverId: ReturnType<typeof uuidv4>): { bot?: Bot, ok: boolean } {
    const bot = this.serverBots.get(serverId)
    if (bot == null) {
      return { ok: false };
    }
    return { bot: bot, ok: true };
  }
}

export interface ServerBot {
  serverId: ReturnType<typeof uuidv4>;
  bot: Bot;
}
