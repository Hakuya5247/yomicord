import type { FastifyReply } from 'fastify';
import type { Actor } from '@yomicord/contracts/internal';
import type { GuildSettings } from '@yomicord/contracts';

import type { SendError } from './errors.js';

/**
 * 権限判定に関するヘルパー群の契約。
 */
export type PermissionHelpers = {
  assertMemberOwner: (reply: FastifyReply, actor: Actor, userId: string) => FastifyReply | null;
  assertManagePermission: (
    reply: FastifyReply,
    actor: Actor,
    settings: GuildSettings,
  ) => FastifyReply | null;
};

/**
 * 権限判定のヘルパーを生成する。
 * @param sendError - エラー応答を返す関数。
 * @returns 権限判定ヘルパー。
 */
export function createPermissionHelpers(sendError: SendError): PermissionHelpers {
  /**
   * 対象ユーザー本人かどうかを検証する。
   * @param reply - Fastify の返信オブジェクト。
   * @param actor - 操作主体。
   * @param userId - 対象ユーザー ID。
   * @returns エラー応答または null。
   */
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

  /**
   * ギルド管理権限があるか検証する。
   * @param reply - Fastify の返信オブジェクト。
   * @param actor - 操作主体。
   * @param settings - ギルド設定。
   * @returns エラー応答または null。
   */
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
