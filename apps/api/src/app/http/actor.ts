import type { Actor } from '@yomicord/contracts/internal';
import type { ActorHeaders } from '@yomicord/contracts';

/**
 * Actor 操作に関するヘルパー群の契約。
 */
export type ActorHelpers = {
  buildActor: (headers: ActorHeaders) => Actor;
  applyActorRoles: (headers: ActorHeaders, actor: Actor) => Actor | null;
};

/**
 * ロール ID のヘッダー文字列を配列に変換する。
 * @param raw - ヘッダー文字列。
 * @returns ロール ID の配列、または不正なら null。
 */
function parseRoleIds(raw: string | undefined): string[] | null {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 管理者フラグのヘッダー文字列を boolean に変換する。
 * @param raw - ヘッダー文字列。
 * @returns true/false、または不正なら null。
 */
function parseIsAdmin(raw: string | undefined): boolean | null {
  if (!raw) {
    return false;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return null;
}

/**
 * Actor をヘッダーから組み立てる。
 * @param headers - Actor ヘッダー。
 * @returns Actor 情報。
 */
export function buildActor(headers: ActorHeaders): Actor {
  return {
    userId: headers['x-yomicord-actor-user-id'] ?? null,
    displayName: headers['x-yomicord-actor-display-name'] ?? null,
    roleIds: [],
    isAdmin: false,
    source: headers['x-yomicord-actor-source'] ?? 'system',
    occurredAt: headers['x-yomicord-actor-occurred-at'] ?? new Date().toISOString(),
  };
}

/**
 * Actor にロール情報を反映する。
 * @param headers - Actor ヘッダー。
 * @param actor - 既存 Actor 情報。
 * @returns 反映後の Actor、または不正なヘッダーなら null。
 */
export function applyActorRoles(headers: ActorHeaders, actor: Actor): Actor | null {
  const roleIds = parseRoleIds(headers['x-yomicord-actor-role-ids']);
  if (!roleIds) {
    return null;
  }
  const isAdmin = parseIsAdmin(headers['x-yomicord-actor-is-admin']);
  if (isAdmin === null) {
    return null;
  }
  return { ...actor, roleIds, isAdmin };
}

/**
 * Actor 関連のヘルパーを生成する。
 * @returns Actor ヘルパー。
 */
export function createActorHelpers(): ActorHelpers {
  return { buildActor, applyActorRoles };
}
