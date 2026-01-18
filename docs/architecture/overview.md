# アーキテクチャ全体像

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
