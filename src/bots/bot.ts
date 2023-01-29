import type { Client, PresenceStatusData } from 'discord.js';
import { ActivityType } from 'discord.js';

export class Bot {
  protected client: Client<true>;

  constructor(client: Client<true>) {
    this.client = client;
  }

  setStatus(status: Status): void {
    this.client.user.setStatus(status);
  }

  setActivePlayers(active: number): void {
    const res = this.players();
    if (!res) {
      this.client.user.setActivity(`Players ${active}/0`, {type: ActivityType.Playing});
      return
    }
    this.client.user.setActivity(`Players ${active}/${res.max}`, {type: ActivityType.Playing});
  }

  setMaxPlayers(max: number): void {
    const res = this.players();
    if (!res) {
      this.client.user.setActivity(`Players 0/${max}`, {type: ActivityType.Playing});
      return
    }
    this.client.user.setActivity(`Players ${res.active}/${max}`, {type: ActivityType.Playing});
  }

  private players(): {active: number, max: number} | undefined {
    const activities = this.client.user.presence.activities
    if (activities.length !== 1) {
      return
    }

    const words = activities[0]?.name?.split(' ');
    if (words?.length !== 2) {
      return
    }

    const ratio = words?.at(1);
    const numbers = ratio?.split('/');
    if (numbers?.length !== 2) {
      return
    }

    const active = ratio?.at(0);
    const max = ratio?.at(1);
    if (!max || !active) {
      return
    }
    return { active: parseInt(active), max: parseInt(max) };
  }
}

export type Status = PresenceStatusData;
