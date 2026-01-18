import type { Actor } from '@yomicord/contracts/internal';
import type {
  DictionaryEntry,
  GuildMemberSettings,
  GuildSettings,
  SettingsAuditLog,
} from '@yomicord/contracts';

export class DuplicateSurfaceKeyError extends Error {
  readonly guildId: string;
  readonly surfaceKey: string;

  constructor(guildId: string, surfaceKey: string) {
    super(`Duplicate surfaceKey: ${surfaceKey}`);
    this.name = 'DuplicateSurfaceKeyError';
    this.guildId = guildId;
    this.surfaceKey = surfaceKey;
  }
}

export class InvalidCursorError extends Error {
  readonly cursor: string;

  constructor(cursor: string) {
    super(`Invalid cursor: ${cursor}`);
    this.name = 'InvalidCursorError';
    this.cursor = cursor;
  }
}

export class DictionaryEntryNotFoundError extends Error {
  readonly entryId: string;

  constructor(entryId: string) {
    super(`Dictionary entry not found: ${entryId}`);
    this.name = 'DictionaryEntryNotFoundError';
    this.entryId = entryId;
  }
}

export interface GuildSettingsStore {
  /**
   * 指定 guildId の設定を取得。存在しない場合はデフォルト値で新規作成。
   * - デフォルト値は contracts の defaults ヘルパーから取得
   * - 既存データにフィールド不足がある場合は読み出し時に migrate/normalize
   */
  getOrCreate(guildId: string): Promise<GuildSettings>;
  update(guildId: string, next: GuildSettings, actor: Actor): Promise<void>;
}

export interface GuildMemberSettingsStore {
  get(guildId: string, userId: string): Promise<GuildMemberSettings | null>;
  upsert(
    guildId: string,
    userId: string,
    partial: GuildMemberSettings,
    actor: Actor,
  ): Promise<void>;
  delete(guildId: string, userId: string, actor: Actor): Promise<void>;
}

export interface DictionaryStore {
  listByGuild(
    guildId: string,
    options: {
      limit: number;
      cursor?: string | null;
    },
  ): Promise<{
    items: DictionaryEntry[];
    nextCursor: string | null;
  }>;

  getById(guildId: string, entryId: string): Promise<DictionaryEntry | null>;

  /**
   * 辞書エントリを新規作成。
   * @throws DuplicateSurfaceKeyError - guildId + surfaceKey が既に存在する場合
   */
  create(guildId: string, entry: DictionaryEntry, actor: Actor): Promise<void>;

  replace(guildId: string, entryId: string, next: DictionaryEntry, actor: Actor): Promise<void>;

  delete(guildId: string, entryId: string, actor: Actor): Promise<void>;
}

export interface AuditLogStore {
  append(log: SettingsAuditLog): Promise<void>;

  /**
   * 指定 guildId の監査ログを取得。
   * @returns createdAt 降順（新しい順）で最大 limit 件
   */
  listByGuild(guildId: string, limit: number): Promise<SettingsAuditLog[]>;
}
