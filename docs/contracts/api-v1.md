# API 仕様（v1）

## 1. API 共通エラー形式（補足）

設定・辞書・監査ログの仕様と合わせて、API の共通エラー形式も contracts に定義する。
詳細な運用方針は `docs/architecture/data-flow.md` を参照する。

```ts
// 例: ApiErrorResponseSchema
type ApiErrorResponse = {
  ok: false;
  error: {
    code:
      | 'VALIDATION_FAILED'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'INTERNAL';
    message: string;
    details?: unknown;
  };
};
```

---

## 2. GuildSettings API（v1）

Bot/WebUI から共通で利用する API の最小設計（GuildSettings）。

### 共通

- パス: `/v1/guilds/:guildId/settings`
- `:guildId` は文字列（Discord の guildId）

### 取得（GET）

- Body: なし
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "settings": { "...": "GuildSettings 全体" }
}
```

### 更新（PUT / 全置換）

- Body: `GuildSettings`（全置換）
- 認可は `permissions.manageMode` に連動し、API 側で判定する
- Actor ヘッダー（認可のため必須）
  - `X-Yomicord-Actor-User-Id`: 操作者の Discord User ID
  - `X-Yomicord-Actor-Role-Ids`: JSON 配列文字列（URL エンコード不要 / 例: `["role1","role2"]`）
  - `X-Yomicord-Actor-Is-Admin`: "true" / "false" の文字列
  - 未指定の場合は「権限不足」として扱う（403）
  - `X-Yomicord-Actor-Source`: `command | api | system | migration`（省略時は `system`）
  - `X-Yomicord-Actor-Occurred-At`: ISO8601 文字列（省略時は API サーバー時刻）
  - `X-Yomicord-Actor-Display-Name`: 省略可
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "settings": { "...": "GuildSettings 全体" }
}
```

補足:

- Actor は監査・認可の文脈で API に渡す。
- GuildSettings の schema 自体は packages/contracts を唯一の真実とする。

---

## 3. GuildMemberSettings API（v1）

Bot/WebUI から共通で利用する API の最小設計（GuildMemberSettings）。

### 共通

- パス: `/v1/guilds/:guildId/members/:userId/settings`
- `:guildId` / `:userId` は文字列（Discord の guildId / userId）
- 認可前提: `userId` 本人のみ（API 側で `Actor.userId` と `:userId` の一致を検証）
- Actor ヘッダー: 全操作で `X-Yomicord-Actor-User-Id` を必須とする（本人一致のため）

### 取得（GET）

- Body: なし
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "userId": "456",
  "settings": { "...": "GuildMemberSettings（存在しない場合は null）" }
}
```

### 更新（PUT / 全置換）

- Body: `GuildMemberSettings`（部分上書きの全体）
- Actor ヘッダー（任意。ただし Bot 操作時は `User-Id` が必須）
  - `X-Yomicord-Actor-User-Id`: 操作者の Discord User ID（Bot からの操作時は必須、system 操作時は null）
  - `X-Yomicord-Actor-Source`: `command | api | system | migration`（省略時は `system`）
  - `X-Yomicord-Actor-Occurred-At`: ISO8601 文字列（省略時は API サーバー時刻）
  - `X-Yomicord-Actor-Display-Name`: 省略可
- canonicalize（保存前の正規化）:
  - `voice` が空なら削除
  - `nameRead.normalize === "inherit"` は `nameRead` を削除
  - 結果が空オブジェクトなら保存せず削除
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "userId": "456",
  "settings": { "...": "canonicalize 後の GuildMemberSettings（空なら null）" }
}
```

### 削除（DELETE）

- Body: なし
- Actor ヘッダーは PUT と同様（監査・認可のため受け取る）
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "userId": "456"
}
```

補足:

- Actor は監査・認可の文脈で API に渡す。
- GuildMemberSettings の schema と canonicalize は packages/contracts を唯一の真実とする。

---

## 4. DictionaryEntry API（v1）

Bot/WebUI から共通で利用する API の最小設計（DictionaryEntry）。

### 共通

- パス（一覧/作成）: `/v1/guilds/:guildId/dictionary`
- パス（単一更新/削除）: `/v1/guilds/:guildId/dictionary/:entryId`
- `:guildId` / `:entryId` は文字列
- 認可は `permissions.manageMode` に連動し、API 側で判定する
- Actor ヘッダーは全操作で必須（監査・認可のため）
  - `X-Yomicord-Actor-User-Id`: **必須**（操作者の Discord User ID）
  - `X-Yomicord-Actor-Source`: `command | api | system | migration`（省略時は `system`）
  - `X-Yomicord-Actor-Occurred-At`: ISO8601 文字列（省略時は API サーバー時刻）
  - `X-Yomicord-Actor-Display-Name`: 省略可
  - `X-Yomicord-Actor-Role-Ids`: JSON 配列文字列（URL エンコード不要 / 例: `["role1","role2"]`）
  - `X-Yomicord-Actor-Is-Admin`: "true" / "false" の文字列
  - 未指定の場合は「権限不足」として扱う（403）

### 一覧取得（GET）

- cursor 方式の pagination/limit 前提で取得する（既定 limit: 50）
- query:
  - `limit?: number`（最小 1 / 最大 200 / 未指定時は 50）
  - `cursor?: string`（未指定なら先頭、無効な cursor は `VALIDATION_FAILED`）
- cursor は `"{priority}:{surfaceLength}:{id}"` を base64 化した文字列
- Response は `items` と `nextCursor` を返す（終端は `nextCursor: null`）
- 具体的な query/response schema は packages/contracts を唯一の真実とする
- 補足: 更新/削除により cursor が無効化された場合は `VALIDATION_FAILED` とする

### 作成（POST）

- 辞書エントリを新規作成する
- Body は `{ surface, reading, priority, isEnabled }`（`id` / `guildId` / `surfaceKey` は含めない）
- `priority` は整数
- `surfaceKey` は `surface` から API 側で正規化して生成する
- `guildId + surfaceKey` の重複は `CONFLICT` とする

### 更新（PUT / 全置換）

- 単一エントリを **全置換** で更新する（partial update ではない）
- Body は `{ surface, reading, priority, isEnabled }`（`id` / `guildId` / `surfaceKey` は含めない）
- `priority` は整数
- `id` / `guildId` は params を正とし、更新で変更できない
- `surfaceKey` は `surface` から再計算する

### 削除（DELETE）

- 単一エントリを削除する

補足:

- Actor は監査・認可の文脈で API に渡す。
- DictionaryEntry の schema は packages/contracts を唯一の真実とする。

---

## 5. SettingsAuditLog API（v1）

Bot/WebUI から共通で利用する API の最小設計（SettingsAuditLog）。

### 共通

- パス: `/v1/guilds/:guildId/audit-logs`
- `:guildId` は文字列（Discord の guildId）
- 取得専用（読み取りのみ、更新/削除 API は提供しない）
- 認可は `permissions.manageMode` に連動し、API 側で判定する
- Actor ヘッダーは全操作で必須（監査・認可のため）
  - `X-Yomicord-Actor-User-Id`: **必須**（操作者の Discord User ID）
  - `X-Yomicord-Actor-Source`: `command | api | system | migration`（省略時は `system`）
  - `X-Yomicord-Actor-Occurred-At`: ISO8601 文字列（省略時は API サーバー時刻）
  - `X-Yomicord-Actor-Display-Name`: 省略可
  - `X-Yomicord-Actor-Role-Ids`: JSON 配列文字列（URL エンコード不要 / 例: `["role1","role2"]`）
  - `X-Yomicord-Actor-Is-Admin`: "true" / "false" の文字列
  - 未指定の場合は「権限不足」として扱う（403）

### 一覧取得（GET）

- query:
  - `limit?: number`（最小 1 / 最大 200 / 未指定時は 50）
- createdAt 降順（新しい順）で最大 limit 件を返す
- API は limit 未指定時に 50 を補完し、Store に渡す
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "items": [
    {
      "id": "uuid",
      "guildId": "123",
      "entityType": "dictionary_entry",
      "entityId": "abc-uuid",
      "action": "update",
      "path": "reading",
      "before": { "reading": "えーぴーあい" },
      "after": { "reading": "エーピーアイ" },
      "actorUserId": "456",
      "source": "command",
      "createdAt": "2026-01-01T12:00:00Z"
    }
  ]
}
```

補足:

- SettingsAuditLog の schema は packages/contracts を唯一の真実とする。
- 監査ログは API が内部で追記するもので、クライアントからの作成は受け付けない。
