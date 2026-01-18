import { z } from 'zod';

// ---- Contracts & Storage (phase1) ----
// なぜ: 設定・辞書・監査ログの唯一の正を contracts に閉じ込める。

/**
 * ギルド全体の音声設定。
 */
const GuildSettingsVoiceSchema = z.object({
  engine: z.enum(['voicevox']),
  speakerId: z.number(),
  volume: z.number(),
  speed: z.number(),
  pitch: z.number(),
  intonation: z.number(),
});

/**
 * 読み上げ対象名の設定。
 */
const GuildSettingsNameReadSchema = z.object({
  nameSource: z.enum(['NICKNAME', 'USERNAME']),
  prefix: z.string(),
  suffix: z.string(),
  repeatMode: z.enum(['ALWAYS', 'ON_CHANGE', 'COOLDOWN']),
  cooldownSec: z.number(),
  normalizeDefault: z.boolean(),
});

/**
 * 読み上げフィルタ設定。
 */
const GuildSettingsFiltersSchema = z.object({
  mentionMode: z.enum(['EXPAND', 'IGNORE', 'SAY_MENTION']),
  urlMode: z.enum(['DOMAIN_ONLY', 'FULL', 'IGNORE']),
  emojiMode: z.enum(['IGNORE', 'NAME']),
  codeBlockMode: z.enum(['SAY_CODE', 'IGNORE']),
  attachmentMode: z.enum(['TYPE_ONLY', 'IGNORE']),
  newlineMode: z.enum(['JOIN', 'PAUSE']),
});

/**
 * 読み上げの長さ制限設定。
 */
const GuildSettingsLimitsSchema = z.object({
  maxHiraganaLength: z.number(),
  overLimitAction: z.enum(['SAY_IKARYAKU', 'IGNORE']),
});

/**
 * アナウンス設定。
 */
const GuildSettingsAnnounceSchema = z.object({
  onConnect: z.boolean(),
  onStartStop: z.boolean(),
  customText: z.string().nullable(),
});

/**
 * 権限設定。
 */
const GuildSettingsPermissionsSchema = z.object({
  manageMode: z.enum(['ADMIN_ONLY', 'ROLE_BASED']),
  allowedRoleIds: z.array(z.string()),
});

/**
 * 運用通知設定。
 */
const GuildSettingsOpsNotifySchema = z.object({
  channelId: z.string().nullable(),
  levelMin: z.enum(['INFO', 'NOTICE', 'WARNING']),
});

/**
 * ギルド設定の schema。
 */
export const GuildSettingsSchema = z.object({
  voice: GuildSettingsVoiceSchema,
  nameRead: GuildSettingsNameReadSchema,
  filters: GuildSettingsFiltersSchema,
  limits: GuildSettingsLimitsSchema,
  announce: GuildSettingsAnnounceSchema,
  permissions: GuildSettingsPermissionsSchema,
  opsNotify: GuildSettingsOpsNotifySchema,
});
export type GuildSettings = z.infer<typeof GuildSettingsSchema>;

// ---- API: GuildSettings ----
// なぜ: params/body/response を contracts に固定し、API とクライアントの整合性を担保する。
/**
 * ギルド設定取得/更新のパラメータ schema。
 */
export const GuildSettingsParamsSchema = z.object({
  guildId: z.string().min(1),
});
export type GuildSettingsParams = z.infer<typeof GuildSettingsParamsSchema>;

/**
 * ギルド設定更新の body schema。
 */
export const GuildSettingsPutBodySchema = GuildSettingsSchema;
export type GuildSettingsPutBody = z.infer<typeof GuildSettingsPutBodySchema>;

/**
 * ギルド設定取得のレスポンス schema。
 */
export const GuildSettingsGetResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  settings: GuildSettingsSchema,
});
export type GuildSettingsGetResponse = z.infer<typeof GuildSettingsGetResponseSchema>;

/**
 * ギルド設定更新のレスポンス schema。
 */
export const GuildSettingsPutResponseSchema = GuildSettingsGetResponseSchema;
export type GuildSettingsPutResponse = z.infer<typeof GuildSettingsPutResponseSchema>;
