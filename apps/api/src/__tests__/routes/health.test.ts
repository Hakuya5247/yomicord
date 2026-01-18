import { describe, expect, it } from 'vitest';

import { setupTestApp } from './_setup.js';

describe('api: routes: health', () => {
  const { getApp } = setupTestApp();

  it('GET /health は ok=true を返す', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
