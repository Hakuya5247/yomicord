import { z } from 'zod';

export const GuildMemberSettingsParamsSchema = z.object({
  guildId: z.string().min(1),
  userId: z.string().min(1),
});
export type GuildMemberSettingsParams = z.infer<typeof GuildMemberSettingsParamsSchema>;

const GuildMemberVoiceSchema = z.object({
  speakerId: z.number().optional(),
  volume: z.number().optional(),
  speed: z.number().optional(),
  pitch: z.number().optional(),
  intonation: z.number().optional(),
});

const GuildMemberNameReadSchema = z.object({
  normalize: z.enum(['inherit', 'on', 'off']),
});

export const GuildMemberSettingsSchema = z.object({
  voice: GuildMemberVoiceSchema.optional(),
  nameRead: GuildMemberNameReadSchema.optional(),
});
export type GuildMemberSettings = z.infer<typeof GuildMemberSettingsSchema>;

export const GuildMemberSettingsPutBodySchema = GuildMemberSettingsSchema;
export type GuildMemberSettingsPutBody = z.infer<typeof GuildMemberSettingsPutBodySchema>;

export const GuildMemberSettingsGetResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  userId: z.string().min(1),
  settings: GuildMemberSettingsSchema.nullable(),
});
export type GuildMemberSettingsGetResponse = z.infer<typeof GuildMemberSettingsGetResponseSchema>;

export const GuildMemberSettingsPutResponseSchema = GuildMemberSettingsGetResponseSchema;
export type GuildMemberSettingsPutResponse = z.infer<typeof GuildMemberSettingsPutResponseSchema>;

export const GuildMemberSettingsDeleteResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  userId: z.string().min(1),
});
export type GuildMemberSettingsDeleteResponse = z.infer<
  typeof GuildMemberSettingsDeleteResponseSchema
>;
