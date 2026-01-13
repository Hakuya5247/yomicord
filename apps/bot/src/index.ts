import { pathToFileURL } from 'node:url';

import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

import { createReadyHandler, createReadyListener } from './readyHandler.js';

// なぜ: Bot 起動の最小入口。Discord 接続と ready ハンドラ登録だけに責務を限定する。
async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is required');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const onReady = createReadyHandler({
    logger: console,
  });

  // 注意: Bot 側は DB に触れず、設定・辞書変更は API を呼ぶだけにする。

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

// なぜ: import 時に勝手にログインしない（テストや再利用を安全にする）。
const isEntry = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isEntry) {
  void main().catch((err) => {
    console.error('起動に失敗しました', err);
    process.exitCode = 1;
  });
}
