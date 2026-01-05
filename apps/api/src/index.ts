import { pathToFileURL } from 'node:url';

import { createApp } from './app.js';

// なぜ: createApp を export して、テストや他の実行形態（埋め込み等）からも再利用できるようにする。
export { createApp };

// なぜ: CLI 実行時の最小入口。起動（listen）だけに責務を絞る。
async function start() {
  const app = createApp();
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

// なぜ: import 時に勝手にサーバーを起動しない（テストや再利用を安全にする）。
const isEntry = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isEntry) {
  start().catch((err) => {
    // ここは app.log が無いので stderr に出す
    console.error('API の起動に失敗しました', err);
    process.exit(1);
  });
}
