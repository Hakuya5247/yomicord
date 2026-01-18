import { describe, expect, it } from 'vitest';
import { createDefaultGuildSettings } from '@yomicord/contracts/internal';

import { setupTestApp } from './_setup.js';

describe('api: routes: guild settings', () => {
  const { getApp } = setupTestApp();

  it('GET /v1/guilds/:guildId/settings は default を返す', async () => {
    const app = getApp();
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
    const app = getApp();
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
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
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

  it('PUT /v1/guilds/:guildId/settings は権限ヘッダー不足なら拒否される', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/settings',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
      },
      payload: createDefaultGuildSettings(),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(
      expect.objectContaining({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: '権限がありません',
        },
      }),
    );
  });

  it('PUT /v1/guilds/:guildId/settings は差分ごとに監査ログを残す', async () => {
    const app = getApp();
    const occurredAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const next = {
      ...createDefaultGuildSettings(),
      nameRead: {
        ...createDefaultGuildSettings().nameRead,
        prefix: 'てすと',
      },
      filters: {
        ...createDefaultGuildSettings().filters,
        urlMode: 'FULL',
      },
    };

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/settings',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
        'x-yomicord-actor-occurred-at': occurredAt,
      },
      payload: next,
    });

    expect(updateRes.statusCode).toBe(200);

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
          entityType: 'guild_settings',
          entityId: null,
          action: 'update',
          path: 'filters.urlMode',
          before: { urlMode: 'DOMAIN_ONLY' },
          after: { urlMode: 'FULL' },
          actorUserId: '999',
          source: 'api',
          createdAt: occurredAt,
        },
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'guild_settings',
          entityId: null,
          action: 'update',
          path: 'nameRead.prefix',
          before: { prefix: '' },
          after: { prefix: 'てすと' },
          actorUserId: '999',
          source: 'api',
          createdAt: occurredAt,
        },
      ],
    });
  });

  it('PUT /v1/guilds/:guildId/settings は差分なしなら監査ログを残さない', async () => {
    const app = getApp();
    const occurredAt = new Date('2026-01-01T00:00:00.000Z').toISOString();

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/v1/guilds/123/settings',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
        'x-yomicord-actor-occurred-at': occurredAt,
      },
      payload: createDefaultGuildSettings(),
    });

    expect(updateRes.statusCode).toBe(200);

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
      items: [],
    });
  });
});
