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

  /**
   * 辞書表記キーの重複を示すエラーを生成する。
   * @param guildId - ギルド ID。
   * @param surfaceKey - 正規化された表記キー。
   */
  constructor(guildId: string, surfaceKey: string) {
    super(`Duplicate surfaceKey: ${surfaceKey}`);
    this.name = 'DuplicateSurfaceKeyError';
    this.guildId = guildId;
    this.surfaceKey = surfaceKey;
  }
}

export class InvalidCursorError extends Error {
  readonly cursor: string;

  /**
   * カーソル不正を示すエラーを生成する。
   * @param cursor - 不正なカーソル値。
   */
  constructor(cursor: string) {
    super(`Invalid cursor: ${cursor}`);
    this.name = 'InvalidCursorError';
    this.cursor = cursor;
  }
}

export class DictionaryEntryNotFoundError extends Error {
  readonly entryId: string;

  /**
   * 辞書エントリが存在しないことを示すエラーを生成する。
   * @param entryId - 対象エントリ ID。
   */
  constructor(entryId: string) {
    super(`Dictionary entry not found: ${entryId}`);
    this.name = 'DictionaryEntryNotFoundError';
    this.entryId = entryId;
  }
}

/**
 * ギルド設定の永続化ストア契約。
 */
export interface GuildSettingsStore {
  /**
   * 指定 guildId の設定を取得。存在しない場合はデフォルト値で新規作成。
   * - デフォルト値は contracts の defaults ヘルパーから取得
   * - 既存データにフィールド不足がある場合は読み出し時に migrate/normalize
   */
  getOrCreate(guildId: string): Promise<GuildSettings>;
  /**
   * ギルド設定を更新する。
   * @param guildId - ギルド ID。
   * @param next - 更新後の設定。
   * @param actor - 操作主体。
   */
  update(guildId: string, next: GuildSettings, actor: Actor): Promise<void>;
}

/**
 * ギルドメンバー設定の永続化ストア契約。
 */
export interface GuildMemberSettingsStore {
  /**
   * メンバー設定を取得する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   */
  get(guildId: string, userId: string): Promise<GuildMemberSettings | null>;
  /**
   * メンバー設定を作成または更新する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   * @param partial - 変更対象の設定。
   * @param actor - 操作主体。
   */
  upsert(
    guildId: string,
    userId: string,
    partial: GuildMemberSettings,
    actor: Actor,
  ): Promise<void>;
  /**
   * メンバー設定を削除する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   * @param actor - 操作主体。
   */
  delete(guildId: string, userId: string, actor: Actor): Promise<void>;
}

/**
 * 辞書エントリの永続化ストア契約。
 */
export interface DictionaryStore {
  /**
   * 辞書エントリ一覧を取得する。
   * @param guildId - ギルド ID。
   * @param options.limit - 最大件数。
   * @param options.cursor - 取得開始位置。
   */
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

  /**
   * 辞書エントリを取得する。
   * @param guildId - ギルド ID。
   * @param entryId - エントリ ID。
   */
  getById(guildId: string, entryId: string): Promise<DictionaryEntry | null>;

  /**
   * 辞書エントリを新規作成。
   * @throws DuplicateSurfaceKeyError - guildId + surfaceKey が既に存在する場合
   */
  create(guildId: string, entry: DictionaryEntry, actor: Actor): Promise<void>;

  /**
   * 辞書エントリを上書き更新する。
   * @param guildId - ギルド ID。
   * @param entryId - エントリ ID。
   * @param next - 更新後のエントリ。
   * @param actor - 操作主体。
   */
  replace(guildId: string, entryId: string, next: DictionaryEntry, actor: Actor): Promise<void>;

  /**
   * 辞書エントリを削除する。
   * @param guildId - ギルド ID。
   * @param entryId - エントリ ID。
   * @param actor - 操作主体。
   */
  delete(guildId: string, entryId: string, actor: Actor): Promise<void>;
}

/**
 * 監査ログの永続化ストア契約。
 */
export interface AuditLogStore {
  /**
   * 監査ログを追記する。
   * @param log - 監査ログ。
   */
  append(log: SettingsAuditLog): Promise<void>;

  /**
   * 指定 guildId の監査ログを取得。
   * @returns createdAt 降順（新しい順）で最大 limit 件
   */
  listByGuild(guildId: string, limit: number): Promise<SettingsAuditLog[]>;
}
