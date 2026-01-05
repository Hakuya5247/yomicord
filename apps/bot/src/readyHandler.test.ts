import { describe, expect, it, vi } from 'vitest';

import { createReadyHandler, createReadyListener, type Logger } from './readyHandler.js';

// Arrange 用のヘルパ: JSON(200) レスポンスを簡単に作る。
function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('bot: ready handler', () => {
  it('ready を擬似発火すると API 呼び出しが走る（payload 検証）', async () => {
    // Arrange: API 成功レスポンスを2回返す。
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson({ ok: true }));

    // Arrange: ログ出力をモックして副作用を観測する。
    const logger: Logger = {
      log: vi.fn(),
      error: vi.fn(),
    };

    // Arrange: ready 時処理（API 呼び出し本体）を生成する。
    const onReady = createReadyHandler({
      apiBaseUrl: 'http://example.test',
      fetchFn: fetchMock,
      logger,
      guildId: 'g1',
    });

    // Arrange: ready イベント入口を生成する。
    const listener = createReadyListener({
      logger,
      getClientTag: () => 'test#0001',
      onReady,
    });

    // Act: イベント（ready）の擬似発火
    await listener();

    // Assert: エンドポイントと payload（contracts 準拠）を確認する。
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [dictUrl, dictInit] = fetchMock.mock.calls[0] as [string, unknown];
    const dictReq = dictInit as { method?: string; headers?: unknown; body?: unknown };
    expect(dictUrl).toBe('http://example.test/v1/dictionary/entry');
    expect(dictReq.method).toBe('POST');
    expect(dictReq.headers).toEqual({ 'content-type': 'application/json' });
    expect(typeof dictReq.body).toBe('string');
    expect(JSON.parse(dictReq.body as string)).toMatchObject({
      guildId: 'g1',
      word: 'よみこーど',
      yomi: 'Yomicord',
    });

    const [voiceUrl, voiceInit] = fetchMock.mock.calls[1] as [string, unknown];
    const voiceReq = voiceInit as { body?: unknown };
    expect(voiceUrl).toBe('http://example.test/v1/voice/settings');
    expect(typeof voiceReq.body).toBe('string');
    expect(JSON.parse(voiceReq.body as string)).toMatchObject({
      guildId: 'g1',
      speakerId: 1,
      speed: 1.0,
      volume: 1.0,
    });

    // Assert: ready のログと完了ログが出る。
    expect(logger.log).toHaveBeenCalledWith('ログインしました: test#0001');
    expect(logger.log).toHaveBeenCalledWith('API 呼び出しが完了しました');
  });

  it('API 失敗時にレスポンス形式を安全に扱ってログする', async () => {
    // Arrange: 失敗ログを観測したいので logger をモックする。
    const logger: Logger = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const apiErrorBody = {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: '入力内容が不正です',
        details: { formErrors: [], fieldErrors: {} },
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(apiErrorBody), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(okJson({ ok: true }));

    const onReady = createReadyHandler({
      apiBaseUrl: 'http://example.test',
      fetchFn: fetchMock,
      logger,
      guildId: 'g1',
    });

    // Act: ready 処理本体を直接実行する。
    await onReady();

    // Assert: エラー code を含むログが出る。
    expect(logger.error).toHaveBeenCalled();
    const firstMsg = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(String(firstMsg)).toContain('VALIDATION_FAILED');
  });
});
