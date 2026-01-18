import type { Actor, ActorHeaders } from '@yomicord/contracts';

export type ActorHelpers = {
  buildActor: (headers: ActorHeaders) => Actor;
  applyActorRoles: (headers: ActorHeaders, actor: Actor) => Actor | null;
};

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

export function createActorHelpers(): ActorHelpers {
  return { buildActor, applyActorRoles };
}
