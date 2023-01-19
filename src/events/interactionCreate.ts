import type { Interaction } from 'discord.js';

export function interactionCreate(interaction: Interaction) {
  console.log(`interaction: ${JSON.stringify(interaction)}.`);
}
