# Actor（操作コンテキスト）

Actor は **永続化しない入力情報**。

```ts
export type Actor = {
  userId: string | null;
  roleIds: string[];
  isAdmin: boolean;
  displayName?: string | null;
  source: 'command' | 'api' | 'system' | 'migration';
  occurredAt: string;
};
```

## displayName の扱い

- `displayName` は **永続化しない**
- 監査ログ表示時は Discord API からユーザー情報を別途取得する
- Store への入力時に渡すが、`SettingsAuditLog` には保存しない
