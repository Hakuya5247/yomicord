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

// ---- Dictionary ----
// なぜ: 入力制約は API 保護（ログ肥大/負荷/保存コスト）と UI の前提を兼ねるため、contracts 側で固定する。
export const UpsertDictionaryEntryRequestSchema = z.object({
  guildId: z.string().min(1),
  word: z.string().min(1).max(64),
  yomi: z.string().min(1).max(256),
});
export type UpsertDictionaryEntryRequest = z.infer<typeof UpsertDictionaryEntryRequestSchema>;

// なぜ: 成功レスポンスも形を固定し、API 側で送信前に schema 検証できるようにする。
export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;

// ---- Voice settings (minimal) ----
// 注意: default は schema 側で確定する（複数クライアントで既定値がズレないようにする）。
export const UpdateVoiceSettingsRequestSchema = z.object({
  guildId: z.string().min(1),
  speakerId: z.number().int().nonnegative(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  volume: z.number().min(0.0).max(2.0).default(1.0),
});
export type UpdateVoiceSettingsRequest = z.infer<typeof UpdateVoiceSettingsRequestSchema>;
