import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  canonicalizeGuildMemberSettings,
  createDefaultGuildSettings,
  DictionaryEntrySchema,
  GuildMemberSettingsSchema,
  GuildSettingsSchema,
  SettingsAuditLogSchema,
} from '@yomicord/contracts';
import type {
  Actor,
  DictionaryEntry,
  GuildMemberSettings,
  GuildSettings,
  SettingsAuditLog,
} from '@yomicord/contracts';
import {
  DuplicateSurfaceKeyError,
  type AuditLogStore,
  type DictionaryStore,
  type GuildMemberSettingsStore,
  type GuildSettingsStore,
} from '@yomicord/storage';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

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

class MutexMap {
  private tails = new Map<string, Promise<void>>();

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

const writeJsonAtomic = async (filePath: string, data: JsonValue): Promise<void> => {
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, filePath);
};

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

export class JsonGuildSettingsStore implements GuildSettingsStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

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

  async update(guildId: string, next: GuildSettings, _actor: Actor): Promise<void> {
    const filePath = dataPaths.guildSettings(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const parsed = GuildSettingsSchema.parse(next);
      await writeJsonAtomic(filePath, parsed as JsonValue);
    });
  }
}

export class JsonGuildMemberSettingsStore implements GuildMemberSettingsStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

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

  async delete(guildId: string, userId: string, _actor: Actor): Promise<void> {
    const filePath = dataPaths.guildMemberSettings(this.dataDir, guildId, userId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      await deleteFileIfExists(filePath);
    });
  }
}

export class JsonDictionaryStore implements DictionaryStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private async readEntries(filePath: string): Promise<DictionaryEntry[]> {
    const raw = await readJsonFile(filePath);
    if (raw === null) {
      return [];
    }
    return DictionaryEntrySchema.array().parse(raw);
  }

  async listByGuild(guildId: string): Promise<DictionaryEntry[]> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    return this.mutex.runExclusive(filePath, async () => this.readEntries(filePath));
  }

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

  async update(
    guildId: string,
    entryId: string,
    patch: Partial<Pick<DictionaryEntry, 'reading' | 'priority' | 'isEnabled'>>,
    _actor: Actor,
  ): Promise<void> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const entries = await this.readEntries(filePath);
      const index = entries.findIndex((item) => item.id === entryId);
      if (index === -1) {
        throw new Error(`Dictionary entry not found: ${entryId}`);
      }
      const updated = { ...entries[index], ...patch };
      const parsedEntry = DictionaryEntrySchema.parse(updated);
      const next = entries.slice();
      next[index] = parsedEntry;
      await writeJsonAtomic(filePath, DictionaryEntrySchema.array().parse(next) as JsonValue);
    });
  }

  async delete(guildId: string, entryId: string, _actor: Actor): Promise<void> {
    const filePath = dataPaths.dictionary(this.dataDir, guildId);
    await this.mutex.runExclusive(filePath, async () => {
      void _actor;
      const entries = await this.readEntries(filePath);
      const next = entries.filter((item) => item.id !== entryId);
      if (next.length === entries.length) {
        throw new Error(`Dictionary entry not found: ${entryId}`);
      }
      await writeJsonAtomic(filePath, DictionaryEntrySchema.array().parse(next) as JsonValue);
    });
  }
}

export class JsonAuditLogStore implements AuditLogStore {
  private readonly dataDir: string;
  private readonly mutex = new MutexMap();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async append(log: SettingsAuditLog): Promise<void> {
    const filePath = dataPaths.audit(this.dataDir, log.guildId);
    await this.mutex.runExclusive(filePath, async () => {
      const parsed = SettingsAuditLogSchema.parse(log);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const line = `${JSON.stringify(parsed)}\n`;
      await fs.appendFile(filePath, line, 'utf8');
    });
  }

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
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return logs.slice(0, limit);
    });
  }
}
