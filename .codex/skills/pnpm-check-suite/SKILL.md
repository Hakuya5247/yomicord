---
name: pnpm-check-suite
description: 変更後の検証を標準化し、部分検証→全体検証（pnpm check）を実行する
metadata:
  short-description: 検証コマンドの定型
---

# pnpm-check-suite

この skill は、検証手順を標準化する。

## ルール

- 影響範囲に近い検証から先に実行する。
- 部分検証が成功した後に全体検証を行う。

## コマンド

- pnpm --filter @yomicord/contracts build
- pnpm --filter @yomicord/api build
- pnpm --filter @yomicord/bot build
- pnpm check
