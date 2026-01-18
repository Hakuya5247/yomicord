import { z } from 'zod';

/**
 * ギルドメンバー設定のパラメータ schema。
 */
export const GuildMemberSettingsParamsSchema = z.object({
  guildId: z.string().min(1),
  userId: z.string().min(1),
});
export type GuildMemberSettingsParams = z.infer<typeof GuildMemberSettingsParamsSchema>;

/**
 * メンバー個別の音声設定。
 */
const GuildMemberVoiceSchema = z.object({
  speakerId: z.number().optional(),
  volume: z.number().optional(),
  speed: z.number().optional(),
  pitch: z.number().optional(),
  intonation: z.number().optional(),
});

/**
 * メンバー個別の読み上げ設定。
 */
const GuildMemberNameReadSchema = z.object({
  normalize: z.enum(['inherit', 'on', 'off']),
});

/**
 * メンバー設定の schema。
 */
export const GuildMemberSettingsSchema = z.object({
  voice: GuildMemberVoiceSchema.optional(),
  nameRead: GuildMemberNameReadSchema.optional(),
});
export type GuildMemberSettings = z.infer<typeof GuildMemberSettingsSchema>;

/**
 * メンバー設定更新の body schema。
 */
export const GuildMemberSettingsPutBodySchema = GuildMemberSettingsSchema;
export type GuildMemberSettingsPutBody = z.infer<typeof GuildMemberSettingsPutBodySchema>;

/**
 * メンバー設定取得のレスポンス schema。
 */
export const GuildMemberSettingsGetResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  userId: z.string().min(1),
  settings: GuildMemberSettingsSchema.nullable(),
});
export type GuildMemberSettingsGetResponse = z.infer<typeof GuildMemberSettingsGetResponseSchema>;

/**
 * メンバー設定更新のレスポンス schema。
 */
export const GuildMemberSettingsPutResponseSchema = GuildMemberSettingsGetResponseSchema;
export type GuildMemberSettingsPutResponse = z.infer<typeof GuildMemberSettingsPutResponseSchema>;

/**
 * メンバー設定削除のレスポンス schema。
 */
export const GuildMemberSettingsDeleteResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  userId: z.string().min(1),
});
export type GuildMemberSettingsDeleteResponse = z.infer<
  typeof GuildMemberSettingsDeleteResponseSchema
>;
