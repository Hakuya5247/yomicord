import Fastify, { type FastifyReply } from 'fastify';
import {
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
  OkResponseSchema,
  ApiErrorResponseSchema,
  type ApiErrorCode,
} from '@yomicord/contracts';

export function createApp() {
  // なぜ: API は入力検証・エラー整形・永続化（将来）を担う単一の更新窓口。
  // 注意: Bot/Web は DB に触れず、必ずこの API を経由する。
  const app = Fastify({ logger: true });

  // なぜ: エラー応答の“形”を一箇所に固定し、クライアント側の例外処理を単純にする。
  function sendError(
    reply: FastifyReply,
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    // エラー応答も contracts で検証し、クライアントとの契約を崩さない
    const payload: unknown = {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    };

    const parsed = ApiErrorResponseSchema.safeParse(payload);
    if (!parsed.success) {
      // ここで契約違反の形を返さないための最終フォールバック
      return reply.status(500).send({
        ok: false,
        error: { code: 'INTERNAL', message: 'サーバー内部でエラーが発生しました' },
      });
    }

    return reply.status(statusCode).send(parsed.data);
  }

  app.setNotFoundHandler(async (_req, reply) => {
    return sendError(reply, 404, 'NOT_FOUND', 'エンドポイントが見つかりません');
  });

  app.setErrorHandler(async (err, _req, reply) => {
    // 例外の詳細はログへ（レスポンスには出さない）
    app.log.error({ err }, 'API で想定外のエラーが発生しました');

    const maybeStatusCode = (err as { statusCode?: unknown })?.statusCode;
    const statusCode = typeof maybeStatusCode === 'number' ? maybeStatusCode : 500;

    // なぜ: statusCode から contracts の error code に寄せ、クライアント側の分岐を安定させる。
    if (statusCode === 400) {
      return sendError(reply, 400, 'VALIDATION_FAILED', 'リクエストが不正です');
    }
    if (statusCode === 401) {
      return sendError(reply, 401, 'UNAUTHORIZED', '認証が必要です');
    }
    if (statusCode === 403) {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    if (statusCode === 404) {
      return sendError(reply, 404, 'NOT_FOUND', '見つかりません');
    }
    if (statusCode === 409) {
      return sendError(reply, 409, 'CONFLICT', '競合が発生しました');
    }

    return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
  });

  // なぜ: まずは DB なしで API I/F と責務分離を固めるための最小実装。
  // TODO(P0): 辞書/読み上げ設定を DB 永続化へ移行し、Map ベースの in-memory 実装を削除する。
  // TODO(P1): 更新系 API に認可と監査ログ（誰が/いつ/何を）を追加する。
  // key: `${guildId}:${key}`
  const dictionary = new Map<string, string>();
  // key: guildId
  const voiceSettings = new Map<string, { speakerId: number; speed: number; volume: number }>();

  app.get('/health', async () => ({ ok: true }));

  app.post('/v1/dictionary/entry', async (req, reply) => {
    // なぜ: 入力は contracts を唯一の真実として検証し、API 側でも必ず弾く。
    const parsed = UpsertDictionaryEntryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        'VALIDATION_FAILED',
        '入力内容が不正です',
        parsed.error.flatten(),
      );
    }

    const { guildId, word, yomi } = parsed.data;
    // TODO(P1): 辞書更新の仕様（上書き/拒否/差分なし）と成功時レスポンスの意味を明文化する。
    dictionary.set(`${guildId}:${word}`, yomi);

    return reply.send(OkResponseSchema.parse({ ok: true }));
  });

  app.post('/v1/voice/settings', async (req, reply) => {
    // なぜ: 入力は contracts を唯一の真実として検証し、API 側でも必ず弾く。
    const parsed = UpdateVoiceSettingsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        'VALIDATION_FAILED',
        '入力内容が不正です',
        parsed.error.flatten(),
      );
    }

    const { guildId, speakerId, speed, volume } = parsed.data;
    voiceSettings.set(guildId, { speakerId, speed, volume });

    return reply.send(OkResponseSchema.parse({ ok: true }));
  });

  return app;
}
