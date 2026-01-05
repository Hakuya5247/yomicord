# Copilot 指示（Yomicord）

このリポジトリは monorepo（pnpm workspace）です。生成・修正は以下に従ってください。

<!-- 追加: Agentモード運用は分離済み -->

## Agent モードの運用について（参照先）

- Agent モードの進め方（計画提示、確認質問、差分管理、チェックリスト等）の詳細は **`/workspaces/yomicord/AGENTS.md`** を参照する
- このファイルは「生成時に常に守るべき恒久ルール（境界・契約・安全性）」を扱う

## 0. 言語・スタイル

- **コードコメント、ログ文、README/Docs、コミットメッセージや回答は日本語**を基本とする
- 関数名/変数名は英語で良い（一般的な TypeScript の慣習に合わせる）

## 1. リポジトリの基本方針（最重要）

- **DB へのアクセス（読み書き）は apps/api のみ**
  - apps/bot / apps/web は DB に直接触らない。必ず apps/api の HTTP API 経由で操作する
- **API 入出力の定義は packages/contracts を唯一の真実（Source of Truth）**
  - 新規 API を追加/変更する場合、まず packages/contracts に zod schema と型を追加し、apps/api 側でも必ず schema で検証する
- アーキテクチャの全体像は `docs/architecture.md` を正とする（設計に影響する変更は docs も更新）

## 2. パッケージ責務

- apps/api：入力検証、認可、永続化、整合性、監査ログ（ビジネスルールの中心）
- apps/bot：Discord からの入力と UX、読み上げ処理。設定・辞書変更は API を呼ぶだけにする
- packages/contracts：API 入出力 schema（zod）と型のみ（HTTP/DB 実装は置かない）

## 4. 変更の作法（差分を小さく）

- 変更は小さく分割し、目的が明確な差分にする
- コミットメッセージは変更内容が分かるように具体的に書く  
  例：「API の辞書更新エンドポイントに新規フィールドを追加」
- コメントについて
  - 今は理解のためのコメントを書いてOK
  - 「なぜ」「比較」「注意点」は積極的に書く
  - 将来消す前提のコメントがあっても気にしない
  - 定期的に「これはもう分かる？」と自分に問う
  - テストコードに対してもコメントを記述してOK

## 5. API 変更の標準手順（契約ファースト）

API の追加/変更は次の順で行う（順序を崩さない）：

1. packages/contracts に zod schema と型を追加/更新（唯一の真実）
2. apps/api は contracts の schema で入力を検証する（body/query/params）
3. apps/bot は DB ではなく API を呼び、型は contracts を参照する
4. 設計に影響する変更は docs/architecture.md も更新する
5. 検証（後述）を実行する

## 6. 実装ルール

### 6.1 apps/api

- リクエスト body/query/params は **必ず** contracts の schema で検証する（safeParse/parse どちらでも可）
- 認可が必要な更新は API 側で判定できる構造を維持する（Bot 側の推測に依存しない）
- エラーは将来的に統一するため、レスポンス形式を乱立させない

### 6.2 apps/bot

- Bot で設定・辞書を更新する場合は API を呼ぶ（fetch 等）
- Token 等の秘密情報はコードに直書きしない。環境変数を使用する

## 7. 依存追加の方針（当面）

- TypeScript、tsx、zod、fastify、discord.js を基本とする
- 新規ライブラリ追加が必要な場合は「目的 / 代替案 / なぜ必要か」を短く残す（依存追加なしを優先）

## 8. 秘密情報・ログ

- トークン、接続文字列、Cookie、個人情報などの秘匿情報をログに出さない
- 秘密情報をコマンドに直書きしない（必要なら環境変数を使う）
- `.env` や鍵ファイル等を新規作成/更新する場合は、**実行前にユーザー確認**を取る
- ログ/エラー文は日本語で、状況・原因・次の行動が分かる文にする

## 9. 禁止事項

- apps/bot / apps/web から DB に直接接続する実装
- contracts を無視して独自の入力/出力形式を増やすこと
- 秘密情報（トークン、接続文字列等）をリポジトリにコミットすること
- 大規模な変更を一度に行い、レビューや理解を困難にすること

## 10. 検証（必須）

- 原則、変更後は `pnpm check`（format:check / lint / build）を通す
- 作業中の素早い確認は部分実行してよい：
  - `pnpm --filter @yomicord/contracts build`
  - `pnpm --filter @yomicord/api build`
  - `pnpm --filter @yomicord/bot build`
- ただし最終的には `pnpm -r build` または `pnpm check` の成功を報告する
- 手動確認が必要な場合は、再現手順（コマンド、期待結果）を必ず添える

## 11. コマンド実行の安全性

- 読み取り系（例：`ls`, `cat`, `grep`, `git status`）は自動実行してよい
- 破壊的・外部影響がある操作は、実行前に「目的・対象・影響範囲」を1〜2文で述べ、ユーザー確認を取る

### 11.1 デフォルトで実行禁止（要確認）

- 削除/破壊：`rm -rf`, `rm -r`, `git clean -fdx`
- 権限/所有者の広範囲変更：`sudo`, `chmod -R`, `chown -R`
- 履歴改変/強制：`git reset --hard`, `git push --force`, （push 済みブランチへの）`git rebase`
- 不透明な外部実行：`curl ... | sh` / `wget ... | bash`
- グローバルインストール：`npm i -g`, `pnpm add -g`

### 11.2 実行してよいが注意（差分が広がりやすい）

- `pnpm install` / `pnpm add`：必要性を説明し、最小差分を優先する
- `pnpm format` / `pnpm lint:fix`：意図せず変更が増えるため、依頼がある/必要性がある場合のみ

## 13. 影響範囲チェックリスト（変更時に必ず確認）

- contracts を変更した：
  - apps/api の入力検証（schema 適用箇所）を更新したか
  - apps/bot の呼び出し（payload/型）を更新したか
  - docs/architecture.md の更新要否を確認したか
- apps/api を変更した：
  - 認可判断が apps/bot 側の推測に寄っていないか（API が正になっているか）
  - ルートのバージョニング方針（例：`/v1`）を崩していないか
- apps/bot を変更した：
  - DB 直アクセスが混入していないか（API 経由のみ）
  - 失敗時のユーザー向けメッセージが日本語になっているか
  - 秘密情報をログ出力していないか
