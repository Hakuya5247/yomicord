import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('api: routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health は ok=true を返す', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('POST /v1/dictionary/entry は成功/バリデーション失敗を返す', async () => {
    const okRes = await app.inject({
      method: 'POST',
      url: '/v1/dictionary/entry',
      headers: { 'content-type': 'application/json' },
      payload: {
        guildId: 'g1',
        word: 'よみこーど',
        yomi: 'Yomicord',
      },
    });

    expect(okRes.statusCode).toBe(200);
    expect(okRes.json()).toEqual({ ok: true });

    const badRes = await app.inject({
      method: 'POST',
      url: '/v1/dictionary/entry',
      headers: { 'content-type': 'application/json' },
      payload: {
        guildId: 'g1',
        word: 'よみこーど',
        // yomi が無い
      },
    });

    expect(badRes.statusCode).toBe(400);
    expect(badRes.json()).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
      },
    });
  });
});
