# 変更ワークフロー

API の追加/変更およびコード変更時の標準手順。

## 1. API 変更の標準手順（契約ファースト）

順序を崩さないこと:

1. **packages/contracts** に zod schema と型を追加/更新（唯一の真実）
2. **apps/api** は contracts の schema で入力を検証（body/query/params）
3. **apps/bot** は DB ではなく API を呼び、型は contracts を参照
4. 設計に影響するなら **docs/architecture.md** を更新
5. 検証を実行し、結果を報告

## 2. 変更の作法（差分を小さく）

- 変更は小さく分割し、目的が明確な差分にする
- 差分が 200 行を超えそうなら着手前に確認する
- コミットメッセージは変更内容が分かるように具体的に書く
  - 例:「API の辞書更新エンドポイントに新規フィールドを追加」

## 3. 検証コマンド

部分確認（作業中の素早い確認に使う）:

```sh
pnpm --filter @yomicord/contracts build
pnpm --filter @yomicord/api build
pnpm --filter @yomicord/bot build
```

最終確認:

```sh
pnpm check          # format:check / lint / build
pnpm -r build       # 全パッケージビルド
```

- 手動確認が必要な場合は、再現手順（コマンド、期待結果）を必ず添える
