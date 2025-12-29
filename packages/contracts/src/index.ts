import { z } from 'zod';

// ---- Dictionary ----
export const UpsertDictionaryEntryRequestSchema = z.object({
  guildId: z.string().min(1),
  word: z.string().min(1).max(64),
  yomi: z.string().min(1).max(256),
});
export type UpsertDictionaryEntryRequest = z.infer<typeof UpsertDictionaryEntryRequestSchema>;

export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;

// ---- Voice settings (minimal) ----
export const UpdateVoiceSettingsRequestSchema = z.object({
  guildId: z.string().min(1),
  speakerId: z.number().int().nonnegative(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  volume: z.number().min(0.0).max(2.0).default(1.0),
});
export type UpdateVoiceSettingsRequest = z.infer<typeof UpdateVoiceSettingsRequestSchema>;
