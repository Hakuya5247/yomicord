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

## 3. 短い概要

- apps/api: 入力検証、認可、永続化、整合性、監査ログの中心
- apps/bot: Discord 入力と UX、API 経由での設定/辞書操作
- packages/contracts: API 入出力の schema と型（唯一の真実）
- packages/storage: 永続化方式に依存しない Store interface
- packages/storage-json: JSON ファイルによるフェーズ1実装

## 4. 詳細ドキュメント（索引）

### 4.1 アーキテクチャ詳細

- 全体像と責務: `docs/architecture/overview.md`
- データフロー: `docs/architecture/data-flow.md`
- 認証/認可・監査: `docs/architecture/auth-and-audit.md`
- ロードマップ: `docs/architecture/roadmap.md`

### 4.2 Contracts 詳細

- Contracts の設計方針/命名規則: `docs/contracts/index.md`
- エンティティ仕様: `docs/contracts/entities.md`
- Enum 一覧: `docs/contracts/enums.md`
- API 仕様（v1）: `docs/contracts/api-v1.md`
- Actor（操作コンテキスト）: `docs/contracts/actor.md`

### 4.3 Storage 詳細

- Storage 境界の概要: `docs/storage/overview.md`
- Store interface: `docs/storage/interfaces.md`
- JSON Store（フェーズ1）: `docs/storage/json-store.md`
- Runtime State: `docs/storage/runtime-state.md`
- Storage ロードマップ: `docs/storage/roadmap.md`
