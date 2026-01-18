import Fastify from 'fastify';
import {
  JsonAuditLogStore,
  JsonDictionaryStore,
  JsonGuildMemberSettingsStore,
  JsonGuildSettingsStore,
} from '@yomicord/storage-json';

import { createAuditLogHelpers } from './app/audit-log.js';
import type { AppHelpers, AppStores } from './app/internal/deps.js';
import { createActorHelpers } from './app/http/actor.js';
import {
  createErrorHelpers,
  registerErrorHandler,
  registerNotFoundHandler,
} from './app/http/errors.js';
import { createPermissionHelpers } from './app/http/permissions.js';
import { registerAuditLogRoutes } from './app/routes/audit-logs.js';
import { registerDictionaryRoutes } from './app/routes/dictionary.js';
import { registerGuildMemberSettingsRoutes } from './app/routes/guild-member-settings.js';
import { registerGuildSettingsRoutes } from './app/routes/guild-settings.js';
import { registerHealthRoutes } from './app/routes/health.js';

type AppOptions = {
  dataDir?: string;
};

/**
 * API アプリを生成する。
 * @param options.dataDir - JSON ストアの保存先。未指定なら環境変数/デフォルトを使う。
 * @returns Fastify アプリ。
 */
export function createApp(options: AppOptions = {}) {
  // なぜ: API は入力検証・エラー整形・永続化（将来）を担う単一の更新窓口。
  // 注意: Bot/Web は DB に触れず、必ずこの API を経由する。
  const app = Fastify({ logger: true });
  const dataDir = options.dataDir ?? process.env.YOMICORD_DATA_DIR ?? '/data';

  const stores: AppStores = {
    guildSettingsStore: new JsonGuildSettingsStore(dataDir),
    guildMemberSettingsStore: new JsonGuildMemberSettingsStore(dataDir),
    dictionaryStore: new JsonDictionaryStore(dataDir),
    auditLogStore: new JsonAuditLogStore(dataDir),
  };

  const errorHelpers = createErrorHelpers();
  const helpers: AppHelpers = {
    auditLog: createAuditLogHelpers({ auditLogStore: stores.auditLogStore, log: app.log }),
    actor: createActorHelpers(),
    error: errorHelpers,
    permission: createPermissionHelpers(errorHelpers.sendError),
  };

  registerNotFoundHandler(app, helpers.error.sendError);
  registerErrorHandler(app, helpers.error.sendError);

  registerHealthRoutes(app);
  registerGuildSettingsRoutes(app, { stores, helpers });
  registerGuildMemberSettingsRoutes(app, { stores, helpers });
  registerDictionaryRoutes(app, { stores, helpers });
  registerAuditLogRoutes(app, { stores, helpers });

  return app;
}
