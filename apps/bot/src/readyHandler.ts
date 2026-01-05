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

// なぜ: Bot は fetch を直接使わず DI する（テスト容易性・将来の差し替え・失敗時の挙動統一）。
export type FetchFn = (input: string, init?: FetchInit) => Promise<Response>;

// なぜ: Discord のイベント結線と「ready 時にやる処理」を分離し、テスト可能な形にする。
export function createReadyHandler(args: {
  apiBaseUrl: string;
  fetchFn: FetchFn;
  logger: Logger;
  guildId?: string;
}) {
  // TODO(P1): guildId は実際の接続先 Guild から取得し、テスト用デフォルトが本番経路に残らないようにする。
  const guildId = args.guildId ?? 'test-guild';

  return async function runApiCallsOnReady() {
    // 注意: ready 時の初期化はベストエフォート（失敗しても Bot 自体は起動継続）。
    // TODO(P1): Ready のたびに初期化 API を叩かないよう、冪等化（1回のみ/差分時のみ）を入れる。
    // TODO(P1): API 呼び出しにタイムアウト/少数回リトライを導入し、起動時の不安定さに耐える。
    // 送信 payload も contracts を正として検証し、Bot 側から契約違反を作らない
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
      // ready 時の初期化はベストエフォート（失敗しても Bot 自体は起動継続）
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
      // ready 時の初期化はベストエフォート（失敗しても Bot 自体は起動継続）
      await logApiError(args.logger, '読み上げ設定の更新', voiceRes);
    }

    args.logger.log('API 呼び出しが完了しました');
  };
}

// なぜ: Discord の ready イベント入口を薄く保ち、ログ出力と実処理を分離する。
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
  // 注意: 失敗時ほどレスポンス形式を信頼しすぎない（HTML/空/想定外JSONでも落ちないようにする）。
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    logger.error(`API の${actionName}に失敗しました (HTTP ${res.status})`);
    return;
  }

  try {
    const body: unknown = await res.json();
    // なぜ: “形が合うときだけ”詳細（code/message）をログに含める。
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
