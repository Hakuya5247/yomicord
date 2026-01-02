import { pathToFileURL } from 'node:url';

import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

import { createReadyHandler, createReadyListener } from './readyHandler.js';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is required');

  const apiBaseUrl = (process.env.YOMICORD_API_BASEURL ?? 'http://localhost:8787').replace(
    /\/+$/,
    '',
  );

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const onReady = createReadyHandler({
    apiBaseUrl,
    fetchFn: fetch,
    logger: console,
  });

  client.once(
    'ready',
    createReadyListener({
      logger: console,
      getClientTag: () => client.user?.tag,
      onReady,
    }),
  );

  try {
    await client.login(token);
  } catch (err) {
    console.error('Discord へのログインに失敗しました', err);
    process.exitCode = 1;
  }
}

const isEntry = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isEntry) {
  void main().catch((err) => {
    console.error('起動に失敗しました', err);
    process.exitCode = 1;
  });
}
