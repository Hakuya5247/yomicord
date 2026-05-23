# AGENTS.md（Yomicord）

> GitHub Copilot Agent / OpenAI Codex 共通の運用ルール。monorepo（pnpm workspace）前提。

## 1. 最重要ルール

- **DB アクセスは apps/api のみ**（bot/web は API 経由で操作）
- **packages/contracts が唯一の真実**（API 追加/変更は contracts → api → bot → docs の順）
- **設計の正は docs/architecture.md**（設計変更時は docs も更新）
- .envなど、機密情報が含まれる可能性のあるファイルの閲覧禁止

## 2. 言語・スタイル

- コメント、ログ、Docs、回答は日本語。関数名/変数名は英語

## 3. Agent の基本動作

- 着手前に 2〜6 ステップの計画を提示する
- 要件が曖昧なら最大 3 つまで確認質問してから実装する（推測で仕様を増やさない）
- 設計上の決定事項は ADR（docs/adr）に記録する
- 依頼範囲外の改善（UX 追加、設計変更、過剰リファクタ、依存追加）はしない
- 変更は小さく分割する。200 行を超えそうなら着手前に確認する
- コーディング規約・コメントガイドラインは `docs/coding-standards.md` に従う

### 成果物フォーマット（Codex 向け）

Why / What / 影響範囲（contracts・api・bot・docs）/ 実行コマンドと結果 / 残タスク

## 4. コマンド実行ポリシー

判断基準: **git で元に戻せるなら止めない、共有状態・機密・システムに触るなら止める。**

### 自動実行 OK（リカバリ可能）

- 読み取り系: git status, git diff, ls, cat, grep 等
- ビルド/テスト: `pnpm --filter ... build`, `pnpm check`, `pnpm test` 等
- git 管理下ファイルの削除・上書き（`git checkout` で復元可能）
- ビルド成果物・キャッシュ削除（dist/, node_modules/, .turbo 等）
- `pnpm install`（lockfile は git で追跡可能）

大量出力が見込まれる場合は事前に一言断る。

### 注意して実行（ログに残して続行）

- `git clean`: 事前に `git status` で未追跡ファイルを確認・ログ出力してから実行
- `pnpm add <pkg>`: 理由を明記して続行
- `pnpm format/lint:fix`: 差分を意識して続行

### 要確認（停止して待つ）

- リモート/共有状態: git push --force, git reset --hard（published commits）
- システムレベル: sudo, chmod -R, chown -R
- 外部実行: curl|sh, wget|bash, npm i -g
- 機密: .env 新規作成/更新、トークン/接続文字列の入力

確認時は「目的・対象・影響範囲」を 1〜2 文で説明してから待つ。

## 5. 確認質問テンプレ（曖昧な場合のみ、最大 3 つ）

- 期待する入出力（payload の例、必須/任意、デフォルト値）
- 失敗時の扱い（ユーザー通知、冪等性、リトライ要否）
- 互換性（既存クライアントへの影響、移行が必要か）

## 参照ドキュメント

- 実装ルール・禁止事項・影響チェック: `docs/coding-standards.md`
- API 変更手順・検証コマンド: `docs/runbooks/change-workflow.md`
- アーキテクチャ全体像: `docs/architecture.md`
