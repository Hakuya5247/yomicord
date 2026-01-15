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

  it('GET /v1/guilds/:guildId/dictionary は空配列を返す', async () => {
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

  it('GET /v1/guilds/:guildId/audit-logs は空配列を返す', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
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
    });
  });

  it('GET /v1/guilds/:guildId/audit-logs は limit で取得件数を制限する', async () => {
    const auditDir = path.join(dataDir, 'audit');
    await fs.mkdir(auditDir, { recursive: true });
    const logs = [
      {
        id: 'log-1',
        guildId: '123',
        entityType: 'dictionary_entry',
        entityId: 'entry-1',
        action: 'update',
        path: 'reading',
        before: {},
        after: {},
        actorUserId: '999',
        source: 'command',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'log-2',
        guildId: '123',
        entityType: 'guild_settings',
        entityId: null,
        action: 'update',
        path: 'filters.urlMode',
        before: {},
        after: {},
        actorUserId: '999',
        source: 'command',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    const filePath = path.join(auditDir, '123.log.jsonl');
    await fs.writeFile(
      filePath,
      `${JSON.stringify(logs[0])}\n${JSON.stringify(logs[1])}\n`,
      'utf8',
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=1',
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
      items: [logs[1]],
    });
  });

  it('GET /v1/guilds/:guildId/audit-logs は必須ヘッダー欠落で拒否する', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'true',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'リクエストが不正です',
        details: {
          formErrors: ['Actor ヘッダーが不正です'],
          fieldErrors: {},
        },
      },
    });
  });

  it('GET /v1/guilds/:guildId/audit-logs は認可失敗で拒否する', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs',
      headers: {
        'x-yomicord-actor-user-id': '999',
        'x-yomicord-actor-source': 'api',
        'x-yomicord-actor-is-admin': 'false',
        'x-yomicord-actor-role-ids': '[]',
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

  it('GET /v1/guilds/:guildId/audit-logs は limit の境界値を受け付ける', async () => {
    const auditDir = path.join(dataDir, 'audit');
    await fs.mkdir(auditDir, { recursive: true });
    const logs = [
      {
        id: 'log-1',
        guildId: '123',
        entityType: 'dictionary_entry',
        entityId: 'entry-1',
        action: 'update',
        path: 'reading',
        before: {},
        after: {},
        actorUserId: '999',
        source: 'command',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'log-2',
        guildId: '123',
        entityType: 'guild_settings',
        entityId: null,
        action: 'update',
        path: 'filters.urlMode',
        before: {},
        after: {},
        actorUserId: '999',
        source: 'command',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    const filePath = path.join(auditDir, '123.log.jsonl');
    await fs.writeFile(
      filePath,
      `${JSON.stringify(logs[0])}\n${JSON.stringify(logs[1])}\n`,
      'utf8',
    );

    const baseHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const resMin = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=1',
      headers: baseHeaders,
    });

    expect(resMin.statusCode).toBe(200);
    expect(resMin.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [logs[1]],
    });

    const resMax = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=200',
      headers: baseHeaders,
    });

    expect(resMax.statusCode).toBe(200);
    expect(resMax.json()).toEqual({
      ok: true,
      guildId: '123',
      items: [logs[1], logs[0]],
    });
  });

  it('GET /v1/guilds/:guildId/audit-logs は limit が不正なら拒否する', async () => {
    const baseHeaders = {
      'x-yomicord-actor-user-id': '999',
      'x-yomicord-actor-source': 'api',
      'x-yomicord-actor-is-admin': 'true',
      'x-yomicord-actor-role-ids': '[]',
    };

    const resZero = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=0',
      headers: baseHeaders,
    });

    expect(resZero.statusCode).toBe(400);
    expect(resZero.json()).toEqual(
      expect.objectContaining({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'リクエストが不正です',
          details: {
            formErrors: [],
            fieldErrors: {
              limit: expect.any(Array),
            },
          },
        },
      }),
    );

    const resOver = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=201',
      headers: baseHeaders,
    });

    expect(resOver.statusCode).toBe(400);
    expect(resOver.json()).toEqual(
      expect.objectContaining({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'リクエストが不正です',
          details: {
            formErrors: [],
            fieldErrors: {
              limit: expect.any(Array),
            },
          },
        },
      }),
    );

    const resNaN = await app.inject({
      method: 'GET',
      url: '/v1/guilds/123/audit-logs?limit=abc',
      headers: baseHeaders,
    });

    expect(resNaN.statusCode).toBe(400);
    expect(resNaN.json()).toEqual(
      expect.objectContaining({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'リクエストが不正です',
          details: {
            formErrors: [],
            fieldErrors: {
              limit: expect.any(Array),
            },
          },
        },
      }),
    );
  });
});
