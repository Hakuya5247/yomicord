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

export function createAuditLogHelpers(params: {
  auditLogStore: JsonAuditLogStore;
  log: FastifyBaseLogger;
}): AuditLogHelpers {
  const { auditLogStore, log } = params;

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
    for (const entry of logs) {
      await auditLogStore.append(entry);
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
    log.error({ err: error, ...meta }, '監査ログの追記に失敗しました');
  }

  return { buildAuditLogBase, sortAuditLogDiffs, appendAuditLogs, logAuditLogFailure };
}
