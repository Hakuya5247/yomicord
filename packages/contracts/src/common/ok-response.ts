import { z } from 'zod';

// なぜ: 成功レスポンスも形を固定し、API 側で送信前に schema 検証できるようにする。
export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;
