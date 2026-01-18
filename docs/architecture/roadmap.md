# 開発・運用・破壊的変更

## 1. 開発・運用の基本コマンド（例）

- `pnpm install`：依存導入
- `pnpm dev:api`：API 起動
- `pnpm dev:bot`：Bot 起動
- `pnpm -r build`：全体ビルド

## 2. 破壊的変更の扱い

- API の破壊的変更は `/v2` を検討する。
- contracts の schema の破壊的変更は避け、必要なら新 schema を追加して段階移行する。

## 3. 今後の拡張（ロードマップ例）

- apps/api：永続 DB 導入、参照 API 追加、認可強化、監査ログ
- apps/bot：スラッシュコマンド実装、読み上げキュー管理
- apps/web：辞書/設定管理 UI
