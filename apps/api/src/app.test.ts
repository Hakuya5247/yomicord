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

  it('GET /v1/guilds/:guildId/members/:userId/settings は null を返す', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
      settings: null,
    });
  });

  it('PUT /v1/guilds/:guildId/members/:userId/settings は canonicalize 後に返す', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
      payload: {
        voice: {
          speed: 1.1,
        },
        nameRead: {
          normalize: 'inherit',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
      settings: {
        voice: {
          speed: 1.1,
        },
      },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
      settings: {
        voice: {
          speed: 1.1,
        },
      },
    });
  });

  it('PUT /v1/guilds/:guildId/members/:userId/settings は空なら削除して null を返す', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
      payload: {
        nameRead: {
          normalize: 'inherit',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
      settings: null,
    });
  });

  it('GET /v1/guilds/:guildId/members/:userId/settings は本人以外だと拒否される', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: '権限がありません',
      },
    });
  });

  it('DELETE /v1/guilds/:guildId/members/:userId/settings は削除して ok を返す', async () => {
    await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
      payload: {
        voice: {
          speed: 1.1,
        },
      },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual({
      ok: true,
      guildId: '123',
      userId: '456',
      settings: null,
    });
  });

  it('DELETE /v1/guilds/:guildId/members/:userId/settings は本人以外だと拒否される', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: '権限がありません',
      },
    });
  });
});
