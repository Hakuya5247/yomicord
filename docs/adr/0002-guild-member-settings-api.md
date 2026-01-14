# GuildMemberSettings API を3操作（GET/PUT/DELETE）で提供する

## Context

- GuildMemberSettings は「ユーザーごとの部分上書き」を保持する設計であり、空になった場合は削除する。
- 契約ファーストで API を設計し、Bot/将来の Web から同一の契約で利用したい。
- 利用者は本人のみの想定であり、権限モデルを最小化したい。

## Decision

- GuildMemberSettings の API は 3 操作（取得 / 全置換更新 / 削除）のみを提供する。
- 更新は「部分上書きの全置換」とし、意味のある上書きが無い場合は削除する。
- 利用者は本人のみとする。

### API 仕様（補足）

- エンドポイント: `/v1/guilds/:guildId/members/:userId/settings`
  - GET: 指定ユーザーの GuildMemberSettings を取得する（存在しない場合は `null`）。
  - PUT: GuildMemberSettings の「部分上書き全体」を全置換で更新する。
  - DELETE: 指定ユーザーの GuildMemberSettings を削除する。

### 認可前提

- 基本は本人のみ（`userId` 本人が自分の設定を操作する）。（将来的な変更の可能性あり）
- API 側で `Actor.userId` と `:userId` の一致を必ず検証する。
- そのため全操作で `X-Yomicord-Actor-User-Id` を必須とする。

### 更新時の canonicalize ルール

- 入力は contracts の `GuildMemberSettingsSchema` で検証する。
- `voice` が空なら `voice` を削除する。
- `nameRead.normalize === "inherit"` は `nameRead` を削除する。
- 結果が空オブジェクトなら設定を削除（保存しない）。
- 返却値は canonicalize 後の `GuildMemberSettings`（空なら `null`）。

### Actor ヘッダーの扱い

- `X-Yomicord-Actor-*` ヘッダーを受け取る（詳細は ADR-0001 に準拠）。
- Bot 操作時は `X-Yomicord-Actor-User-Id` が必須（本人一致のため、API 操作も実質必須）。
- `Display-Name` は永続化しない（監査ログ表示時に取得する）。

### 取得 / 更新のレスポンス形

```json
{
  "ok": true,
  "guildId": "123",
  "userId": "456",
  "settings": { "...": "GuildMemberSettings（存在しない場合は null）" }
}
```

## Consequences

- 利点: 契約・実装が単純になり、Bot 側の実装コストが最小化できる。
- 利点: 既存の「部分上書きのみ保存」「空なら削除」という設計と整合する。
- 欠点: 部分更新ができないため、クライアントで全体を把握して更新する必要がある。
- 欠点: 細かな更新 UX を実現する場合、クライアント側の追加実装が必要になる。

## Alternatives

- GET + PATCH + DELETE（部分更新を API 側で扱う）
- PATCHはサーバー側のマージ規則・競合・部分削除表現が複雑になるため、初期は全置換にする
- 取得は合成済み設定、更新は member のみ（デバッグ性が低下）
