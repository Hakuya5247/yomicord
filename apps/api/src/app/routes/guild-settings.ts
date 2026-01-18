import type { FastifyInstance } from 'fastify';
import { computeGuildSettingsDiff } from '@yomicord/contracts/internal';
import {
  ActorHeadersSchema,
  GuildSettingsGetResponseSchema,
  GuildSettingsParamsSchema,
  GuildSettingsPutBodySchema,
  GuildSettingsPutResponseSchema,
  type GuildSettings,
} from '@yomicord/contracts';

import type { AppHelpers, AppStores } from '../internal/deps.js';

export function registerGuildSettingsRoutes(
  app: FastifyInstance,
  deps: { stores: AppStores; helpers: AppHelpers },
) {
  const { guildSettingsStore } = deps.stores;
  const {
    error: { sendError, sendValidationError, sendSimpleValidationError },
    actor: { buildActor, applyActorRoles },
    permission: { assertManagePermission },
    auditLog: { appendAuditLogs, buildAuditLogBase, logAuditLogFailure, sortAuditLogDiffs },
  } = deps.helpers;

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
    const actorWithRoles = applyActorRoles(actorHeaders.data, actor);
    if (!actorWithRoles) {
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
    }

    const body = GuildSettingsPutBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const before = await guildSettingsStore.getOrCreate(params.data.guildId);
    const forbidden = assertManagePermission(reply, actorWithRoles, before);
    if (forbidden) {
      return forbidden;
    }
    const next: GuildSettings = body.data;
    await guildSettingsStore.update(params.data.guildId, next, actorWithRoles);
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
        buildAuditLogBase(actorWithRoles, {
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
        actorUserId: actorWithRoles.userId,
      });
    }
    return reply.status(200).send(parsed.data);
  });
}
