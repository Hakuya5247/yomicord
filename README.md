# Yomicord(よみこ〜ど)

Discord のチャットを音声で読み上げる Bot（将来的に WebUI で設定管理）を想定した monorepo（pnpm workspace）です。

## 重要な方針（最優先）

- **DB へのアクセス（読み書き）は apps/api のみ**
  - `apps/bot` / `apps/web`（将来）は **API 経由のみ**で設定・辞書を操作する
- **API 入出力は packages/contracts が唯一の真実（Source of Truth）**
  - 新規/変更はまず `packages/contracts` に zod schema と型を追加し、`apps/api` 側でも必ず schema で検証する

詳細は `docs/architecture.md` を参照。

## リポジトリ構成（概要）

- `apps/api`：Backend API（検証/認可/永続化/整合性/監査ログ）
- `apps/bot`：Discord Bot（UX と読み上げ。設定/辞書は API 呼び出しのみ）
- `packages/contracts`：API 入出力 schema（zod）と型（HTTP/DB 実装は置かない）
- `docs/`：設計・運用ドキュメント

## セットアップ

前提：Node.js / pnpm（dev container 利用を想定）

```bash
pnpm install
```

## 開発

```bash
# API 起動（workspace: @yomicord/api）
pnpm dev:api

# Bot 起動（workspace: @yomicord/bot）
pnpm dev:bot

# contracts 開発（workspace: @yomicord/contracts）
pnpm dev:contracts
```

## ビルド（必須）

```bash
pnpm -r build
```

## チェック（推奨）

フォーマット/Lint/ビルドをまとめて実行します。

```bash
pnpm check
```

## CI（GitHub Actions）

PR / push 時に GitHub Actions で `pnpm -r build` を実行します（workflow: `.github/workflows/ci.yml`）。

## フォーマット / Lint

- フォーマット: Prettier（`.prettierrc.cjs`, `.prettierignore`）
  - `pnpm format` / `pnpm format:check`
- Lint: ESLint（`eslint.config.cjs`）
  - `pnpm lint` / `pnpm lint:fix`

## 変更時のルール（実装者向け）

- API を追加/変更する場合：
  1. `packages/contracts` に schema/型を追加（これが正）
  2. `apps/api` で schema による入力検証を実装
  3. `apps/bot` は API を呼ぶだけ（DB 直アクセス禁止）
- 設計に影響する変更を行う場合は `docs/architecture.md` も更新する
- 秘密情報（トークン等）をコードに直書きしない（環境変数を使用）

## ドキュメント

- アーキテクチャ: `docs/architecture.md`

## 開発コンテナ補足

ホストのブラウザで URL を開く場合：

```bash
"$BROWSER" <url>
```

## ライセンス

このプロジェクトは Apache License 2.0 のライセンスに従います。詳細は LICENSE ファイルをご参照ください。  
このソフトウェアは、音声合成のために VOICEVOX を使用しています。VOICEVOX には、独自のライセンス条項が適用されます。
