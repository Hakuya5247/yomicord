# Copilot 指示（Yomicord）

このリポジトリは monorepo（pnpm workspace）です。生成・修正は以下のルールに従ってください

## 0. 言語・スタイル

- **コードコメント、ログ文、README/Docs、コミットメッセージや回答は日本語**を基本とする
- 関数名/変数名は英語で良い（一般的な TypeScript の慣習に合わせる）

## 1. リポジトリの基本方針（最重要）

- **DB へのアクセス（読み書き）は apps/api のみ**が行う
  - apps/bot / apps/web は DB に直接触らない。必ず apps/api の HTTP API 経由で操作する
- **API 入出力の定義は packages/contracts を唯一の真実（Source of Truth）**とする
  - 新規 API を追加/変更する場合、まず packages/contracts に zod schema と型を追加し、apps/api 側でも必ず schema で検証する
- アーキテクチャの全体像は `docs/architecture.md` を正とする。設計に影響する変更を行う場合は docs も更新する

## 2. パッケージ責務

- apps/api：入力検証、認可、永続化、整合性、監査ログを担当する（ビジネスルールの中心）
- apps/bot：Discord からの入力と UX、読み上げ処理。設定・辞書変更は API を呼ぶだけにする
- packages/contracts：API 入出力 schema（zod）と型の定義のみ。HTTP 実装や DB 実装は置かない

## 3. 変更の作法

- 変更は小さく分割し、目的が明確な差分にする
- 追加・変更したら、少なくとも以下が通る状態にする：
  - `pnpm -r build`
- 実行例や手動確認手順（curl、ログ確認など）を必要に応じて README/Docs に追記する
- コミットメッセージは変更内容が分かるように具体的に書く（例：「API の辞書更新エンドポイントに新規フィールドを追加」）
- コードの変更をする際、変更量が200行を超える可能性が高い場合は、事前に「この指示では変更量が200行を超える可能性がありますが、実行しますか?」とユーザーに確認をとるようにしてください。

## 4. API 実装のルール（apps/api）

- リクエスト body/query/params は **必ず** contracts の schema で検証する（safeParse/parse どちらでも可）
- 認可が必要な更新は API 側で判定できる構造を維持する（Bot 側の推測に依存しない）
- エラーは将来的に統一するため、レスポンス形式を乱立させない

## 5. Bot 実装のルール（apps/bot）

- Bot で設定・辞書を更新する場合は API を呼ぶ（fetch 等）
- Token 等の秘密情報はコードに直書きしない。環境変数を使用する

## 6. 追加して良い依存の方針（当面）

- TypeScript、tsx、zod、fastify、discord.js を基本とする
- 新規ライブラリ追加が必要な場合は、追加理由と代替案をコメント/PR 説明に残す

## 7. 禁止事項

- apps/bot / apps/web から DB に直接接続する実装
- contracts を無視して独自の入力/出力形式を増やすこと
- 秘密情報（トークン、接続文字列等）をリポジトリにコミットすること
- 大規模な変更を一度に行い、レビューや理解を困難にすること
