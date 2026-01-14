import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultGuildSettings } from '@yomicord/contracts';

import { createApp } from './app.js';

describe('api: routes', () => {
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

  it('GET /health は ok=true を返す', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /v1/guilds/:guildId/settings は default を返す', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/settings',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      settings: createDefaultGuildSettings(),
    });
  });

  it('PUT /v1/guilds/:guildId/settings は全置換して返す', async () => {
    const updated = {
      ...createDefaultGuildSettings(),
      nameRead: {
        ...createDefaultGuildSettings().nameRead,
        prefix: 'テスト',
      },
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/settings',
      headers: {
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-occurred-at': new Date('2025-01-01T00:00:00.000Z').toISOString(),
      },
      payload: updated,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      settings: updated,
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/settings',
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual({
      ok: true,
      guildId: '123',
      settings: updated,
    });
  });
});
