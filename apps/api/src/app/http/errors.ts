import type { FastifyInstance, FastifyReply } from 'fastify';
import { ApiErrorResponseSchema, type ApiErrorCode } from '@yomicord/contracts';

type ValidationError = { flatten: () => unknown };

export type SendError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) => FastifyReply;

export type SendValidationError = (reply: FastifyReply, error: ValidationError) => FastifyReply;

export type SendSimpleValidationError = (reply: FastifyReply, message: string) => FastifyReply;

export type ErrorHelpers = {
  sendError: SendError;
  sendValidationError: SendValidationError;
  sendSimpleValidationError: SendSimpleValidationError;
};

export function createErrorHelpers(): ErrorHelpers {
  function sendError(
    reply: FastifyReply,
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    // エラー応答も contracts で検証し、クライアントとの契約を崩さない
    const payload: unknown = {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    };

    const parsed = ApiErrorResponseSchema.safeParse(payload);
    if (!parsed.success) {
      // ここで契約違反の形を返さないための最終フォールバック
      return reply.status(500).send({
        ok: false,
        error: { code: 'INTERNAL', message: 'サーバー内部でエラーが発生しました' },
      });
    }

    return reply.status(statusCode).send(parsed.data);
  }

  function sendValidationError(reply: FastifyReply, error: ValidationError) {
    return sendError(reply, 400, 'VALIDATION_FAILED', 'リクエストが不正です', error.flatten());
  }

  function sendSimpleValidationError(reply: FastifyReply, message: string) {
    return sendValidationError(reply, {
      flatten: () => ({ formErrors: [message], fieldErrors: {} }),
    });
  }

  return { sendError, sendValidationError, sendSimpleValidationError };
}

export function registerNotFoundHandler(app: FastifyInstance, sendError: SendError) {
  app.setNotFoundHandler(async (_req, reply) => {
    return sendError(reply, 404, 'NOT_FOUND', 'エンドポイントが見つかりません');
  });
}

export function registerErrorHandler(app: FastifyInstance, sendError: SendError) {
  app.setErrorHandler(async (err, _req, reply) => {
    // 例外の詳細はログへ（レスポンスには出さない）
    app.log.error({ err }, 'API で想定外のエラーが発生しました');

    const maybeStatusCode = (err as { statusCode?: unknown })?.statusCode;
    const statusCode = typeof maybeStatusCode === 'number' ? maybeStatusCode : 500;

    // なぜ: statusCode から contracts の error code に寄せ、クライアント側の分岐を安定させる。
    if (statusCode === 400) {
      return sendError(reply, 400, 'VALIDATION_FAILED', 'リクエストが不正です');
    }
    if (statusCode === 401) {
      return sendError(reply, 401, 'UNAUTHORIZED', '認証が必要です');
    }
    if (statusCode === 403) {
      return sendError(reply, 403, 'FORBIDDEN', '権限がありません');
    }
    if (statusCode === 404) {
      return sendError(reply, 404, 'NOT_FOUND', '見つかりません');
    }
    if (statusCode === 409) {
      return sendError(reply, 409, 'CONFLICT', '競合が発生しました');
    }

    return sendError(reply, 500, 'INTERNAL', 'サーバー内部でエラーが発生しました');
  });
}
