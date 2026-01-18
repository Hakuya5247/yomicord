import type { DictionaryEntry } from '../dictionary/entry.js';
import type { GuildMemberSettings } from '../guild/member-settings.js';
import type { GuildSettings } from '../guild/settings.js';

export type AuditLogDiff = {
  path: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeDiffValue = (value: unknown): unknown => (value === undefined ? null : value);

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
};

const joinPath = (base: string, key: string): string => (base ? `${base}.${key}` : key);

const computeObjectDiff = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  basePath = '',
): AuditLogDiff[] => {
  const diffs: AuditLogDiff[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const path = joinPath(basePath, key);

    const beforeIsObject = isPlainObject(beforeValue);
    const afterIsObject = isPlainObject(afterValue);
    if (beforeIsObject || afterIsObject) {
      const beforeObj = beforeIsObject ? beforeValue : {};
      const afterObj = afterIsObject ? afterValue : {};
      diffs.push(...computeObjectDiff(beforeObj, afterObj, path));
      continue;
    }

    if (Array.isArray(beforeValue) || Array.isArray(afterValue)) {
      if (!deepEqual(beforeValue, afterValue)) {
        diffs.push({
          path,
          before: { [key]: normalizeDiffValue(beforeValue) },
          after: { [key]: normalizeDiffValue(afterValue) },
        });
      }
      continue;
    }

    if (!deepEqual(beforeValue, afterValue)) {
      diffs.push({
        path,
        before: { [key]: normalizeDiffValue(beforeValue) },
        after: { [key]: normalizeDiffValue(afterValue) },
      });
    }
  }
  return diffs;
};

export const computeGuildSettingsDiff = (
  before: GuildSettings,
  after: GuildSettings,
): AuditLogDiff[] => computeObjectDiff(before, after);

export const computeGuildMemberSettingsDiff = (
  before: GuildMemberSettings,
  after: GuildMemberSettings,
): AuditLogDiff[] => computeObjectDiff(before, after);

export const computeDictionaryEntryDiff = (
  before: DictionaryEntry,
  after: DictionaryEntry,
): AuditLogDiff[] => computeObjectDiff(before, after);
