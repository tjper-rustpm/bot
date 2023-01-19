import type { Client, PresenceStatusData } from 'discord.js';

export class Bot {
  protected client: Client<true>;

  constructor(client: Client<true>) {
    this.client = client;
  }

  setActivity(activity: Activity): void {
    this.client.user.setActivity(activity);
  }

  setStatus(status: PresenceStatusData): void {
    this.client.user.setStatus(status);
  }
}

export type Activity = 'Playing Rust' | '';
export type Status = PresenceStatusData;
