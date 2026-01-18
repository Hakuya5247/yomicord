# Runtime State（永続化しない）

```ts
type ReadSession = {
  guildId: string;
  voiceChannelId: string;
  textChannelIds: Set<string>;
  joinedAt: string;
};
```

- `/join` 時に生成
- `/leave` / 自動切断で破棄
- **apps/bot 内ローカル型**
