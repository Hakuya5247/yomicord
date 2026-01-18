# Yomicord アーキテクチャ概要

## TL;DR（AI向け要約）

- DBへの読み書きは apps/api のみ
- APIの入出力は packages/contracts が唯一の真実
- Bot / Web は UX 専用、認可・整合性は API
- API変更は contracts → api → bot → docs の順
- 設計変更があれば architecture.md を更新する

## 1. 目的

Yomicord は Discord のチャットを音声で読み上げる Bot であり、将来的に WebUI からも辞書・読み上げ設定等を変更できる運用を想定する。
複数のクライアント（Bot / WebUI）が同一の設定を更新する前提で、整合性・監査・拡張性を優先する。

補足（開発手順・コマンドの入口）は `README.md` を参照する。

## 2. 重要な方針（必ず守る）

- **単一更新窓口（Single Writer）**：DB への読み書きは **apps/api のみ**が行う。
  - apps/bot / apps/web は **API 経由でのみ**設定・辞書を変更する。
- **Contracts を唯一の真実（Source of Truth）**：API の入出力は packages/contracts に定義された schema（zod）と型を正とする。
  - 新規 API を作る場合、まず contracts に schema を追加し、API 側でも必ず検証する。
- **運用を見据えた責務分離**：Bot / WebUI は UI/UX（コマンド・画面）に集中し、認可・検証・整合性・監査は API に集約する。

## 3. リポジトリ構成（最小骨格）

```
yomicord/
├─ apps/
│ ├─ api/ # 唯一のDB窓口（認可/検証/整合性/監査を集約）
│ └─ bot/ # Discord Bot（API経由で設定/辞書を変更）
├─ packages/
│ ├─ contracts/ # API入出力の schema と型（zod） + defaults/pure helpers
│ ├─ storage/ # 永続化方式に依存しない Store interface（境界）
│ └─ storage-json/ # JSON ファイル実装（フェーズ1）
└─ docs/
└─ architecture.md
```

将来的に `apps/web`（管理UI）を追加する。Bot と同様に API 経由で操作する。

## 4. コンポーネント責務

### 4.1 apps/api（Backend API）

責務：

- HTTP API の提供（辞書/設定の参照・更新）
- 入力検証（contracts の zod schema による検証）
- 認可（誰がどの guild の設定を変更可能か）
- 永続化（DB）
- 整合性（トランザクション、ユニーク制約、上限制限）
- 監査ログ（変更履歴、必要なら誰が変更したか）
- 変更通知（将来的にキャッシュ更新や bot への通知が必要なら検討）

構成（apps/api 内）：

- `src/app.ts` は配線のみ（Fastify 初期化・ストア生成・ヘルパー生成・ルート登録）
- ルート定義は `src/app/routes/` に機能単位で分割
- HTTP 境界の共通処理（エラー整形・Actor 解析・認可）は `src/app/http/` に集約
- 監査ログの横断処理は `src/app/audit-log.ts` に集約
- 依存注入用の型（`AppStores` / `AppHelpers`）は `src/app/internal/` に置き外部公開を避ける

非責務：

- Discord のイベント処理やコマンド UX（apps/bot）
- UI 表示（apps/web）

### 4.2 apps/bot（Discord Bot）

責務：

- Discord からの入力（コマンド、メッセージ）を受ける
- 認可が必要な操作は **API に判断させる**（Bot 側で決め打ちしない）
- API 呼び出しにより辞書・設定を変更/参照する
- 音声読み上げ（音声エンジンとの統合は将来的に packages 化しても良い）

非責務：

- DB 直接アクセス
- 辞書/設定の整合性ロジックの重複実装

### 4.3 packages/contracts

責務：

- API 入出力の schema（zod）と型の定義
- デフォルト値生成、正規化、canonicalize などの pure helpers
- Store 境界で利用する型（Actor など）
- 破壊的変更を避けたバージョニング方針（後述）

非責務：

- DB アクセス、HTTP 実装

### 4.4 packages/storage（Storage 境界）

責務：

- Store interface の定義（永続化方式に依存しない）
- エラーは例外で表現（Result 型は使わない）

非責務：

- 永続化の実装

### 4.5 packages/storage-json（フェーズ1 実装）

責務：

- JSON ファイルを永続化先とした Store 実装
- atomic write（temp file → rename）
- 読み書き時の Zod validate
- 監査ログは JSON Lines 形式

## 5. データフロー（更新）

- Bot で「辞書追加」コマンド
  1. apps/bot が入力を受け取る
  2. （可能なら）contracts schema で入力を整形/検証
  3. apps/api の endpoint に POST
  4. apps/api で **再度** schema 検証、認可、DB 更新、監査ログ
  5. apps/api が結果を返す
  6. apps/bot がユーザーに結果を表示

WebUI も同様に apps/api を呼び出す。

## 6. API 設計方針（最小）

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
  - `Is-Admin` は `"true" | "false"` の文字列で渡す
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

## 7. データモデル（高レベル）

最低限、以下を永続化対象として想定する：

- guild_settings（サーバー単位）
  - 読み上げ方針・音声デフォルト（engine はここにのみ存在）
- guild_member_settings（ユーザー単位の部分上書き）
  - voice の一部と nameRead.normalize のみ
- dictionary_entries（本文辞書）
  - surface/surfaceKey/reading/priority/isEnabled
  - 制約：`(guildId, surfaceKey)` をユニーク（重複防止）
- settings_audit_logs（監査ログ）
  - entityType/entityId/action/path/before/after/actorUserId/source/createdAt

フェーズ1では DB は導入せず、JSON ファイルを永続化先とする（DB は将来差し替え）。

保存構成（フェーズ1）：

```
data/
  guild-settings/{guildId}.json
  guild-members/{guildId}/{userId}.json
  dictionary/{guildId}.json
  audit/{guildId}.log.jsonl
```

※ Runtime State（読み上げ対象チャンネル等）は永続化しない。

## 8. 認証/認可（将来の運用を見据えた方針）

- Bot 経由の操作：
  - Discord の権限（管理者等）を Bot が確認し、**API にもコンテキストを渡す**
  - API 側でも最低限の検証（guildId の妥当性、必要な権限情報の検証）を行う
- WebUI：
  - Discord OAuth2 を想定
  - API はアクセストークン（またはセッション）に基づいて認証する
- GuildMemberSettings の認可:
  - `Actor.userId` と `:userId` の一致を API 側で必須とする（フェーズ1では本人のみ操作可）

※ 初期は簡略化しても良いが、最終的に「API が認可の正」となるように寄せる。

## 9. ロギング/監査

- apps/api はリクエストログを記録する（開発時は詳細、本番は個人情報に配慮）。
- 設定変更や辞書更新は「誰が/いつ/何を」変更したかを監査ログとして残す（フェーズ1から必須）。
- 監査ログは更新系 API のみで保存する（GET/閲覧は対象外）。
- 監査ログは API 内で同期的に追記し、追記失敗時は API は成功を返す（運用で検知・補完する）。
- 変更が複数ある場合は「変更ごとに 1 ログ」を作成する（同一時刻・同一 entityId）。
- 同一リクエスト内のログ順は `path` の辞書順で安定化し、`path = null` は末尾に置く。
- 差分抽出はネストまで含む深い比較とし、`path` は `"a.b.c"` 形式で記録する。
- `createdAt` は `X-Yomicord-Actor-Occurred-At` を優先し、未指定時は API 時刻とする。
- 監査ログ追記失敗時の運用手順は `docs/runbooks/audit-log.md` に記載する。

## 10. 開発・運用の基本コマンド（例）

- `pnpm install`：依存導入
- `pnpm dev:api`：API 起動
- `pnpm dev:bot`：Bot 起動
- `pnpm -r build`：全体ビルド

## 11. 破壊的変更の扱い

- API の破壊的変更は `/v2` を検討する。
- contracts の schema の破壊的変更は避け、必要なら新 schema を追加して段階移行する。

## 12. 今後の拡張（ロードマップ例）

- apps/api：永続 DB 導入、参照 API 追加、認可強化、監査ログ
- apps/bot：スラッシュコマンド実装、読み上げキュー管理
- apps/web：辞書/設定管理 UI
