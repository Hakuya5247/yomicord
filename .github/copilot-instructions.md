# Copilot 指示（Yomicord）

このリポジトリは monorepo（pnpm workspace）です。生成・修正は以下に従ってください。

## Agent モードの運用

Agent モードの進め方（計画提示、確認質問、差分管理等）は **`AGENTS.md`** を参照する。

## 1. 基本方針（最重要）

- **DB アクセスは apps/api のみ**（bot/web は API 経由で操作）
- **packages/contracts が唯一の真実**（API 追加/変更は contracts → api → bot → docs の順）
- **設計の正は `docs/architecture.md`**（設計変更時は docs も更新）

## 2. パッケージ責務

- apps/api：入力検証、認可、永続化、整合性、監査ログ（ビジネスルールの中心）
- apps/bot：Discord からの入力と UX、読み上げ処理。設定・辞書変更は API を呼ぶだけ
- packages/contracts：API 入出力 schema（zod）と型のみ（HTTP/DB 実装は置かない）

## 3. 依存追加の方針

- TypeScript、tsx、zod、fastify、discord.js を基本とする
- 新規ライブラリ追加が必要な場合は「目的 / 代替案 / なぜ必要か」を短く残す（依存追加なしを優先）

## 4. 言語・スタイル

- コメント、ログ、Docs、コミットメッセージ、回答は日本語。関数名/変数名は英語

## 参照ドキュメント

- コーディング規約・禁止事項・影響チェック: `docs/coding-standards.md`
- API 変更手順・検証コマンド: `docs/runbooks/change-workflow.md`
- アーキテクチャ全体像: `docs/architecture.md`
- コマンド実行の安全性: `AGENTS.md` §4
