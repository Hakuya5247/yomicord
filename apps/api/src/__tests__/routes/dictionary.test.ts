import { describe, expect, it } from 'vitest';

import { setupTestApp } from './_setup.js';

describe('api: routes: dictionary', () => {
  const { getApp } = setupTestApp();

  it('GET /v1/guilds/:guildId/dictionary は空配列を返す', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/dictionary',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [],
      nextCursor: null,
    });
  });

  it('POST /v1/guilds/:guildId/dictionary は作成し、GET で cursor ページングできる', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const createRes1 = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(createRes1.statusCode).toBe(200);
    const entry1 = createRes1.json().entry;
    expect(entry1.surfaceKey).toBe('api');

    const createRes2 = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'Bot',
        reading: 'ぼっと',
        priority: 5,
        isEnabled: true,
      },
    });

    expect(createRes2.statusCode).toBe(200);
    const entry2 = createRes2.json().entry;

    const listRes1 = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/dictionary?limit=1',
      headers: adminHeaders,
    });

    expect(listRes1.statusCode).toBe(200);
    const list1 = listRes1.json();
    expect(list1.items).toHaveLength(1);
    expect(list1.items[0].id).toBe(entry1.id);
    expect(list1.nextCursor).not.toBeNull();

    const listRes2 = await app.inject({
      method: 'GET',
      url: `/v1/guilds/123/dictionary?limit=1&cursor=${encodeURIComponent(list1.nextCursor)}`,
      headers: adminHeaders,
    });

    expect(listRes2.statusCode).toBe(200);
    const list2 = listRes2.json();
    expect(list2.items).toHaveLength(1);
    expect(list2.items[0].id).toBe(entry2.id);
    expect(list2.nextCursor).toBeNull();
  });

  it('GET /v1/guilds/:guildId/dictionary は limit 未指定で 50 件返す', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    for (let i = 0; i < 51; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/guilds/123/dictionary',
        headers: adminHeaders,
        payload: {
          surface: `Word${i}`,
          reading: `よみ${i}`,
          priority: 100 - i,
          isEnabled: true,
        },
      });
      expect(res.statusCode).toBe(200);
    }

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
    });

    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.items).toHaveLength(50);
    expect(list.nextCursor).not.toBeNull();
  });

  it('POST /v1/guilds/:guildId/dictionary は絵文字を含む surface を正規化する', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: '  😀ＡＰＩ　テスト  ',
        reading: 'てすと',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      guildId: '123',
      entry: expect.objectContaining({
        surface: '  😀ＡＰＩ　テスト  ',
        surfaceKey: '😀api テスト',
      }),
    });
  });

  it('POST /v1/guilds/:guildId/dictionary は surfaceKey 重複で CONFLICT', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'api',
        reading: 'えーぴーあい',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '既に同じ表記が登録されています',
      },
    });
  });

  it('PUT /v1/guilds/:guildId/dictionary/:entryId は全置換で更新する', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    const entry = createRes.json().entry;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/guilds/123/dictionary/${entry.id}`,
      headers: adminHeaders,
      payload: {
        surface: 'APIs',
        reading: 'えーぴーあいず',
        priority: 20,
        isEnabled: false,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toEqual({
      ok: true,
      guildId: '123',
      entry: {
        ...entry,
        surface: 'APIs',
        surfaceKey: 'apis',
        reading: 'えーぴーあいず',
        priority: 20,
        isEnabled: false,
      },
    });
  });

  it('DELETE /v1/guilds/:guildId/dictionary/:entryId は削除する', async () => {
    const app = getApp();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    const entry = createRes.json().entry;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/guilds/123/dictionary/${entry.id}`,
      headers: adminHeaders,
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json()).toEqual({
      ok: true,
      guildId: '123',
      entryId: entry.id,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [],
      nextCursor: null,
    });
  });

  it('GET /v1/guilds/:guildId/dictionary は無効 cursor を拒否する', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/dictionary?cursor=invalid',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
        'x-yomicord-actor-role-ids': '[]',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'リクエストが不正です',
        details: {
          formErrors: ['cursor が不正です'],
          fieldErrors: {},
        },
      },
    });
  });

  it('POST /v1/guilds/:guildId/dictionary は作成ログを残す', async () => {
    const app = getApp();
    const occurredAt = new Date('2026-01-02T00:00:00.000Z').toISOString();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
      'x-yomicord-actor-occurred-at': occurredAt,
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: adminHeaders,
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(createRes.statusCode).toBe(200);
    const entryId = createRes.json().entry.id as string;

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
      headers: adminHeaders,
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'dictionary_entry',
          entityId: entryId,
          action: 'create',
          path: null,
          before: {},
          after: {
            surface: 'API',
            surfaceKey: 'api',
            reading: 'エーピーアイ',
            priority: 10,
            isEnabled: true,
          },
          actorUserId: '999',
          source: 'api',
          createdAt: occurredAt,
        },
      ],
    });
  });

  it('PUT/DELETE /v1/guilds/:guildId/dictionary/:entryId は update/delete を記録する', async () => {
    const app = getApp();
    const createAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const updateAt = new Date('2026-01-02T00:00:00.000Z').toISOString();
    const deleteAt = new Date('2026-01-03T00:00:00.000Z').toISOString();
    const adminHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/guilds/123/dictionary',
      headers: { ...adminHeaders, 'x-yomicord-actor-occurred-at': createAt },
      payload: {
        surface: 'API',
        reading: 'エーピーアイ',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(createRes.statusCode).toBe(200);
    const entryId = createRes.json().entry.id as string;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/guilds/123/dictionary/${entryId}`,
      headers: { ...adminHeaders, 'x-yomicord-actor-occurred-at': updateAt },
      payload: {
        surface: 'API',
        reading: 'えーぴーあい',
        priority: 10,
        isEnabled: true,
      },
    });

    expect(updateRes.statusCode).toBe(200);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/guilds/123/dictionary/${entryId}`,
      headers: { ...adminHeaders, 'x-yomicord-actor-occurred-at': deleteAt },
    });

    expect(deleteRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
      headers: adminHeaders,
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'dictionary_entry',
          entityId: entryId,
          action: 'delete',
          path: null,
          before: {
            surface: 'API',
            surfaceKey: 'api',
            reading: 'えーぴーあい',
            priority: 10,
            isEnabled: true,
          },
          after: {},
          actorUserId: '999',
          source: 'api',
          createdAt: deleteAt,
        },
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'dictionary_entry',
          entityId: entryId,
          action: 'update',
          path: 'reading',
          before: { reading: 'エーピーアイ' },
          after: { reading: 'えーぴーあい' },
          actorUserId: '999',
          source: 'api',
          createdAt: updateAt,
        },
        {
          id: expect.any(String),
          guildId: '123',
          entityType: 'dictionary_entry',
          entityId: entryId,
          action: 'create',
          path: null,
          before: {},
          after: {
            surface: 'API',
            surfaceKey: 'api',
            reading: 'エーピーアイ',
            priority: 10,
            isEnabled: true,
          },
          actorUserId: '999',
          source: 'api',
          createdAt: createAt,
        },
      ],
    });
  });
});
