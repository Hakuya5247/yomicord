import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

import {
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
} from '@yomicord/contracts';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is required');

const apiBaseUrl = (process.env.YOMICORD_API_BASEURL ?? 'http://localhost:8787').replace(
  /\/+$/,
  '',
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // とりあえず疎通用に API を叩いてみる（ギルドIDは仮）
  const guildId = 'test-guild';

  const dictBody = UpsertDictionaryEntryRequestSchema.parse({
    guildId,
    word: 'よみこーど',
    yomi: 'Yomicord',
  });

  await fetch(`${apiBaseUrl}/v1/dictionary/entry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dictBody),
  });

  const voiceBody = UpdateVoiceSettingsRequestSchema.parse({
    guildId,
    speakerId: 1,
    speed: 1.0,
    volume: 1.0,
  });

  await fetch(`${apiBaseUrl}/v1/voice/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(voiceBody),
  });

  console.log('API calls done');
});

async function main() {
  try {
    await client.login(token);
  } catch (err) {
    console.error('Discord へのログインに失敗しました', err);
    process.exitCode = 1;
  }
}

void main().catch((err) => {
  console.error('起動に失敗しました', err);
  process.exitCode = 1;
});
