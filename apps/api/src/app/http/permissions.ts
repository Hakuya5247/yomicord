import type { FastifyReply } from 'fastify';
import type { Actor } from '@yomicord/contracts/internal';
import type { GuildSettings } from '@yomicord/contracts';

import type { SendError } from './errors.js';

export type PermissionHelpers = {
  assertMemberOwner: (reply: FastifyReply, actor: Actor, userId: string) => FastifyReply | null;
  assertManagePermission: (
    reply: FastifyReply,
    actor: Actor,
    settings: GuildSettings,
  ) => FastifyReply | null;
};

export function createPermissionHelpers(sendError: SendError): PermissionHelpers {
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

  return { assertMemberOwner, assertManagePermission };
}
