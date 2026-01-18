import { describe, expect, it } from 'vitest';

import { setupTestApp } from './_setup.js';

describe('api: routes: member settings', () => {
  const { getApp } = setupTestApp();

  it('GET /v1/guilds/:guildId/members/:userId/settings は null を返す', async () => {
    const app = getApp();
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
    const app = getApp();
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
    const app = getApp();
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
    const app = getApp();
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
    const app = getApp();
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
    const app = getApp();
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

  it('PUT/DELETE /v1/guilds/:guildId/members/:userId/settings は create/update/delete を記録する', async () => {
    const app = getApp();
    const createAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const updateAt = new Date('2026-01-02T00:00:00.000Z').toISOString();
    const deleteAt = new Date('2026-01-03T00:00:00.000Z').toISOString();

    const createRes = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-occurred-at': createAt,
      },
      payload: {
        voice: {
          speed: 1.1,
        },
      },
    });

    expect(createRes.statusCode).toBe(200);

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-occurred-at': updateAt,
      },
      payload: {
        voice: {
          speed: 1.2,
        },
      },
    });

    expect(updateRes.statusCode).toBe(200);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/v1/guilds/123/members/456/settings',
      headers: {
        'x-yomicord-actor-user-id': '456',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-occurred-at': deleteAt,
      },
    });

    expect(deleteRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
      },
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'guild_member_settings',
          entityId: '123:456',
          action: 'delete',
          path: null,
          before: { voice: { speed: 1.2 } },
          after: {},
          actorUserId: '456',
          source: 'api',
          createdAt: deleteAt,
        },
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'guild_member_settings',
          entityId: '123:456',
          action: 'update',
          path: 'voice.speed',
          before: { speed: 1.1 },
          after: { speed: 1.2 },
          actorUserId: '456',
          source: 'api',
          createdAt: updateAt,
        },
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'guild_member_settings',
          entityId: '123:456',
          action: 'create',
          path: null,
          before: {},
          after: { voice: { speed: 1.1 } },
          actorUserId: '456',
          source: 'api',
          createdAt: createAt,
        },
      ],
    });
  });
});
