export type { Actor } from './internal/actor.js';
export { canonicalizeGuildMemberSettings } from './internal/canonicalize-guild-member-settings.js';
export { createDefaultGuildSettings } from './internal/guild-defaults.js';
export { normalizeSurface } from './internal/normalize-surface.js';
export type { AuditLogDiff } from './audit-log/diff.js';
export {
  computeDictionaryEntryDiff,
  computeGuildMemberSettingsDiff,
  computeGuildSettingsDiff,
} from './audit-log/diff.js';
