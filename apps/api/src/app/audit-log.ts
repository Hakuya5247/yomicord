import { randomUUID } from 'node:crypto';

import type { FastifyBaseLogger } from 'fastify';
import type { AuditLogDiff, Actor } from '@yomicord/contracts/internal';
import type { SettingsAuditLog } from '@yomicord/contracts';
import type { JsonAuditLogStore } from '@yomicord/storage-json';

export type AuditLogHelpers = {
  buildAuditLogBase: (
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
  ) => SettingsAuditLog;
  sortAuditLogDiffs: (diffs: AuditLogDiff[]) => AuditLogDiff[];
  appendAuditLogs: (logs: SettingsAuditLog[]) => Promise<void>;
  logAuditLogFailure: (
    error: unknown,
    meta: {
      guildId: string;
      entityType: SettingsAuditLog['entityType'];
      entityId: SettingsAuditLog['entityId'];
      action: SettingsAuditLog['action'];
      path: SettingsAuditLog['path'];
      actorUserId: SettingsAuditLog['actorUserId'];
    },
  ) => void;
};

/**
 * 監査ログ操作に必要な関数群を生成する。
 * @param params.auditLogStore - 監査ログの永続化先。
 * @param params.log - 失敗時に記録するロガー。
 * @returns 監査ログ用ヘルパー。
 */
export function createAuditLogHelpers(params: {
  auditLogStore: JsonAuditLogStore;
  log: FastifyBaseLogger;
}): AuditLogHelpers {
  const { auditLogStore, log } = params;

  /**
   * 監査ログの共通フィールドを組み立てる。
   * @param actor - 操作主体。
   * @param args - 監査ログの差分情報。
   * @returns 保存可能な監査ログ。
   */
  function buildAuditLogBase(
    actor: Actor,
    args: {
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
      guildId: args.guildId,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      path: args.path,
      before: args.before,
      after: args.after,
      actorUserId: actor.userId,
      source: actor.source,
      createdAt: actor.occurredAt,
    };
  }

  /**
   * 差分をパス順に整列し、表示や保存時の順序を安定させる。
   * @param diffs - 差分一覧。
   * @returns ソート済みの差分。
   */
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

  /**
   * 監査ログを順に保存する。
   * @param logs - 追記するログ一覧。
   */
  async function appendAuditLogs(logs: SettingsAuditLog[]): Promise<void> {
    for (const entry of logs) {
      await auditLogStore.append(entry);
    }
  }

  /**
   * 監査ログ追記の失敗を記録する。
   * @param error - 例外情報。
   * @param meta - 失敗時に残すメタ情報。
   */
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
    log.error({ err: error, ...meta }, '監査ログの追記に失敗しました');
  }

  return { buildAuditLogBase, sortAuditLogDiffs, appendAuditLogs, logAuditLogFailure };
}
