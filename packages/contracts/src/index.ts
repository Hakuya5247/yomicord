import { z } from 'zod';

// ---- Common error response (API) ----
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

// zod の flatten() 互換（fieldErrors は string[] のみを許容）
export const ValidationErrorDetailsSchema = z.object({
  formErrors: z.array(z.string()),
  fieldErrors: z.record(z.array(z.string())),
});
export type ValidationErrorDetails = z.infer<typeof ValidationErrorDetailsSchema>;

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
