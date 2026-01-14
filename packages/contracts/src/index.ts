import { z } from 'zod';

// なぜ: API 入出力の唯一の真実（SSoT）。apps/api と apps/bot が同じ schema を参照して契約を固定する。
// 注意: ここには HTTP 実装や DB 実装を置かず、schema と型だけを置く。

// ---- Common error response (API) ----
// なぜ: 失敗時も code で分岐できる形にして、クライアント側の例外処理を単純にする。
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL',
] as const;

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

const ApiNonValidationErrorCodeSchema = ApiErrorCodeSchema.exclude(['VALIDATION_FAILED']);

// なぜ: zod の flatten() 互換。フォームUI等が扱いやすい形（fieldErrors: string[]）に寄せる。
// 注意: fieldErrors は string[] のみを許容（unknown にするとクライアントが防御的になりすぎる）。
export const ValidationErrorDetailsSchema = z.object({
  formErrors: z.array(z.string()),
  fieldErrors: z.record(z.array(z.string())),
});
export type ValidationErrorDetails = z.infer<typeof ValidationErrorDetailsSchema>;

// なぜ: code で discriminated union にして、クライアント側の switch が安全に書けるようにする。
export const ApiErrorSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('VALIDATION_FAILED'),
    message: z.string().min(1),
    details: ValidationErrorDetailsSchema.optional(),
  }),
  z.object({
    code: ApiNonValidationErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
]);
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: ApiErrorSchema,
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// なぜ: 成功レスポンスも形を固定し、API 側で送信前に schema 検証できるようにする。
export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;

// ---- API headers (Actor) ----
// なぜ: 更新操作の監査・認可に必要な最小情報を headers で共通化する。
export const ActorHeadersSchema = z
  .object({
    'x-yomicord-actor-user-id': z.string().min(1).optional(),
    'x-yomicord-actor-display-name': z.string().min(1).optional(),
    'x-yomicord-actor-source': z.enum(['command', 'api', 'system', 'migration']).optional(),
    'x-yomicord-actor-occurred-at': z.string().min(1).optional(),
  })
  .passthrough();
export type ActorHeaders = z.infer<typeof ActorHeadersSchema>;

// ---- Contracts & Storage (phase1) ----
// なぜ: 設定・辞書・監査ログの唯一の正を contracts に閉じ込める。

const GuildSettingsVoiceSchema = z.object({
  engine: z.enum(['voicevox']),
  speakerId: z.number(),
  volume: z.number(),
  speed: z.number(),
  pitch: z.number(),
  intonation: z.number(),
});

const GuildSettingsNameReadSchema = z.object({
  nameSource: z.enum(['NICKNAME', 'USERNAME']),
  prefix: z.string(),
  suffix: z.string(),
  repeatMode: z.enum(['ALWAYS', 'ON_CHANGE', 'COOLDOWN']),
  cooldownSec: z.number(),
  normalizeDefault: z.boolean(),
});

const GuildSettingsFiltersSchema = z.object({
  mentionMode: z.enum(['EXPAND', 'IGNORE', 'SAY_MENTION']),
  urlMode: z.enum(['DOMAIN_ONLY', 'FULL', 'IGNORE']),
  emojiMode: z.enum(['IGNORE', 'NAME']),
  codeBlockMode: z.enum(['SAY_CODE', 'IGNORE']),
  attachmentMode: z.enum(['TYPE_ONLY', 'IGNORE']),
  newlineMode: z.enum(['JOIN', 'PAUSE']),
});

const GuildSettingsLimitsSchema = z.object({
  maxHiraganaLength: z.number(),
  overLimitAction: z.enum(['SAY_IKARYAKU', 'IGNORE']),
});

const GuildSettingsAnnounceSchema = z.object({
  onConnect: z.boolean(),
  onStartStop: z.boolean(),
  customText: z.string().nullable(),
});

const GuildSettingsPermissionsSchema = z.object({
  manageMode: z.enum(['ADMIN_ONLY', 'ROLE_BASED']),
  allowedRoleIds: z.array(z.string()),
});

const GuildSettingsOpsNotifySchema = z.object({
  channelId: z.string().nullable(),
  levelMin: z.enum(['INFO', 'NOTICE', 'WARNING']),
});

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
export const GuildSettingsParamsSchema = z.object({
  guildId: z.string().min(1),
});
export type GuildSettingsParams = z.infer<typeof GuildSettingsParamsSchema>;

export const GuildMemberSettingsParamsSchema = z.object({
  guildId: z.string().min(1),
  userId: z.string().min(1),
});
export type GuildMemberSettingsParams = z.infer<typeof GuildMemberSettingsParamsSchema>;

export const GuildSettingsPutBodySchema = GuildSettingsSchema;
export type GuildSettingsPutBody = z.infer<typeof GuildSettingsPutBodySchema>;

export const GuildSettingsGetResponseSchema = z.object({
  ok: z.literal(true),
  guildId: z.string().min(1),
  settings: GuildSettingsSchema,
});
export type GuildSettingsGetResponse = z.infer<typeof GuildSettingsGetResponseSchema>;

export const GuildSettingsPutResponseSchema = GuildSettingsGetResponseSchema;
export type GuildSettingsPutResponse = z.infer<typeof GuildSettingsPutResponseSchema>;

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

export const DictionaryEntrySchema = z.object({
  id: z.string(),
  guildId: z.string(),
  surface: z.string(),
  surfaceKey: z.string(),
  reading: z.string(),
  priority: z.number(),
  isEnabled: z.boolean(),
});
export type DictionaryEntry = z.infer<typeof DictionaryEntrySchema>;

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

export type Actor = {
  userId: string | null;
  displayName?: string | null;
  source: 'command' | 'api' | 'system' | 'migration';
  occurredAt: string;
};

export const createDefaultGuildSettings = (): GuildSettings => ({
  voice: {
    engine: 'voicevox',
    speakerId: 1,
    volume: 1.0,
    speed: 1.0,
    pitch: 0.0,
    intonation: 1.0,
  },
  nameRead: {
    nameSource: 'NICKNAME',
    prefix: '',
    suffix: 'さん',
    repeatMode: 'ON_CHANGE',
    cooldownSec: 120,
    normalizeDefault: true,
  },
  filters: {
    mentionMode: 'EXPAND',
    urlMode: 'DOMAIN_ONLY',
    emojiMode: 'IGNORE',
    codeBlockMode: 'SAY_CODE',
    attachmentMode: 'TYPE_ONLY',
    newlineMode: 'JOIN',
  },
  limits: {
    maxHiraganaLength: 120,
    overLimitAction: 'SAY_IKARYAKU',
  },
  announce: {
    onConnect: true,
    onStartStop: false,
    customText: null,
  },
  permissions: {
    manageMode: 'ADMIN_ONLY',
    allowedRoleIds: [],
  },
  opsNotify: {
    channelId: null,
    levelMin: 'NOTICE',
  },
});

export const normalizeSurface = (surface: string): string => {
  // TODO(test): 正規化の順序と空白圧縮の挙動を検証する。
  const normalized = surface.normalize('NFKC').trim();
  const lowercased = normalized.toLowerCase();
  return lowercased.replace(/\s+/g, ' ');
};

export const canonicalizeGuildMemberSettings = (
  settings: GuildMemberSettings,
): GuildMemberSettings | null => {
  // TODO(test): 空オブジェクトや inherit の削除が行われることを検証する。
  const parsed = GuildMemberSettingsSchema.parse(settings);
  const next: GuildMemberSettings = {};

  if (parsed.voice) {
    const voice: NonNullable<GuildMemberSettings['voice']> = {};
    if (parsed.voice.speakerId !== undefined) {
      voice.speakerId = parsed.voice.speakerId;
    }
    if (parsed.voice.volume !== undefined) {
      voice.volume = parsed.voice.volume;
    }
    if (parsed.voice.speed !== undefined) {
      voice.speed = parsed.voice.speed;
    }
    if (parsed.voice.pitch !== undefined) {
      voice.pitch = parsed.voice.pitch;
    }
    if (parsed.voice.intonation !== undefined) {
      voice.intonation = parsed.voice.intonation;
    }
    if (Object.keys(voice).length > 0) {
      next.voice = voice;
    }
  }

  if (parsed.nameRead) {
    if (parsed.nameRead.normalize !== 'inherit') {
      next.nameRead = { normalize: parsed.nameRead.normalize };
    }
  }

  if (Object.keys(next).length === 0) {
    return null;
  }

  return next;
};
