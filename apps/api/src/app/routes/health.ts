import type { FastifyInstance } from 'fastify';

/**
 * ヘルスチェック用のルートを登録する。
 * @param app - Fastify インスタンス。
 */
export function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));
}
