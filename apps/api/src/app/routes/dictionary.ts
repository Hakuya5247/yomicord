import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { computeDictionaryEntryDiff, normalizeSurface } from '@yomicord/contracts/internal';
import {
  ActorHeadersSchema,
  DictionaryEntryBodySchema,
  DictionaryEntryDeleteResponseSchema,
  DictionaryEntryParamsSchema,
  DictionaryEntryResponseSchema,
  DictionaryListParamsSchema,
  DictionaryListQuerySchema,
  DictionaryListResponseSchema,
} from '@yomicord/contracts';
import {
  DictionaryEntryNotFoundError,
  DuplicateSurfaceKeyError,
  InvalidCursorError,
} from '@yomicord/storage';

import type { AppHelpers, AppStores } from '../internal/deps.js';

export function registerDictionaryRoutes(
  app: FastifyInstance,
  deps: { stores: AppStores; helpers: AppHelpers },
) {
  const { dictionaryStore, guildSettingsStore } = deps.stores;
  const {
    error: { sendError, sendValidationError, sendSimpleValidationError },
    actor: { buildActor, applyActorRoles },
    permission: { assertManagePermission },
    auditLog: { appendAuditLogs, buildAuditLogBase, logAuditLogFailure, sortAuditLogDiffs },
  } = deps.helpers;

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
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
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
        return sendSimpleValidationError(reply, 'cursor が不正です');
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
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
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
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
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
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
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
    }
    return reply.status(200).send(parsed.data);
  });
}
