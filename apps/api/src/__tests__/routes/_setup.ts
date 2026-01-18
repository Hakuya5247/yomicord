import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach } from 'vitest';

import { createApp } from '../../app.js';

export const setupTestApp = () => {
  let app: ReturnType<typeof createApp>;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yomicord-api-'));
    app = createApp({ dataDir });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  return {
    getApp: () => app,
    getDataDir: () => dataDir,
  };
};
