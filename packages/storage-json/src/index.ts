import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  canonicalizeGuildMemberSettings,
  createDefaultGuildSettings,
} from '@yomicord/contracts/internal';
import {
  DictionaryEntrySchema,
  GuildMemberSettingsSchema,
  GuildSettingsSchema,
  SettingsAuditLogSchema,
} from '@yomicord/contracts';
import type { Actor } from '@yomicord/contracts/internal';
import type {
  DictionaryEntry,
  GuildMemberSettings,
  GuildSettings,
  SettingsAuditLog,
} from '@yomicord/contracts';
import {
  DuplicateSurfaceKeyError,
  DictionaryEntryNotFoundError,
  InvalidCursorError,
  type AuditLogStore,
  type DictionaryStore,
  type GuildMemberSettingsStore,
  type GuildSettingsStore,
} from '@yomicord/storage';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * プレーンなオブジェクトかどうかを判定する。
 * @param value - 判定対象。
 * @returns プレーンオブジェクトなら true。
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * 既存値にデフォルト値をマージする。
 * @param value - 保存済みの値。
 * @param defaults - デフォルト値。
 * @returns デフォルト値で補完された値。
 */
const mergeWithDefaults = <T>(value: unknown, defaults: T): T => {
  if (value === undefined || value === null) {
    return defaults;
  }

  if (!isPlainObject(defaults)) {
    if (Array.isArray(defaults)) {
      return (Array.isArray(value) ? (value as T) : defaults) as T;
    }
    return value as T;
  }

  const result: Record<string, unknown> = { ...(isPlainObject(value) ? value : {}) };
  for (const [key, defaultValue] of Object.entries(defaults as Record<string, unknown>)) {
    const current = result[key];
    if (current === undefined) {
      result[key] = defaultValue;
      continue;
    }
    if (isPlainObject(defaultValue)) {
      result[key] = mergeWithDefaults(current, defaultValue);
      continue;
    }
    if (Array.isArray(defaultValue)) {
      result[key] = Array.isArray(current) ? current : defaultValue;
    }
  }
  return result as T;
};

/**
 * パスごとの排他処理を直列化する簡易ミューテックス。
 */
class MutexMap {
  private tails = new Map<string, Promise<void>>();

  /**
   * 同じ key の処理を直列化して実行する。
   * @param key - 排他対象のキー。
   * @param fn - 実行する処理。
   * @returns fn の結果。
   */
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const tail = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const newTail = tail.then(() => next);
    this.tails.set(key, newTail);
    await tail;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === newTail) {
        this.tails.delete(key);
      }
    }
  }
}

/**
 * JSON ファイルを読み込む。存在しない場合は null を返す。
 * @param filePath - 対象ファイルパス。
 * @returns JSON の値または null。
 */
const readJsonFile = async (filePath: string): Promise<JsonValue | null> => {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as JsonValue;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

/**
 * JSON を一時ファイル経由で安全に書き込む。
 * @param filePath - 書き込み先パス。
 * @param data - 保存する JSON 値。
 */
const writeJsonAtomic = async (filePath: string, data: JsonValue): Promise<void> => {
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, filePath);
};

/**
 * ファイルが存在すれば削除する。
 * @param filePath - 対象ファイルパス。
 */
const deleteFileIfExists = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
};

/**
 * JSON Lines 形式を読み込む。存在しない場合は null を返す。
 * @param filePath - 対象ファイルパス。
 * @returns 行ごとの JSON 配列または null。
 */
const readJsonLines = async (filePath: string): Promise<unknown[] | null> => {
  try {
    const text = (await fs.readFile(filePath, 'utf8')) as string;
    const lines = text.split('\n').filter((line: string) => line.trim().length > 0);
    return lines.map((line: string) => JSON.parse(line));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const dataPaths = {
  guildSettings: (dataDir: string, guildId: string) =>
    path.join(dataDir, 'guild-settings', `${guildId}.json`),
  guildMemberSettings: (dataDir: string, guildId: string, userId: string) =>
    path.join(dataDir, 'guild-members', guildId, `${userId}.json`),
  dictionary: (dataDir: string, guildId: string) =>
    path.join(dataDir, 'dictionary', `${guildId}.json`),
  audit: (dataDir: string, guildId: string) => path.join(dataDir, 'audit', `${guildId}.log.jsonl`),
};

/**
 * JSON ファイルでギルド設定を管理するストア。
 */
export class JsonGuildSettingsStore implements GuildSettingsStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  /**
   * @param dataDir - JSON の保存先ディレクトリ。
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * ギルド設定を取得または初期化する。
   * @param guildId - ギルド ID。
   */
  async getOrCreate(guildId: string): Promise<GuildSettings> {
    const filePath = dataPaths.guildSettings(this.dataDir, guildId);
    return this.mutex.runExclusive(filePath, async () => {
      const raw = await readJsonFile(filePath);
      const defaults = createDefaultGuildSettings();
      if (raw === null) {
        const created = GuildSettingsSchema.parse(defaults);
        await writeJsonAtomic(filePath, created as JsonValue);
        return created;
      }
      const merged = mergeWithDefaults(raw, defaults);
      const normalized = GuildSettingsSchema.parse(merged);
      await writeJsonAtomic(filePath, normalized as JsonValue);
      return normalized;
    });
  }

  /**
   * ギルド設定を更新する。
   * @param guildId - ギルド ID。
   * @param next - 更新後の設定。
   * @param _actor - 操作主体（現状は未使用）。
   */
  async update(guildId: string, next: GuildSettings, _actor: Actor): Promise<void> {
    const filePath = dataPaths.guildSettings(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const parsed = GuildSettingsSchema.parse(next);
      await writeJsonAtomic(filePath, parsed as JsonValue);
    });
  }
}

/**
 * JSON ファイルでギルドメンバー設定を管理するストア。
 */
export class JsonGuildMemberSettingsStore implements GuildMemberSettingsStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  /**
   * @param dataDir - JSON の保存先ディレクトリ。
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * メンバー設定を取得する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   */
  async get(guildId: string, userId: string): Promise<GuildMemberSettings | null> {
    const filePath = dataPaths.guildMemberSettings(this.dataDir, guildId, userId);
    return this.mutex.runExclusive(filePath, async () => {
      const raw = await readJsonFile(filePath);
      if (raw === null) {
        return null;
      }
      return GuildMemberSettingsSchema.parse(raw);
    });
  }

  /**
   * メンバー設定を作成または更新する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   * @param partial - 部分設定。
   * @param _actor - 操作主体（現状は未使用）。
   */
  async upsert(
    guildId: string,
    userId: string,
    partial: GuildMemberSettings,
    _actor: Actor,
  ): Promise<void> {
    const filePath = dataPaths.guildMemberSettings(this.dataDir, guildId, userId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const canonical = canonicalizeGuildMemberSettings(partial);
      if (!canonical) {
        await deleteFileIfExists(filePath);
        return;
      }
      const parsed = GuildMemberSettingsSchema.parse(canonical);
      await writeJsonAtomic(filePath, parsed as JsonValue);
    });
  }

  /**
   * メンバー設定を削除する。
   * @param guildId - ギルド ID。
   * @param userId - ユーザー ID。
   * @param _actor - 操作主体（現状は未使用）。
   */
  async delete(guildId: string, userId: string, _actor: Actor): Promise<void> {
    const filePath = dataPaths.guildMemberSettings(this.dataDir, guildId, userId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      await deleteFileIfExists(filePath);
    });
  }
}

/**
 * JSON ファイルで辞書エントリを管理するストア。
 */
export class JsonDictionaryStore implements DictionaryStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  /**
   * @param dataDir - JSON の保存先ディレクトリ。
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * ページング用カーソルを生成する。
   * @param entry - 対象エントリ。
   */
  private static buildCursor(entry: DictionaryEntry): string {
    const raw = `${entry.priority}:${entry.surface.length}:${entry.id}`;
    return Buffer.from(raw, 'utf8').toString('base64');
  }

  /**
   * カーソル文字列を解析する。
   * @param cursor - カーソル文字列。
   * @returns 解析結果。
   * @throws InvalidCursorError - 形式が不正な場合。
   */
  private static parseCursor(cursor: string): {
    priority: number;
    surfaceLength: number;
    id: string;
  } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [priorityRaw, surfaceLengthRaw, id] = decoded.split(':');
      const priority = Number(priorityRaw);
      const surfaceLength = Number(surfaceLengthRaw);
      if (!id || Number.isNaN(priority) || Number.isNaN(surfaceLength)) {
        throw new InvalidCursorError(cursor);
      }
      return { priority, surfaceLength, id };
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        throw error;
      }
      throw new InvalidCursorError(cursor);
    }
  }

  /**
   * 辞書エントリのソート順を比較する。
   * @param a - 比較対象 A。
   * @param b - 比較対象 B。
   * @returns 並び順。
   */
  private static compareEntries(a: DictionaryEntry, b: DictionaryEntry): number {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    const aLength = a.surface.length;
    const bLength = b.surface.length;
    if (aLength !== bLength) {
      return bLength - aLength;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  }

  /**
   * 辞書エントリの一覧を読み込む。
   * @param filePath - 対象ファイルパス。
   */
  private async readEntries(filePath: string): Promise<DictionaryEntry[]> {
    const raw = await readJsonFile(filePath);
    if (raw === null) {
      return [];
    }
    return DictionaryEntrySchema.array().parse(raw);
  }

  async listByGuild(
    guildId: string,
    options: { limit: number; cursor?: string | null },
  ): Promise<{ items: DictionaryEntry[]; nextCursor: string | null }> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    return this.mutex.runExclusive(filePath, async () => {
      const entries = await this.readEntries(filePath);
      const sorted = entries.slice().sort(JsonDictionaryStore.compareEntries);
      let startIndex = 0;
      if (options.cursor) {
        const cursorKey = JsonDictionaryStore.parseCursor(options.cursor);
        const cursorIndex = sorted.findIndex(
          (entry) =>
            entry.priority === cursorKey.priority &&
            entry.surface.length === cursorKey.surfaceLength &&
            entry.id === cursorKey.id,
        );
        if (cursorIndex === -1) {
          throw new InvalidCursorError(options.cursor);
        }
        startIndex = cursorIndex + 1;
      }
      const page = sorted.slice(startIndex, startIndex + options.limit);
      const hasMore = startIndex + options.limit < sorted.length;
      return {
        items: page,
        nextCursor:
          hasMore && page.length > 0 ? JsonDictionaryStore.buildCursor(page.at(-1)!) : null,
      };
    });
  }

  /**
   * 辞書エントリを取得する。
   * @param guildId - ギルド ID。
   * @param entryId - エントリ ID。
   */
  async getById(guildId: string, entryId: string): Promise<DictionaryEntry | null> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    return this.mutex.runExclusive(filePath, async () => {
      const entries = await this.readEntries(filePath);
      const found = entries.find((item) => item.id === entryId);
      return found ?? null;
    });
  }

  /**
   * 辞書エントリを作成する。
   * @param guildId - ギルド ID。
   * @param entry - エントリ。
   * @param _actor - 操作主体（現状は未使用）。
   * @throws DuplicateSurfaceKeyError - surfaceKey が重複している場合。
   */
  async create(guildId: string, entry: DictionaryEntry, _actor: Actor): Promise<void> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const entries = await this.readEntries(filePath);
      if (entries.some((item) => item.surfaceKey === entry.surfaceKey)) {
        // TODO(test): surfaceKey の重複時に DuplicateSurfaceKeyError になることを検証する。
        throw new DuplicateSurfaceKeyError(guildId, entry.surfaceKey);
      }
      const parsedEntry = DictionaryEntrySchema.parse(entry);
      const next = [...entries, parsedEntry];
      await writeJsonAtomic(filePath, DictionaryEntrySchema.array().parse(next) as JsonValue);
    });
  }

  async replace(
    guildId: string,
    entryId: string,
    nextEntry: DictionaryEntry,
    _actor: Actor,
  ): Promise<void> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const entries = await this.readEntries(filePath);
      const index = entries.findIndex((item) => item.id === entryId);
      if (index === -1) {
        throw new DictionaryEntryNotFoundError(entryId);
      }
      if (entries.some((item) => item.id !== entryId && item.surfaceKey === nextEntry.surfaceKey)) {
        throw new DuplicateSurfaceKeyError(guildId, nextEntry.surfaceKey);
      }
      const parsedEntry = DictionaryEntrySchema.parse(nextEntry);
      const next = entries.slice();
      next[index] = parsedEntry;
      await writeJsonAtomic(filePath, DictionaryEntrySchema.array().parse(next) as JsonValue);
    });
  }

  /**
   * 辞書エントリを削除する。
   * @param guildId - ギルド ID。
   * @param entryId - エントリ ID。
   * @param _actor - 操作主体（現状は未使用）。
   * @throws DictionaryEntryNotFoundError - エントリが存在しない場合。
   */
  async delete(guildId: string, entryId: string, _actor: Actor): Promise<void> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const entries = await this.readEntries(filePath);
      const next = entries.filter((item) => item.id !== entryId);
      if (next.length === entries.length) {
        throw new DictionaryEntryNotFoundError(entryId);
      }
      await writeJsonAtomic(filePath, DictionaryEntrySchema.array().parse(next) as JsonValue);
    });
  }
}

/**
 * JSON Lines で監査ログを管理するストア。
 */
export class JsonAuditLogStore implements AuditLogStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  /**
   * @param dataDir - JSON の保存先ディレクトリ。
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * 監査ログを追記する。
   * @param log - 監査ログ。
   */
  async append(log: SettingsAuditLog): Promise<void> {
    const filePath = dataPaths.audit(this.dataDir, log.guildId);
    await this.mutex.runExclusive(filePath, async () => {
      const parsed = SettingsAuditLogSchema.parse(log);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = `${JSON.stringify(parsed)}\n`;
      await fs.appendFile(filePath, line, 'utf8');
    });
  }

  /**
   * 監査ログを取得する。
   * @param guildId - ギルド ID。
   * @param limit - 最大件数。
   */
  async listByGuild(guildId: string, limit: number): Promise<SettingsAuditLog[]> {
    // TODO(test): createdAt 降順と limit が正しく効くことを検証する。
    const filePath = dataPaths.audit(this.dataDir, guildId);
    return this.mutex.runExclusive(filePath, async () => {
      const raw = await readJsonLines(filePath);
      if (raw === null) {
        return [];
      }
      const logs = raw
        .map((line) => SettingsAuditLogSchema.parse(line))
        .sort((a, b) => {
          if (a.createdAt === b.createdAt) {
            return 0;
          }
          return a.createdAt < b.createdAt ? 1 : -1;
        });
      return logs.slice(0, limit);
    });
  }
}
