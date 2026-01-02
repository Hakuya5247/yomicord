import { pathToFileURL } from 'node:url';

import { createApp } from './app.js';

export { createApp };

async function start() {
  const app = createApp();
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

const isEntry = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isEntry) {
  start().catch((err) => {
    // ここは app.log が無いので stderr に出す
    console.error('API の起動に失敗しました', err);
    process.exit(1);
  });
}
