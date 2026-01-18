export type Actor = {
  userId: string | null;
  displayName?: string | null;
  roleIds?: string[];
  isAdmin?: boolean;
  source: 'command' | 'api' | 'system' | 'migration';
  occurredAt: string;
};
