---
name: contract-first-api-change
description: API追加・変更を契約ファーストで進める（contracts→api→bot→docs→verify）
metadata:
  short-description: API(apps/api)変更の標準手順
---

# contract-first-api-change

この skill は、契約ファーストによる API 変更手順を強制する。

## 手順

1. `packages/contracts` に schema を追加または更新する。
2. `apps/api` を contract 定義に合わせて更新する。
3. `apps/bot` を API 利用のみで更新する（DB 直アクセス禁止）。
4. 振る舞いや構造が変わる場合、ドキュメントを更新する。
5. 検証コマンドを実行する。

## 検証コマンド

- pnpm --filter @yomicord/contracts build
- pnpm --filter @yomicord/api build
- pnpm --filter @yomicord/bot build
- pnpm check
