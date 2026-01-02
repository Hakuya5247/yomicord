import Fastify, { type FastifyReply } from 'fastify';
import {
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
  OkResponseSchema,
  ApiErrorResponseSchema,
  type ApiErrorCode,
} from '@yomicord/contracts';

export function createApp() {
  const app = Fastify({ logger: true });

  function sendError(
    reply: FastifyReply,
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
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

  // In-memory stores (DB導入前の仮)
  // key: `${guildId}:${key}`
  const dictionary = new Map<string, string>();
  // key: guildId
  const voiceSettings = new Map<string, { speakerId: number; speed: number; volume: number }>();

  app.get('/health', async () => ({ ok: true }));

  app.post('/v1/dictionary/entry', async (req, reply) => {
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
    dictionary.set(`${guildId}:${word}`, yomi);

    return reply.send(OkResponseSchema.parse({ ok: true }));
  });

  app.post('/v1/voice/settings', async (req, reply) => {
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
