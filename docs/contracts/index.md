# Contracts 設計（フェーズ1 / v2 確定版）

本ドキュメントは、Discord読み上げBot「Yomicord」における
**設定・辞書・監査ログのデータ構造（Contracts）** を定義する。

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
