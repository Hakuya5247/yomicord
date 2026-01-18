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
