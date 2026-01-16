import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyReply } from 'fastify';
import {
  ActorHeadersSchema,
  ApiErrorResponseSchema,
  DictionaryEntryBodySchema,
  DictionaryEntryDeleteResponseSchema,
  DictionaryEntryParamsSchema,
  DictionaryEntryResponseSchema,
  DictionaryListParamsSchema,
  DictionaryListQuerySchema,
  DictionaryListResponseSchema,
  GuildMemberSettingsDeleteResponseSchema,
  GuildMemberSettingsGetResponseSchema,
  GuildMemberSettingsParamsSchema,
  GuildMemberSettingsPutBodySchema,
  GuildMemberSettingsPutResponseSchema,
  GuildSettingsGetResponseSchema,
  GuildSettingsParamsSchema,
  GuildSettingsPutBodySchema,
  GuildSettingsPutResponseSchema,
  SettingsAuditLogListParamsSchema,
  SettingsAuditLogListQuerySchema,
  SettingsAuditLogListResponseSchema,
  computeDictionaryEntryDiff,
  computeGuildMemberSettingsDiff,
  computeGuildSettingsDiff,
  normalizeSurface,
  canonicalizeGuildMemberSettings,
  type AuditLogDiff,
  type Actor,
  type ActorHeaders,
  type ApiErrorCode,
  type GuildSettings,
  type SettingsAuditLog,
} from '@yomicord/contracts';
import {
  DictionaryEntryNotFoundError,
  DuplicateSurfaceKeyError,
  InvalidCursorError,
} from '@yomicord/storage';
import {
  JsonDictionaryStore,
  JsonGuildMemberSettingsStore,
  JsonGuildSettingsStore,
  JsonAuditLogStore,
} from '@yomicord/storage-json';

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
  const dictionaryStore = new JsonDictionaryStore(dataDir);
  const auditLogStore = new JsonAuditLogStore(dataDir);

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
      roleIds: [],
      isAdmin: false,
      source: headers['x-yomicord-actor-source'] ?? 'system',
      occurredAt: headers['x-yomicord-actor-occurred-at'] ?? new Date().toISOString(),
    };
  }

  function parseRoleIds(raw: string | undefined): string[] | null {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function parseIsAdmin(raw: string | undefined): boolean | null {
    if (!raw) {
      return false;
    }
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return null;
  }

  function applyActorRoles(headers: ActorHeaders, actor: Actor): Actor | null {
    const roleIds = parseRoleIds(headers['x-yomicord-actor-role-ids']);
    if (!roleIds) {
      return null;
    }
    const isAdmin = parseIsAdmin(headers['x-yomicord-actor-is-admin']);
    if (isAdmin === null) {
      return null;
    }
    return { ...actor, roleIds, isAdmin };
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

  function assertManagePermission(
    reply: FastifyReply,
    actor: Actor,
    settings: GuildSettings,
  ): FastifyReply | null {
    if (!actor.userId) {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    if (actor.isAdmin) {
      return null;
    }
    const manageMode = settings.permissions.manageMode;
    if (manageMode === 'ADMIN_ONLY') {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    const allowedRoleIds = settings.permissions.allowedRoleIds;
    const actorRoleIds = actor.roleIds ?? [];
    const hasRole = actorRoleIds.some((roleId) => allowedRoleIds.includes(roleId));
    if (!hasRole) {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    return null;
  }

  function sendHeaderValidationError(reply: FastifyReply, message: string) {
    return sendValidationError(reply, {
      flatten: () => ({ formErrors: [message], fieldErrors: {} }),
    });
  }

  function buildAuditLogBase(
    actor: Actor,
    params: {
      guildId: string;
      entityType: SettingsAuditLog['entityType'];
      entityId: SettingsAuditLog['entityId'];
      action: SettingsAuditLog['action'];
      path: SettingsAuditLog['path'];
      before: SettingsAuditLog['before'];
      after: SettingsAuditLog['after'];
    },
  ): SettingsAuditLog {
    return {
      id: randomUUID(),
      guildId: params.guildId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      path: params.path,
      before: params.before,
      after: params.after,
      actorUserId: actor.userId,
      source: actor.source,
      createdAt: actor.occurredAt,
    };
  }

  function sortAuditLogDiffs(diffs: AuditLogDiff[]): AuditLogDiff[] {
    return diffs.slice().sort((a, b) => {
      if (a.path === b.path) {
        return 0;
      }
      if (a.path === null) {
        return 1;
      }
      if (b.path === null) {
        return -1;
      }
      return a.path < b.path ? -1 : 1;
    });
  }

  async function appendAuditLogs(logs: SettingsAuditLog[]): Promise<void> {
    for (const log of logs) {
      await auditLogStore.append(log);
    }
  }

  function logAuditLogFailure(
    error: unknown,
    meta: {
      guildId: string;
      entityType: SettingsAuditLog['entityType'];
      entityId: SettingsAuditLog['entityId'];
      action: SettingsAuditLog['action'];
      path: SettingsAuditLog['path'];
      actorUserId: SettingsAuditLog['actorUserId'];
    },
  ) {
    app.log.error({ err: error, ...meta }, '監査ログの追記に失敗しました');
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

    const before = await guildSettingsStore.getOrCreate(params.data.guildId);
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
    try {
      const diffs = computeGuildSettingsDiff(before, next);
      const logs = sortAuditLogDiffs(diffs).map((diff) =>
        buildAuditLogBase(actor, {
          guildId: params.data.guildId,
          entityType: 'guild_settings',
          entityId: null,
          action: 'update',
          path: diff.path,
          before: diff.before,
          after: diff.after,
        }),
      );
      if (logs.length > 0) {
        await appendAuditLogs(logs);
      }
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'guild_settings',
        entityId: null,
        action: 'update',
        path: null,
        actorUserId: actor.userId,
      });
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

    const before = await guildMemberSettingsStore.get(params.data.guildId, params.data.userId);
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
    try {
      const logs: SettingsAuditLog[] = [];
      const entityId = `${params.data.guildId}:${params.data.userId}`;
      if (before === null && canonical !== null) {
        logs.push(
          buildAuditLogBase(actor, {
            guildId: params.data.guildId,
            entityType: 'guild_member_settings',
            entityId,
            action: 'create',
            path: null,
            before: {},
            after: canonical,
          }),
        );
      } else if (before !== null && canonical === null) {
        logs.push(
          buildAuditLogBase(actor, {
            guildId: params.data.guildId,
            entityType: 'guild_member_settings',
            entityId,
            action: 'delete',
            path: null,
            before,
            after: {},
          }),
        );
      } else if (before !== null && canonical !== null) {
        const diffs = computeGuildMemberSettingsDiff(before, canonical);
        const sortedDiffs = sortAuditLogDiffs(diffs);
        for (const diff of sortedDiffs) {
          logs.push(
            buildAuditLogBase(actor, {
              guildId: params.data.guildId,
              entityType: 'guild_member_settings',
              entityId,
              action: 'update',
              path: diff.path,
              before: diff.before,
              after: diff.after,
            }),
          );
        }
      }
      if (logs.length > 0) {
        await appendAuditLogs(logs);
      }
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'guild_member_settings',
        entityId: `${params.data.guildId}:${params.data.userId}`,
        action:
          before === null && canonical !== null
            ? 'create'
            : canonical === null
              ? 'delete'
              : 'update',
        path: null,
        actorUserId: actor.userId,
      });
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

    const before = await guildMemberSettingsStore.get(params.data.guildId, params.data.userId);
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
    try {
      if (before !== null) {
        await appendAuditLogs([
          buildAuditLogBase(actor, {
            guildId: params.data.guildId,
            entityType: 'guild_member_settings',
            entityId: `${params.data.guildId}:${params.data.userId}`,
            action: 'delete',
            path: null,
            before,
            after: {},
          }),
        ]);
      }
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'guild_member_settings',
        entityId: `${params.data.guildId}:${params.data.userId}`,
        action: 'delete',
        path: null,
        actorUserId: actor.userId,
      });
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.get('/v1/guilds/:guildId/dictionary', async (req, reply) => {
    const params = DictionaryListParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const query = DictionaryListQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }

    const actor = buildActor(actorHeaders.data);
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, settings);
    if (forbidden) {
      return forbidden;
    }

    try {
      const limit = query.data.limit ?? 50;
      const result = await dictionaryStore.listByGuild(params.data.guildId, {
        limit,
        cursor: query.data.cursor ?? null,
      });
      const payload: unknown = {
        ok: true,
        guildId: params.data.guildId,
        items: result.items,
        nextCursor: result.nextCursor,
      };
      const parsed = DictionaryListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
      }
      return reply.status(200).send(parsed.data);
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        return sendHeaderValidationError(reply, 'cursor が不正です');
      }
      throw error;
    }
  });

  app.post('/v1/guilds/:guildId/dictionary', async (req, reply) => {
    const params = DictionaryListParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const body = DictionaryEntryBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const actor = buildActor(actorHeaders.data);
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, settings);
    if (forbidden) {
      return forbidden;
    }

    const entry = {
      id: randomUUID(),
      guildId: params.data.guildId,
      surface: body.data.surface,
      surfaceKey: normalizeSurface(body.data.surface),
      reading: body.data.reading,
      priority: body.data.priority,
      isEnabled: body.data.isEnabled,
    };

    try {
      await dictionaryStore.create(params.data.guildId, entry, actorWithRoles);
    } catch (error) {
      if (error instanceof DuplicateSurfaceKeyError) {
        return sendError(reply, 409, 'CONFLICT', '既に同じ表記が登録されています');
      }
      throw error;
    }

    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      entry,
    };
    const parsed = DictionaryEntryResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    try {
      const after: Record<string, unknown> = {
        surface: entry.surface,
        surfaceKey: entry.surfaceKey,
        reading: entry.reading,
        priority: entry.priority,
        isEnabled: entry.isEnabled,
      };
      await appendAuditLogs([
        buildAuditLogBase(actorWithRoles, {
          guildId: params.data.guildId,
          entityType: 'dictionary_entry',
          entityId: entry.id,
          action: 'create',
          path: null,
          before: {},
          after,
        }),
      ]);
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'dictionary_entry',
        entityId: entry.id,
        action: 'create',
        path: null,
        actorUserId: actorWithRoles.userId,
      });
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.put('/v1/guilds/:guildId/dictionary/:entryId', async (req, reply) => {
    const params = DictionaryEntryParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const body = DictionaryEntryBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const actor = buildActor(actorHeaders.data);
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, settings);
    if (forbidden) {
      return forbidden;
    }

    const before = await dictionaryStore.getById(params.data.guildId, params.data.entryId);
    if (!before) {
      return sendError(reply, 404, 'NOT_FOUND', '辞書エントリが見つかりません');
    }

    const entry = {
      id: params.data.entryId,
      guildId: params.data.guildId,
      surface: body.data.surface,
      surfaceKey: normalizeSurface(body.data.surface),
      reading: body.data.reading,
      priority: body.data.priority,
      isEnabled: body.data.isEnabled,
    };

    try {
      await dictionaryStore.replace(
        params.data.guildId,
        params.data.entryId,
        entry,
        actorWithRoles,
      );
    } catch (error) {
      if (error instanceof DuplicateSurfaceKeyError) {
        return sendError(reply, 409, 'CONFLICT', '既に同じ表記が登録されています');
      }
      if (error instanceof DictionaryEntryNotFoundError) {
        return sendError(reply, 404, 'NOT_FOUND', '辞書エントリが見つかりません');
      }
      throw error;
    }

    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      entry,
    };
    const parsed = DictionaryEntryResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    try {
      const diffs = computeDictionaryEntryDiff(before, entry);
      const logs = sortAuditLogDiffs(diffs).map((diff) =>
        buildAuditLogBase(actorWithRoles, {
          guildId: params.data.guildId,
          entityType: 'dictionary_entry',
          entityId: params.data.entryId,
          action: 'update',
          path: diff.path,
          before: diff.before,
          after: diff.after,
        }),
      );
      if (logs.length > 0) {
        await appendAuditLogs(logs);
      }
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'dictionary_entry',
        entityId: params.data.entryId,
        action: 'update',
        path: null,
        actorUserId: actorWithRoles.userId,
      });
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.delete('/v1/guilds/:guildId/dictionary/:entryId', async (req, reply) => {
    const params = DictionaryEntryParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const actor = buildActor(actorHeaders.data);
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, settings);
    if (forbidden) {
      return forbidden;
    }

    const before = await dictionaryStore.getById(params.data.guildId, params.data.entryId);
    if (!before) {
      return sendError(reply, 404, 'NOT_FOUND', '辞書エントリが見つかりません');
    }

    try {
      await dictionaryStore.delete(params.data.guildId, params.data.entryId, actorWithRoles);
    } catch (error) {
      if (error instanceof DictionaryEntryNotFoundError) {
        return sendError(reply, 404, 'NOT_FOUND', '辞書エントリが見つかりません');
      }
      throw error;
    }

    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      entryId: params.data.entryId,
    };
    const parsed = DictionaryEntryDeleteResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    try {
      const beforePayload: Record<string, unknown> = {
        surface: before.surface,
        surfaceKey: before.surfaceKey,
        reading: before.reading,
        priority: before.priority,
        isEnabled: before.isEnabled,
      };
      await appendAuditLogs([
        buildAuditLogBase(actorWithRoles, {
          guildId: params.data.guildId,
          entityType: 'dictionary_entry',
          entityId: params.data.entryId,
          action: 'delete',
          path: null,
          before: beforePayload,
          after: {},
        }),
      ]);
    } catch (error) {
      logAuditLogFailure(error, {
        guildId: params.data.guildId,
        entityType: 'dictionary_entry',
        entityId: params.data.entryId,
        action: 'delete',
        path: null,
        actorUserId: actorWithRoles.userId,
      });
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  app.get('/v1/guilds/:guildId/audit-logs', async (req, reply) => {
    const params = SettingsAuditLogListParamsSchema.safeParse(req.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }

    const actorHeaders = ActorHeadersSchema.safeParse(req.headers);
    if (!actorHeaders.success) {
      return sendValidationError(reply, actorHeaders.error);
    }

    const query = SettingsAuditLogListQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }

    if (
      !actorHeaders.data['x-yomicord-actor-user-id'] ||
      !actorHeaders.data['x-yomicord-actor-role-ids'] ||
      !actorHeaders.data['x-yomicord-actor-is-admin']
    ) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const actor = buildActor(actorHeaders.data);
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendHeaderValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const settings = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, settings);
    if (forbidden) {
      return forbidden;
    }

    const limit = query.data.limit ?? 50;
    const items = await auditLogStore.listByGuild(params.data.guildId, limit);
    const payload: unknown = {
      ok: true,
      guildId: params.data.guildId,
      items,
    };
    const parsed = SettingsAuditLogListResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
    }
    return reply.status(200).send(parsed.data);
  });

  return app;
}
