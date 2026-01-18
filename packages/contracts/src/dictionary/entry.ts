import { z } from 'zod';

export const DictionaryEntryParamsSchema = z.object({
  guildId: z.string().min(1),
  entryId: z.string().min(1),
});
export type DictionaryEntryParams = z.infer<typeof DictionaryEntryParamsSchema>;

export const DictionaryListParamsSchema = z.object({
  guildId: z.string().min(1),
});
export type DictionaryListParams = z.infer<typeof DictionaryListParamsSchema>;

export const DictionaryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
});
export type DictionaryListQuery = z.infer<typeof DictionaryListQuerySchema>;

export const DictionaryEntryBodySchema = z.object({
  surface: z.string().min(1),
  reading: z.string().min(1),
  priority: z.number().int(),
  isEnabled: z.boolean(),
});
export type DictionaryEntryBody = z.infer<typeof DictionaryEntryBodySchema>;

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

export const DictionaryListResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  items: z.array(DictionaryEntrySchema),
  nextCursor: z.string().nullable(),
});
export type DictionaryListResponse = z.infer<typeof DictionaryListResponseSchema>;

export const DictionaryEntryResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  entry: DictionaryEntrySchema,
});
export type DictionaryEntryResponse = z.infer<typeof DictionaryEntryResponseSchema>;

export const DictionaryEntryDeleteResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  entryId: z.string().min(1),
});
export type DictionaryEntryDeleteResponse = z.infer<typeof DictionaryEntryDeleteResponseSchema>;
