import type {
  JsonAuditLogStore,
  JsonDictionaryStore,
  JsonGuildMemberSettingsStore,
  JsonGuildSettingsStore,
} from '@yomicord/storage-json';

import type { AuditLogHelpers } from '../audit-log.js';
import type { ActorHelpers } from '../http/actor.js';
import type { ErrorHelpers } from '../http/errors.js';
import type { PermissionHelpers } from '../http/permissions.js';

export type AppStores = {
  guildSettingsStore: JsonGuildSettingsStore;
  guildMemberSettingsStore: JsonGuildMemberSettingsStore;
  dictionaryStore: JsonDictionaryStore;
  auditLogStore: JsonAuditLogStore;
};

export type AppHelpers = {
  auditLog: AuditLogHelpers;
  actor: ActorHelpers;
  error: ErrorHelpers;
  permission: PermissionHelpers;
};
