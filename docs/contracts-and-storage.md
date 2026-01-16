# Contracts & Storage 設計（フェーズ1 / v2 確定版）

本ドキュメントは、Discord読み上げBot「Yomicord」における  
**設定・辞書・監査ログのデータ構造（Contracts）** と  
**永続化の抽象化（Storage / Store インターフェース）** を定義する。

フェーズ1では DB を導入せず、**JSONファイルを永続化先**とする。  
ただし、**後から DB（PostgreSQL 等）へ差し替えることを前提**として設計する。

---

## 1. 設計方針（最重要）

- データ構造の唯一の正は **packages/contracts**
- 永続化方式（JSON / DB）は **Store インターフェースで完全分離**
- apps/api / apps/bot は **保存方式を一切知らない**
- JSONファイルは「仮のDB」であり、後で差し替える
- 監査ログはフェーズ1から必ず残す
- **接続中のみ有効な状態（読み上げ対象チャンネル等）は永続化しない**

---

## 2. 命名規則（厳守）

### 2.1 TypeScript / JSON

- camelCase
- 単数形
- 型名は PascalCase

例：

- `GuildSettings`
- `GuildMemberSettings`
- `DictionaryEntry`
- `SettingsAuditLog`
- `surfaceKey`, `isEnabled`

### 2.2 テーブル / 論理ストレージ

- snake_case
- 複数形

例：

- `guild_settings`
- `guild_member_settings`
- `dictionary_entries`
- `settings_audit_logs`

### 2.3 Mermaid ER 図

- UPPER_SNAKE_CASE
- 複数形（テーブル名に一致）

---

## 3. 全体構成（レイヤ構造）

```mermaid
flowchart TD
  subgraph Apps
    API[apps/api]
    BOT[apps/bot]
  end

  subgraph Contracts["packages/contracts"]
    C1[Zod Schemas]
    C2[Types]
    C3[Defaults]
    C4[Pure Helpers]
    C5[Merge Helpers]
  end

  subgraph StorageBoundary["packages/storage (interfaces)"]
    S1[GuildSettingsStore]
    S2[GuildMemberSettingsStore]
    S3[DictionaryStore]
    S4[AuditLogStore]
  end

  subgraph StorageImpl["packages/storage-json"]
    J1[JSON Guild Settings]
    J2[JSON Member Settings]
    J3[JSON Dictionary]
    J4[JSONL Audit Log]
  end

  API --> Contracts
  BOT --> Contracts

  API --> StorageBoundary
  BOT --> StorageBoundary

  StorageImpl --> StorageBoundary
```

---

## 4. エンティティ関係（ER 図）

> **注記**: ER図内のカラム名は snake_case で記載しています。
> これは将来の DB 移行時のカラム名を示すものであり、
> TypeScript / JSON では camelCase（2.1節参照）を使用します。

```mermaid
erDiagram
  GUILD_SETTINGS ||--o{ GUILD_MEMBER_SETTINGS : has
  GUILD_SETTINGS ||--o{ DICTIONARY_ENTRIES : has
  GUILD_SETTINGS ||--o{ SETTINGS_AUDIT_LOGS : logs

  GUILD_SETTINGS {
    string guild_id PK
    json   settings
  }

  GUILD_MEMBER_SETTINGS {
    string guild_id PK
    string user_id  PK
    json   settings
  }

  DICTIONARY_ENTRIES {
    string id PK
    string guild_id FK
    string surface
    string surface_key
    string reading
    int    priority
    bool   is_enabled
  }

  SETTINGS_AUDIT_LOGS {
    string id PK
    string guild_id FK
    string entity_type
    string entity_id
    string action
    string path
    json   before
    json   after
    string actor_user_id
    string source
    datetime created_at
  }
```

---

## 5. Contracts（packages/contracts）

### 5.1 GuildSettings（サーバー設定）

#### 役割

- 1 guild = 1 設定
- サーバー全体の読み上げ方針・音声デフォルトを定義
- **読み上げ対象テキストチャンネルは含まない**
- `opsNotify` は、サーバーに対して運用上の通知を行うことに関する設定

#### 正式 JSON 形（デフォルト）

```json
{
  "voice": {
    "engine": "voicevox",
    "speakerId": 1,
    "volume": 1.0,
    "speed": 1.0,
    "pitch": 0.0,
    "intonation": 1.0
  },
  "nameRead": {
    "nameSource": "NICKNAME",
    "prefix": "",
    "suffix": "さん",
    "repeatMode": "ON_CHANGE",
    "cooldownSec": 120,
    "normalizeDefault": true
  },
  "filters": {
    "mentionMode": "EXPAND",
    "urlMode": "DOMAIN_ONLY",
    "emojiMode": "IGNORE",
    "codeBlockMode": "SAY_CODE",
    "attachmentMode": "TYPE_ONLY",
    "newlineMode": "JOIN"
  },
  "limits": {
    "maxHiraganaLength": 120,
    "overLimitAction": "SAY_IKARYAKU"
  },
  "announce": {
    "onConnect": true,
    "onStartStop": false,
    "customText": null
  },
  "permissions": {
    "manageMode": "ADMIN_ONLY",
    "allowedRoleIds": []
  },
  "opsNotify": {
    "channelId": null,
    "levelMin": "NOTICE"
  }
}
```

---

### 5.2 GuildMemberSettings（ユーザー設定）

#### 役割

- guild 内 member ごとの **部分上書き設定**
- 上書きが存在する場合のみ保存
- 意味のある上書きが無くなった場合は削除

#### JSON 形（部分上書き）

```json
{
  "voice": {
    "speakerId": 14,
    "speed": 1.1
  },
  "nameRead": {
    "normalize": "inherit"
  }
}
```

#### 設計上の制約

- `voice.engine` は **フェーズ1では存在しない**
  - サーバー全体の音声世界観を維持するため
  - engine 切替は CPU / メモリ負荷・互換性差が大きいため
  - 将来的にユーザー別 engine 許可を検討（11節参照）

- `nameRead.normalize`:
  - `"inherit"` | `"on"` | `"off"`

#### 削除判定（canonicalize）

- `voice` が空 → 削除
- `nameRead.normalize === "inherit"` → nameRead 削除
- 結果 `{}` → row 削除

---

### 5.3 DictionaryEntry（本文辞書）

#### 適用範囲（重要）

- **本文のみ**
- 名前読みには一切適用しない（フェーズ1確定）

```json
{
  "id": "uuid",
  "guildId": "123",
  "surface": "API",
  "surfaceKey": "api",
  "reading": "エーピーアイ",
  "priority": 10,
  "isEnabled": true
}
```

#### surfaceKey 正規化（フェーズ1確定）

```
normalizeSurface(surface):
  1. Unicode NFKC
  2. trim
  3. 英字を小文字化
  4. 連続空白を半角1つに畳む
```

- 記号は除去しない
- `guildId + surfaceKey` はユニーク
- 重複登録はエラー

#### 適用順

1. priority 降順
2. surface.length 降順
3. id 昇順

---

### 5.4 SettingsAuditLog（監査ログ）

#### entityType / entityId

| entityType            | entityId             |
| --------------------- | -------------------- |
| guild_settings        | null                 |
| guild_member_settings | `{guildId}:{userId}` |
| dictionary_entry      | `<entryId>`          |

#### action / path ルール

| action | path      |
| ------ | --------- |
| create | null      |
| delete | null      |
| update | `"a.b.c"` |

- before / after は **変更されたフィールドのみ**

```json
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
```

#### 保存ルール（API 側）

- 監査ログは **更新系 API のみ**で保存する（GET/閲覧は対象外）。
- 監査ログの追記は **同期的**に行い、追記失敗時は **API は成功を返す**（運用で検知・補完する）。
- 変更が複数ある場合は **変更ごとに 1 ログ**を作成する。
  - 同一リクエスト内の複数ログは `createdAt` を同一にする。
  - 同一リクエスト内の複数ログは `entityId` を同一にする。
  - 並び順は `path` の辞書順で安定化させる。
  - `path = null` のログは末尾に置く。
- `before` / `after` は **変更部分のみ**を保持する。
- 差分抽出は **ネストまで含む深い比較**とし、`path` は `"a.b.c"` の形式で記録する。
- `createdAt` は `X-Yomicord-Actor-Occurred-At` を優先し、未指定時は API 時刻を使用する。

#### 作成 / 削除時の before / after ルール

- DictionaryEntry:
  - create: `before = {}` / `after = { surface, surfaceKey, reading, priority, isEnabled }`
  - delete: `before = { surface, surfaceKey, reading, priority, isEnabled }` / `after = {}`
- GuildMemberSettings:
  - create: `before = {}` / `after = { voice?, nameRead? }`
  - delete: `before = { voice?, nameRead? }` / `after = {}`
- GuildSettings:
  - 更新時は差分のみ（複数項目は複数ログ）。
  - 作成/削除は原則発生しない（必要になった場合は別途定義）。

#### 差分抽出の実装ガイド（API 層）

- 差分検出は **リーフレベル**（最も深い変更箇所）で行う。
  - 例: `voice.speakerId` が変更なら `path = "voice.speakerId"`
- 配列の変更は配列全体を before/after に含める。
  - 例: `allowedRoleIds` 変更なら `path = "permissions.allowedRoleIds"`
- path のソートは JavaScript の `Array.prototype.sort()` による昇順。
  - `path = null` は末尾に配置。
- 差分抽出ヘルパーは packages/contracts に配置する。
  - `computeGuildSettingsDiff(before, after): Diff[]`
  - `computeDictionaryEntryDiff(before, after): Diff[]`
  - `computeGuildMemberSettingsDiff(before, after): Diff[]`

#### GuildMemberSettings の監査ログ詳細

- 新規作成: `action = "create"`, `path = null`, `before = {}`, `after = { 全体 }`
- 更新: 変更されたフィールドごとに 1 ログ（リーフレベル）
- 削除: `action = "delete"`, `path = null`, `before = { 全体 }`, `after = {}`

#### DictionaryEntry の監査ログ詳細

- 作成: `action = "create"`, `path = null`, `before = {}`, `after = { 全体 }`
- 更新: 変更されたフィールドごとに 1 ログ（リーフレベル）
- 削除: `action = "delete"`, `path = null`, `before = { 全体 }`, `after = {}`

---

### 5.5 Enum 定義（共通値）

本プロジェクトでは、設定値の揺れや不正値混入を防ぐため、
**取りうる値が有限な項目はすべて enum（値集合）として定義する**。

- 実装は **Zod の `z.enum([...])`**
- JSON / TypeScript の実値は **string**
- UI 表示名（日本語ラベル）は enum に含めない（UI 層で対応）

これにより、

- API / Bot / 将来の WebUI 間で値が完全に一致する
- 永続化（JSON / DB）時に不正値を防止できる
- DB 移行時に enum / check 制約へ移行しやすい

#### 名前読み関連

##### 名前の取得元（`nameRead.nameSource`）

| 値         | 意味                 |
| ---------- | -------------------- |
| `NICKNAME` | サーバーニックネーム |
| `USERNAME` | Discord ユーザー名   |

##### 名前の再読み上げルール（`nameRead.repeatMode`）

| 値          | 意味                     |
| ----------- | ------------------------ |
| `ALWAYS`    | 毎回名前を読む           |
| `ON_CHANGE` | 話者が変わった時のみ読む |
| `COOLDOWN`  | クールダウン後に再度読む |

※ `cooldownSec = 0` の場合は毎回読む。

##### ユーザーごとの正規化指定（`GuildMemberSettings.nameRead.normalize`）

| 値        | 意味                 |
| --------- | -------------------- |
| `inherit` | GuildSettings に従う |
| `on`      | 正規化する           |
| `off`     | 正規化しない         |

#### フィルタ関連（`filters.*`）

##### メンションの読み上げ方（`filters.mentionMode`）

| 値            | 意味                               |
| ------------- | ---------------------------------- |
| `EXPAND`      | `@user` をユーザー名に展開して読む |
| `IGNORE`      | 読まない                           |
| `SAY_MENTION` | 「メンション」と読む               |

##### URL の読み上げ方（`filters.urlMode`）

| 値            | 意味             |
| ------------- | ---------------- |
| `DOMAIN_ONLY` | ドメインのみ読む |
| `FULL`        | フルURLを読む    |
| `IGNORE`      | 読まない         |

##### 絵文字の扱い（`filters.emojiMode`）

| 値       | 意味           |
| -------- | -------------- |
| `IGNORE` | 読まない       |
| `NAME`   | 絵文字名を読む |

##### コードブロックの扱い（`filters.codeBlockMode`）

| 値         | 意味                       |
| ---------- | -------------------------- |
| `SAY_CODE` | 「コードがあります」と読む |
| `IGNORE`   | 無視する                   |

※ 実際のコード内容は読み上げない。

##### 添付ファイルの扱い（`filters.attachmentMode`）

| 値          | 意味                                 |
| ----------- | ------------------------------------ |
| `TYPE_ONLY` | 「画像」「ファイル」など種類のみ読む |
| `IGNORE`    | 読まない                             |

##### 改行の扱い（`filters.newlineMode`）

| 値      | 意味             |
| ------- | ---------------- |
| `JOIN`  | 連結して読む     |
| `PAUSE` | 区切りとして扱う |

#### 制限・権限関連

##### 文字数超過時の挙動（`limits.overLimitAction`）

| 値             | 意味             |
| -------------- | ---------------- |
| `SAY_IKARYAKU` | 「以下略」と読む |
| `IGNORE`       | 読まない         |

##### 設定変更権限（`permissions.manageMode`）

| 値           | 意味       |
| ------------ | ---------- |
| `ADMIN_ONLY` | 管理者のみ |
| `ROLE_BASED` | 指定ロール |

#### 音声エンジン（フェーズ1）

##### 音声エンジン（`voice.engine`）

| 値         | 意味                      |
| ---------- | ------------------------- |
| `voicevox` | VOICEVOX（フェーズ1固定） |

※ フェーズ1では `GuildSettings` のみで指定可能。
※ `GuildMemberSettings` では上書き不可。

#### 運用通知設定の最小ログレベル（`opsNotify.levelMin`）

| 値        | 意味                                     |
| --------- | ---------------------------------------- |
| `INFO`    | 参考情報（起動完了など）                 |
| `NOTICE`  | 運用上把握すべき変化（再起動・更新など） |
| `WARNING` | 問題発生・対応が必要な状態               |

#### 補足ルール（重要）

- enum 値は **増やすことは可能**だが、**削除・変更は破壊的変更**
- 新しい値を追加する場合は、必ず：
  1. ドキュメント更新
  2. Zod enum 追加
  3. デフォルト値の妥当性確認
     を行う

---

### 5.6 API 共通エラー形式（補足）

設定・辞書・監査ログの仕様と合わせて、API の共通エラー形式も contracts に定義する。
詳細な運用方針は `docs/architecture.md` を参照する。

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

### 5.7 GuildSettings API（v1）

Bot/WebUI から共通で利用する API の最小設計（GuildSettings）。

#### 共通

- パス: `/v1/guilds/:guildId/settings`
- `:guildId` は文字列（Discord の guildId）

#### 取得（GET）

- Body: なし
- Response:

```json
{
  "ok": true,
  "guildId": "123",
  "settings": { "...": "GuildSettings 全体" }
}
```

#### 更新（PUT / 全置換）

- Body: `GuildSettings`（全置換）
- 認可は `permissions.manageMode` に連動し、API 側で判定する
- Actor ヘッダー（認可のため必須）
  - `X-Yomicord-Actor-User-Id`: 操作者の Discord User ID
  - `X-Yomicord-Actor-Role-Ids`: JSON 配列文字列（URL エンコード不要 / 例: `["role1","role2"]`）
  - `X-Yomicord-Actor-Is-Admin`: `"true"` / `"false"` の文字列
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

### 5.8 GuildMemberSettings API（v1）

Bot/WebUI から共通で利用する API の最小設計（GuildMemberSettings）。

#### 共通

- パス: `/v1/guilds/:guildId/members/:userId/settings`
- `:guildId` / `:userId` は文字列（Discord の guildId / userId）
- 認可前提: `userId` 本人のみ（API 側で `Actor.userId` と `:userId` の一致を検証）
- Actor ヘッダー: 全操作で `X-Yomicord-Actor-User-Id` を必須とする（本人一致のため）

#### 取得（GET）

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

#### 更新（PUT / 全置換）

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

#### 削除（DELETE）

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

### 5.9 DictionaryEntry API（v1）

Bot/WebUI から共通で利用する API の最小設計（DictionaryEntry）。

#### 共通

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
  - `X-Yomicord-Actor-Is-Admin`: `"true"` / `"false"` の文字列
  - 未指定の場合は「権限不足」として扱う（403）

#### 一覧取得（GET）

- cursor 方式の pagination/limit 前提で取得する（既定 limit: 50）
- query:
  - `limit?: number`（最小 1 / 最大 200 / 未指定時は 50）
  - `cursor?: string`（未指定なら先頭、無効な cursor は `VALIDATION_FAILED`）
- cursor は `"{priority}:{surfaceLength}:{id}"` を base64 化した文字列
- Response は `items` と `nextCursor` を返す（終端は `nextCursor: null`）
- 具体的な query/response schema は packages/contracts を唯一の真実とする
- 補足: 更新/削除により cursor が無効化された場合は `VALIDATION_FAILED` とする

#### 作成（POST）

- 辞書エントリを新規作成する
- Body は `{ surface, reading, priority, isEnabled }`（`id` / `guildId` / `surfaceKey` は含めない）
- `priority` は整数
- `surfaceKey` は `surface` から API 側で正規化して生成する
- `guildId + surfaceKey` の重複は `CONFLICT` とする

#### 更新（PUT / 全置換）

- 単一エントリを **全置換** で更新する（partial update ではない）
- Body は `{ surface, reading, priority, isEnabled }`（`id` / `guildId` / `surfaceKey` は含めない）
- `priority` は整数
- `id` / `guildId` は params を正とし、更新で変更できない
- `surfaceKey` は `surface` から再計算する

#### 削除（DELETE）

- 単一エントリを削除する

補足:

- Actor は監査・認可の文脈で API に渡す。
- DictionaryEntry の schema は packages/contracts を唯一の真実とする。

---

### 5.10 SettingsAuditLog API（v1）

Bot/WebUI から共通で利用する API の最小設計（SettingsAuditLog）。

#### 共通

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
  - `X-Yomicord-Actor-Is-Admin`: `"true"` / `"false"` の文字列
  - 未指定の場合は「権限不足」として扱う（403）

#### 一覧取得（GET）

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

---

## 6. Actor（操作コンテキスト）

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

#### displayName の扱い

- `displayName` は **永続化しない**
- 監査ログ表示時は Discord API からユーザー情報を別途取得する
- Store への入力時に渡すが、`SettingsAuditLog` には保存しない

---

## 7. Storage 境界（packages/storage）

### 7.0 責務分担（重要）

| 責務                                                | 担当                                    |
| --------------------------------------------------- | --------------------------------------- |
| デフォルト値の生成                                  | packages/contracts（defaults ヘルパー） |
| 設定のマージ（GuildSettings + GuildMemberSettings） | packages/contracts（merge ヘルパー）    |
| 永続化（保存/読み出し）                             | Store                                   |
| 既存データへのフィールド追加（マイグレーション）    | Store（読み出し時に migrate/normalize） |
| 重複チェック（DictionaryEntry の surfaceKey）       | Store                                   |

#### マージヘルパー（packages/contracts）

```ts
// GuildSettings と GuildMemberSettings をマージして最終的な音声設定を返す
function mergeVoiceSettings(
  guild: GuildSettings,
  member: GuildMemberSettings | null,
): ResolvedVoiceSettings;

// 名前読み設定のマージ
function mergeNameReadSettings(
  guild: GuildSettings,
  member: GuildMemberSettings | null,
): ResolvedNameReadSettings;
```

- apps/bot は上記ヘルパーを呼び出してマージ済み設定を取得する
- マージロジックは Contracts に閉じ込め、apps 層に漏らさない

### 7.1 GuildSettingsStore

```ts
interface GuildSettingsStore {
  /**
   * 指定 guildId の設定を取得。存在しない場合はデフォルト値で新規作成。
   * - デフォルト値は contracts の defaults ヘルパーから取得
   * - 既存データにフィールド不足がある場合は読み出し時に migrate/normalize
   */
  getOrCreate(guildId: string): Promise<GuildSettings>;
  update(guildId: string, next: GuildSettings, actor: Actor): Promise<void>;
}
```

### 7.2 GuildMemberSettingsStore

```ts
interface GuildMemberSettingsStore {
  get(guildId: string, userId: string): Promise<GuildMemberSettings | null>;
  upsert(
    guildId: string,
    userId: string,
    partial: GuildMemberSettings,
    actor: Actor,
  ): Promise<void>;
  delete(guildId: string, userId: string, actor: Actor): Promise<void>;
}
```

### 7.3 DictionaryStore

```ts
interface DictionaryStore {
  listByGuild(
    guildId: string,
    options: {
      limit: number;
      cursor?: string | null;
    },
  ): Promise<{
    items: DictionaryEntry[];
    nextCursor: string | null;
  }>;

  /**
   * 辞書エントリを新規作成。
   * @throws DuplicateSurfaceKeyError - guildId + surfaceKey が既に存在する場合
   */
  create(guildId: string, entry: DictionaryEntry, actor: Actor): Promise<void>;

  /**
   * 単一エントリを全置換で更新。
   */
  replace(guildId: string, entryId: string, next: DictionaryEntry, actor: Actor): Promise<void>;

  delete(guildId: string, entryId: string, actor: Actor): Promise<void>;
}
```

### 7.4 AuditLogStore

```ts
interface AuditLogStore {
  append(log: SettingsAuditLog): Promise<void>;

  /**
   * 指定 guildId の監査ログを取得。
   * @returns createdAt 降順（新しい順）で最大 limit 件
   */
  listByGuild(guildId: string, limit: number): Promise<SettingsAuditLog[]>;
}
```

---

## 8. JSON ファイル Store（フェーズ1）

### 保存構成

```
data/
  guild-settings/{guildId}.json
  guild-members/{guildId}/{userId}.json
  dictionary/{guildId}.json
  audit/{guildId}.log.jsonl
```

### 同時書き込み前提

- 単一インスタンス運用
- atomic write + in-process mutex
- 複数インスタンスは DB 移行で対応

---

## 9. Runtime State（永続化しない）

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

---

## 10. 補足仕様（確定）

- `voice.speakerId`: number（v1固定）
- `nameRead.cooldownSec = 0`: 毎回名前を読む
- `limits.maxHiraganaLength`:
  - 読み上げ直前の正規化後テキスト
  - 厳密一致ではなく安全側

- `filters.codeBlockMode = SAY_CODE`:
  - 「コードがあります」と読む

- `Actor.displayName`:
  - 永続化しない（6節参照）
  - 表示時は Discord API から取得

- `opsNotify.channelId`:
  - string | null
  - nullの場合はサーバーに対して通知を行わない

---

## 11. 将来拡張（フェーズ2以降）

- schemaVersion 導入
- ユーザー別 engine 許可
- 名前読み専用辞書
- DB（PostgreSQL）移行

---

## 12. フェーズ1ゴール

- Contracts が唯一の正
- JSON → DB 差し替え可能
- Runtime State と永続データが分離
- Codex 実装がブレない
