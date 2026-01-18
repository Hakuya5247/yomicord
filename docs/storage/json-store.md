# JSON ファイル Store（フェーズ1）

## 1. 保存構成

```
data/
  guild-settings/{guildId}.json
  guild-members/{guildId}/{userId}.json
  dictionary/{guildId}.json
  audit/{guildId}.log.jsonl
```

## 2. 同時書き込み前提

- 単一インスタンス運用
- atomic write + in-process mutex
- 複数インスタンスは DB 移行で対応
