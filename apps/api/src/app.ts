import Fastify, { type FastifyReply } from 'fastify';
import {
  ActorHeadersSchema,
  ApiErrorResponseSchema,
  GuildMemberSettingsDeleteResponseSchema,
  GuildMemberSettingsGetResponseSchema,
  GuildMemberSettingsParamsSchema,
  GuildMemberSettingsPutBodySchema,
  GuildMemberSettingsPutResponseSchema,
  GuildSettingsGetResponseSchema,
  GuildSettingsParamsSchema,
  GuildSettingsPutBodySchema,
  GuildSettingsPutResponseSchema,
  canonicalizeGuildMemberSettings,
  type Actor,
  type ActorHeaders,
  type ApiErrorCode,
  type GuildSettings,
} from '@yomicord/contracts';
import { JsonGuildMemberSettingsStore, JsonGuildSettingsStore } from '@yomicord/storage-json';

type AppOptions = {
  dataDir?: string;
};

export function createApp(options: AppOptions = {}) {
  // なぜ: API は入力検証・エラー整形・永続化（将来）を担う単一の更新窓口。
  // 注意: Bot/Web は DB に触れず、必ずこの API を経由する。
  const app = Fastify({ logger: true });
  const dataDir = options.dataDir ?? process.env.YOMICORD_DATA_DIR ?? '/data';
  const guildSettingsStore = new JsonGuildSettingsStore(dataDir);
  const guildMemberSettingsStore = new JsonGuildMemberSettingsStore(dataDir);

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

  function sendValidationError(reply: FastifyReply, error: { flatten: () => unknown }) {
    return sendError(reply, 400, 'VALIDATION_FAILED', 'リクエストが不正です', error.flatten());
  }

  function buildActor(headers: ActorHeaders): Actor {
    return {
      userId: headers['x-yomicord-actor-user-id'] ?? null,
      displayName: headers['x-yomicord-actor-display-name'] ?? null,
      source: headers['x-yomicord-actor-source'] ?? 'system',
      occurredAt: headers['x-yomicord-actor-occurred-at'] ?? new Date().toISOString(),
    };
  }

  function assertMemberOwner(
    reply: FastifyReply,
    actor: Actor,
    userId: string,
  ): FastifyReply | null {
    if (!actor.userId || actor.userId !== userId) {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    return null;
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

  app.get('/health', async () => ({ ok: true }));

  app.get('/v1/guilds/:guildId/settings', async (req, reply) => {
    const params = GuildSettingsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      settings,
    };
    const parsed = GuildSettingsGetResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.put('/v1/guilds/:guildId/settings', async (req, reply) => {
    const params = GuildSettingsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const actor = buildActor(actorHeaders.data);

    const body = GuildSettingsPutBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const next: GuildSettings = body.data;
    await guildSettingsStore.update(params.data.guildId, next, actor);
    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      settings: next,
    };
    const parsed = GuildSettingsPutResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.get('/v1/guilds/:guildId/members/:userId/settings', async (req, reply) => {
    const params = GuildMemberSettingsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const actor = buildActor(actorHeaders.data);
    const forbidden = assertMemberOwner(reply, actor, params.data.userId);
    if (forbidden) {
      return forbidden;
    }

    const settings = await guildMemberSettingsStore.get(params.data.guildId, params.data.userId);
    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      userId: params.data.userId,
      settings,
    };
    const parsed = GuildMemberSettingsGetResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.put('/v1/guilds/:guildId/members/:userId/settings', async (req, reply) => {
    const params = GuildMemberSettingsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const actor = buildActor(actorHeaders.data);
    const forbidden = assertMemberOwner(reply, actor, params.data.userId);
    if (forbidden) {
      return forbidden;
    }

    const body = GuildMemberSettingsPutBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const canonical = canonicalizeGuildMemberSettings(body.data);
    if (!canonical) {
      await guildMemberSettingsStore.delete(params.data.guildId, params.data.userId, actor);
    } else {
      await guildMemberSettingsStore.upsert(
        params.data.guildId,
        params.data.userId,
        canonical,
        actor,
      );
    }

    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      userId: params.data.userId,
      settings: canonical,
    };
    const parsed = GuildMemberSettingsPutResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.delete('/v1/guilds/:guildId/members/:userId/settings', async (req, reply) => {
    const params = GuildMemberSettingsParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const actor = buildActor(actorHeaders.data);
    const forbidden = assertMemberOwner(reply, actor, params.data.userId);
    if (forbidden) {
      return forbidden;
    }

    await guildMemberSettingsStore.delete(params.data.guildId, params.data.userId, actor);
    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      userId: params.data.userId,
    };
    const parsed = GuildMemberSettingsDeleteResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  return app;
}
