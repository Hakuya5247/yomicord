import type { FastifyInstance, FastifyReply } from 'fastify';
import { ApiErrorResponseSchema, type ApiErrorCode } from '@yomicord/contracts';

type ValidationError = { flatten: () => unknown };

/**
 * エラー応答を構築して返す関数の型。
 */
export type SendError = (
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) => FastifyReply;

/**
 * バリデーションエラーを応答する関数の型。
 */
export type SendValidationError = (reply: FastifyReply, error: ValidationError) => FastifyReply;

/**
 * 文字列メッセージだけで簡易バリデーションエラーを返す関数の型。
 */
export type SendSimpleValidationError = (reply: FastifyReply, message: string) => FastifyReply;

/**
 * エラーヘルパー群の契約。
 */
export type ErrorHelpers = {
  sendError: SendError;
  sendValidationError: SendValidationError;
  sendSimpleValidationError: SendSimpleValidationError;
};

/**
 * API エラーハンドリングに必要なヘルパーを生成する。
 */
export function createErrorHelpers(): ErrorHelpers {
  /**
   * contracts と整合するエラー応答を返す。
   * @param reply - Fastify の返信オブジェクト。
   * @param statusCode - HTTP ステータスコード。
   * @param code - contracts のエラーコード。
   * @param message - ユーザー向けメッセージ。
   * @param details - 追加情報（契約に含める場合のみ）。
   */
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

  /**
   * バリデーションエラーを contracts に沿って返す。
   * @param reply - Fastify の返信オブジェクト。
   * @param error - zod のエラー情報。
   */
  function sendValidationError(reply: FastifyReply, error: ValidationError) {
    return sendError(reply, 400, 'VALIDATION_FAILED', 'リクエストが不正です', error.flatten());
  }

  /**
   * 文字列メッセージだけの簡易バリデーションエラーを返す。
   * @param reply - Fastify の返信オブジェクト。
   * @param message - 表示するエラーメッセージ。
   */
  function sendSimpleValidationError(reply: FastifyReply, message: string) {
    return sendValidationError(reply, {
      flatten: () => ({ formErrors: [message], fieldErrors: {} }),
    });
  }

  return { sendError, sendValidationError, sendSimpleValidationError };
}

/**
 * 404 の既定ハンドラを登録する。
 * @param app - Fastify インスタンス。
 * @param sendError - エラー応答関数。
 */
export function registerNotFoundHandler(app: FastifyInstance, sendError: SendError) {
  app.setNotFoundHandler(async (_req, reply) => {
    return sendError(reply, 404, 'NOT_FOUND', 'エンドポイントが見つかりません');
  });
}

/**
 * 例外ハンドラを登録し、contracts に沿ったエラー応答へ寄せる。
 * @param app - Fastify インスタンス。
 * @param sendError - エラー応答関数。
 */
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
