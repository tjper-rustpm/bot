import type { Client } from 'discord.js';

export function ready(client: Client<true>) {
  console.log(`Ready! Logged in as ${client.user.tag}.`);
}
