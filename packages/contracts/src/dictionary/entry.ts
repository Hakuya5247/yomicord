import { z } from 'zod';

/**
 * 辞書エントリ取得/更新のパラメータ schema。
 */
export const DictionaryEntryParamsSchema = z.object({
  guildId: z.string().min(1),
  entryId: z.string().min(1),
});
export type DictionaryEntryParams = z.infer<typeof DictionaryEntryParamsSchema>;

/**
 * 辞書一覧取得のパラメータ schema。
 */
export const DictionaryListParamsSchema = z.object({
  guildId: z.string().min(1),
});
export type DictionaryListParams = z.infer<typeof DictionaryListParamsSchema>;

/**
 * 辞書一覧取得のクエリ schema。
 */
export const DictionaryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
});
export type DictionaryListQuery = z.infer<typeof DictionaryListQuerySchema>;

/**
 * 辞書エントリ作成/更新の body schema。
 */
export const DictionaryEntryBodySchema = z.object({
  surface: z.string().min(1),
  reading: z.string().min(1),
  priority: z.number().int(),
  isEnabled: z.boolean(),
});
export type DictionaryEntryBody = z.infer<typeof DictionaryEntryBodySchema>;

/**
 * 辞書エントリの schema。
 */
export const DictionaryEntrySchema = z.object({
  id: z.string(),
  guildId: z.string(),
  surface: z.string(),
  surfaceKey: z.string(),
  reading: z.string(),
  priority: z.number().int(),
  isEnabled: z.boolean(),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntrySchema>;

/**
 * 辞書一覧のレスポンス schema。
 */
export const DictionaryListResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  items: z.array(DictionaryEntrySchema),
  nextCursor: z.string().nullable(),
});
export type DictionaryListResponse = z.infer<typeof DictionaryListResponseSchema>;

/**
 * 辞書エントリ取得/作成/更新のレスポンス schema。
 */
export const DictionaryEntryResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  entry: DictionaryEntrySchema,
});
export type DictionaryEntryResponse = z.infer<typeof DictionaryEntryResponseSchema>;

/**
 * 辞書エントリ削除のレスポンス schema。
 */
export const DictionaryEntryDeleteResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  entryId: z.string().min(1),
});
export type DictionaryEntryDeleteResponse = z.infer<typeof DictionaryEntryDeleteResponseSchema>;
