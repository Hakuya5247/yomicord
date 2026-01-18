# データフロー

## 1. 更新フロー（Bot → API）

- Bot で「辞書追加」コマンド
  1. apps/bot が入力を受け取る
  2. （可能なら）contracts schema で入力を整形/検証
  3. apps/api の endpoint に POST
  4. apps/api で **再度** schema 検証、認可、DB 更新、監査ログ
  5. apps/api が結果を返す
  6. apps/bot がユーザーに結果を表示

WebUI も同様に apps/api を呼び出す。

## 2. API 設計方針（最小）

- パスは `/v1/...` を基本とし、破壊的変更は `/v2` で対応する。
- エラー形式は以下に統一する（contracts を唯一の真実とする）：
  - 成功：`{ ok: true, ... }`
  - 失敗：`{ ok: false, error: { code: string, message: string, details?: unknown } }`
    - `code` は `VALIDATION_FAILED / UNAUTHORIZED / FORBIDDEN / NOT_FOUND / CONFLICT / INTERNAL`
    - `message` はユーザーに見せても安全な日本語（機微情報・内部例外の露出禁止）
    - `VALIDATION_FAILED` の `details` は zod の `flatten()` 互換（`formErrors` / `fieldErrors`）を基本とする
- 受け取る入力は必ず contracts の schema で検証する。
- 認可が関わる操作は API 側で必ず判定し、Bot/WebUI 側の推測に依存しない。
- 更新操作の Actor は `X-Yomicord-Actor-*` ヘッダーで受け取り、監査・認可に使う。
  - `Source` と `Occurred-At` は省略可（省略時は API が補完）
  - `Role-Ids` は JSON 配列文字列（URL エンコードは不要）
  - `Is-Admin` は "true" | "false" の文字列で渡す
- GuildMemberSettings API は `/v1/guilds/:guildId/members/:userId/settings` で提供する（GET/PUT/DELETE）。
  - GET は設定が存在しない場合 `null` を返す。
  - PUT は canonicalize 後に保存し、空なら削除する。
- DictionaryEntry API は `/v1/guilds/:guildId/dictionary` を起点に提供する（GET/POST/PUT/DELETE）。
  - GET は cursor 方式の pagination/limit 前提で一覧取得する（既定 limit: 50）。
  - cursor は `"{priority}:{surfaceLength}:{id}"` を base64 化した文字列（priority/length は降順）。
  - レスポンスは `items` と `nextCursor` を返す（終端は `nextCursor: null`）。
  - DictionaryEntry の操作は `X-Yomicord-Actor-User-Id` を必須とする。
  - POST は `guildId + surfaceKey` の重複をエラー扱いとする。
  - PUT は単一エントリの **全置換**（partial update ではない）。
  - DELETE は単一エントリ削除。
  - 認可は `permissions.manageMode` に連動し、API 側で判定する。
