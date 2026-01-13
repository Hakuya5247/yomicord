import { describe, expect, it, vi } from 'vitest';

import { createReadyHandler, createReadyListener, type Logger } from './readyHandler.js';

describe('bot: ready handler', () => {
  it('ready でログが出力される', async () => {
    const logger: Logger = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const onReady = createReadyHandler({
      logger,
    });

    const listener = createReadyListener({
      logger,
      getClientTag: () => 'test#0001',
      onReady,
    });

    await listener();

    expect(logger.log).toHaveBeenCalledWith('ログインしました: test#0001');
    expect(logger.log).toHaveBeenCalledWith('API 呼び出しが完了しました');
  });
});
