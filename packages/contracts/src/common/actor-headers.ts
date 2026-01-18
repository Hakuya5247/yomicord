import { z } from 'zod';

// ---- API headers (Actor) ----
// なぜ: 更新操作の監査・認可に必要な最小情報を headers で共通化する。
/**
 * Actor 情報を含むヘッダー schema。
 */
export const ActorHeadersSchema = z
  .object({
    'x-yomicord-actor-user-id': z.string().min(1).optional(),
    'x-yomicord-actor-display-name': z.string().min(1).optional(),
    'x-yomicord-actor-source': z.enum(['command', 'api', 'system', 'migration']).optional(),
    'x-yomicord-actor-occurred-at': z.string().min(1).optional(),
    'x-yomicord-actor-role-ids': z.string().min(1).optional(),
    'x-yomicord-actor-is-admin': z.enum(['true', 'false']).optional(),
  })
  .passthrough();
export type ActorHeaders = z.infer<typeof ActorHeadersSchema>;
