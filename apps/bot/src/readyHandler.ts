import {
  ApiErrorResponseSchema,
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
} from '@yomicord/contracts';

export type Logger = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type FetchFn = (input: string, init?: FetchInit) => Promise<Response>;

export function createReadyHandler(args: {
  apiBaseUrl: string;
  fetchFn: FetchFn;
  logger: Logger;
  guildId?: string;
}) {
  const guildId = args.guildId ?? 'test-guild';

  return async function runApiCallsOnReady() {
    const dictBody = UpsertDictionaryEntryRequestSchema.parse({
      guildId,
      word: 'よみこーど',
      yomi: 'Yomicord',
    });

    const dictRes = await args.fetchFn(`${args.apiBaseUrl}/v1/dictionary/entry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dictBody),
    });

    if (!dictRes.ok) {
      await logApiError(args.logger, '辞書の更新', dictRes);
    }

    const voiceBody = UpdateVoiceSettingsRequestSchema.parse({
      guildId,
      speakerId: 1,
      speed: 1.0,
      volume: 1.0,
    });

    const voiceRes = await args.fetchFn(`${args.apiBaseUrl}/v1/voice/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(voiceBody),
    });

    if (!voiceRes.ok) {
      await logApiError(args.logger, '読み上げ設定の更新', voiceRes);
    }

    args.logger.log('API 呼び出しが完了しました');
  };
}

export function createReadyListener(args: {
  logger: Logger;
  getClientTag: () => string | undefined;
  onReady: () => Promise<void>;
}) {
  return async function onClientReady() {
    args.logger.log(`ログインしました: ${args.getClientTag() ?? 'unknown'}`);
    await args.onReady();
  };
}

export async function logApiError(logger: Logger, actionName: string, res: Response) {
  // 失敗時でも、レスポンス形式を信頼しすぎない（安全第一）
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    logger.error(`API の${actionName}に失敗しました (HTTP ${res.status})`);
    return;
  }

  try {
    const body: unknown = await res.json();
    const parsed = ApiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      logger.error(
        `API の${actionName}に失敗しました: code=${parsed.data.error.code} message=${parsed.data.error.message} (HTTP ${res.status})`,
      );
      return;
    }
  } catch {
    // JSON 解析に失敗しても、詳細は出さずにフォールバックする
  }

  logger.error(`API の${actionName}に失敗しました (HTTP ${res.status})`);
}
