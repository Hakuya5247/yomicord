import type { FastifyInstance } from 'fastify';
import {
  ActorHeadersSchema,
  GuildMemberSettingsDeleteResponseSchema,
  GuildMemberSettingsGetResponseSchema,
  GuildMemberSettingsParamsSchema,
  GuildMemberSettingsPutBodySchema,
  GuildMemberSettingsPutResponseSchema,
  computeGuildMemberSettingsDiff,
  canonicalizeGuildMemberSettings,
  type SettingsAuditLog,
} from '@yomicord/contracts';

import type { AppHelpers, AppStores } from '../internal/deps.js';

export function registerGuildMemberSettingsRoutes(
  app: FastifyInstance,
  deps: { stores: AppStores; helpers: AppHelpers },
) {
  const { guildMemberSettingsStore } = deps.stores;
  const {
    error: { sendError, sendValidationError },
    actor: { buildActor },
    permission: { assertMemberOwner },
    auditLog: { appendAuditLogs, buildAuditLogBase, logAuditLogFailure, sortAuditLogDiffs },
  } = deps.helpers;

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
    }
    return reply.status(200).send(parsed.data);
  });
}
