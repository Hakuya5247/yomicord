import { z } from 'zod';

export const SettingsAuditLogSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  entityType: z.enum(['guild_settings', 'guild_member_settings', 'dictionary_entry']),
  entityId: z.string().nullable(),
  action: z.enum(['create', 'update', 'delete']),
  path: z.string().nullable(),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
  actorUserId: z.string().nullable(),
  source: z.enum(['command', 'api', 'system', 'migration']),
  createdAt: z.string(),
});
export type SettingsAuditLog = z.infer<typeof SettingsAuditLogSchema>;

// ---- API: SettingsAuditLog ----
export const SettingsAuditLogListParamsSchema = z.object({
  guildId: z.string().min(1),
});
export type SettingsAuditLogListParams = z.infer<typeof SettingsAuditLogListParamsSchema>;

export const SettingsAuditLogListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type SettingsAuditLogListQuery = z.infer<typeof SettingsAuditLogListQuerySchema>;

export const SettingsAuditLogListResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  items: z.array(SettingsAuditLogSchema),
});
export type SettingsAuditLogListResponse = z.infer<typeof SettingsAuditLogListResponseSchema>;
