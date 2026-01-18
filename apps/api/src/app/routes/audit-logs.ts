import type { FastifyInstance } from 'fastify';
import {
  ActorHeadersSchema,
  SettingsAuditLogListParamsSchema,
  SettingsAuditLogListQuerySchema,
  SettingsAuditLogListResponseSchema,
} from '@yomicord/contracts';

import type { AppHelpers, AppStores } from '../internal/deps.js';

export function registerAuditLogRoutes(
  app: FastifyInstance,
  deps: { stores: AppStores; helpers: AppHelpers },
) {
  const { auditLogStore, guildSettingsStore } = deps.stores;
  const {
    error: { sendError, sendValidationError, sendSimpleValidationError },
    actor: { buildActor, applyActorRoles },
    permission: { assertManagePermission },
  } = deps.helpers;

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
      return sendSimpleValidationError(reply, 'Actor ヘッダーが不正です');
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
}
