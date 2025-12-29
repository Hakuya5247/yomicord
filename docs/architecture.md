# Yomicord アーキテクチャ概要

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
│ └─ contracts/ # API入出力の schema と型（zod）
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
- 破壊的変更を避けたバージョニング方針（後述）

非責務：

- DB アクセス、HTTP 実装

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
- エラー形式は将来的に統一する（例）：
  - 成功：`{ ok: true, ... }`
  - 失敗：`{ ok: false, code: string, message: string, details?: unknown }`
- 受け取る入力は必ず contracts の schema で検証する。
- 認可が関わる操作は API 側で必ず判定し、Bot/WebUI 側の推測に依存しない。

## 7. データモデル（高レベル）

最低限、以下を永続化対象として想定する：

- guild_settings（サーバー単位）
  - 読み上げON/OFF、対象チャンネル、音量、速度、話者ID、その他オプション
- user_settings（ユーザー単位、必要なら）
  - 個別の話者/読み方など
- dictionary_entries（辞書）
  - guildId、word、yomi、createdAt、updatedAt
  - 制約：`(guildId, key)` をユニーク（重複防止）

※ 初期は SQLite などでも良いが、運用を見据えるなら Postgres を本命とする。

## 8. 認証/認可（将来の運用を見据えた方針）

- Bot 経由の操作：
  - Discord の権限（管理者等）を Bot が確認し、**API にもコンテキストを渡す**
  - API 側でも最低限の検証（guildId の妥当性、必要な権限情報の検証）を行う
- WebUI：
  - Discord OAuth2 を想定
  - API はアクセストークン（またはセッション）に基づいて認証する

※ 初期は簡略化しても良いが、最終的に「API が認可の正」となるように寄せる。

## 9. ロギング/監査

- apps/api はリクエストログを記録する（開発時は詳細、本番は個人情報に配慮）。
- 設定変更や辞書更新は、必要なら「誰が/いつ/何を」変更したかを監査ログとして残せる構成にする。

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
