import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { setupTestApp } from './_setup.js';

describe('api: routes: audit logs', () => {
  const { getApp, getDataDir } = setupTestApp();

  it('GET /v1/guilds/:guildId/audit-logs は空配列を返す', async () => {
    const app = getApp();
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
    const app = getApp();
    const dataDir = getDataDir();
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
    const app = getApp();
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
    const app = getApp();
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
    const app = getApp();
    const dataDir = getDataDir();
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
    const app = getApp();
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
