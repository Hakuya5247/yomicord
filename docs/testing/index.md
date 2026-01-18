# テストガイド

このドキュメントは、Yomicord のテスト方針・構成・実行方法・追加時のルールをまとめた開発者向けの網羅ガイドです。

## 目的

- 仕様に対する安全性を高める
- 変更時に壊れた箇所を早期に検知する
- テスト配置と責務を明確にし、迷いを減らす

## 前提

- テストランナーは Vitest
- ルートの `vitest.config.ts` により、以下のプロジェクトを対象にする
  - `packages/contracts`
  - `apps/api`
  - `apps/bot`
- ルートの `pnpm test` で全体テストを実行する

## テストの責務と境界

- **DB へのアクセス（読み書き）は apps/api のみ**
  - `apps/bot` / `apps/web` から DB 直アクセスは禁止
- **API の入出力は packages/contracts が唯一の真実**
  - テストも contracts の schema と整合する前提で設計する

## 設定詳細

- vitest の設定: [vitest.config.ts](../vitest.config.ts)
- `test.projects` に `packages/contracts` / `apps/api` / `apps/bot` を定義している
- ルートの `pnpm test` は上記のプロジェクトを対象に実行される
- 個別実行は `--project` を使う（例: `apps/api`）

## ディレクトリ構成

### API

```
apps/api/src/__tests__/routes/
  _setup.ts
  audit-logs.test.ts
  dictionary.test.ts
  guild-settings.test.ts
  health.test.ts
  member-settings.test.ts
```

- ルートテストは機能領域ごとに分割する
- 共通セットアップは `_setup.ts` に集約する

### Bot

```
apps/bot/src/*.test.ts
```

- Bot のテストは対象ロジックの隣に置く

### Contracts / Storage

- `packages/contracts` / `packages/storage*` は必要に応じて追加
- 正規化・検証ロジックのテストは contracts 側に置く

## 命名規則

- ファイル: `*.test.ts`
- describe 名: `api: routes: <領域>` のように領域を明示する
- テスト名: 「何を」「どう返す/拒否する」を日本語で書く

## 共通セットアップ（API）

`apps/api/src/__tests__/routes/_setup.ts` を利用する。

- `setupTestApp()` は `beforeEach/afterEach` を内部で持つ
- `getApp()` / `getDataDir()` で `app` と一時データディレクトリを取得できる
- テスト間の独立性のため、毎回 tmp ディレクトリを作る

例:

```ts
import { setupTestApp } from './_setup.js';

describe('api: routes: health', () => {
  const { getApp } = setupTestApp();

  it('GET /health は ok=true を返す', async () => {
    const app = getApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });
});
```

## API テストの基本指針

### ヘッダーの扱い

- actor 系ヘッダーが必須のルートは、欠落時の 400/403 も必ずテストする
- 管理者向け API は以下のようにヘッダーを明示する

例:

```ts
const adminHeaders = {
  'x-yomicord-actor-user-id': '999',
  'x-yomicord-actor-source': 'api',
  'x-yomicord-actor-is-admin': 'true',
  'x-yomicord-actor-role-ids': '[]',
};
```

### 監査ログ

- `x-yomicord-actor-occurred-at` を設定し、ログの時刻を固定する
- `dataDir` 配下に JSONL を書き込み、境界値を検証する

### リクエスト/レスポンス

- `packages/contracts` の schema と整合する値を使う
- レスポンスは `ok` フラグや `error` 形式を明示的に検証する

## Bot テストの基本指針

- Discord API は直接叩かず、依存をモックする
- `vi.fn()` や `vi.spyOn()` を使い、副作用の有無を検証する
- ログ文は日本語で期待値を持つ

## 追加時のチェックリスト

- [ ] 追加/変更した機能に対応するテストがある
- [ ] API の入力検証・認可失敗のケースを含めた
- [ ] テストは相互に独立している（前のテストに依存しない）
- [ ] 監査ログなど時間依存の値は固定値を使っている
- [ ] 機能領域のファイルに追加されている

## テストの実行方法

- 全体実行:

```bash
pnpm test
```

- 特定プロジェクトのみ:

```bash
pnpm -w exec vitest run --project apps/api
```

- 特定ファイルのみ:

```bash
pnpm -w exec vitest run apps/api/src/__tests__/routes/guild-settings.test.ts
```

## よくある判断基準

- **どこにテストを書くか**
  - API ルートの挙動: `apps/api/src/__tests__/routes/`
  - 正規化/検証ロジック: `packages/contracts`
  - Bot のイベント処理: `apps/bot/src` の隣
- **迷ったら**
  - まず機能領域のテストに追加し、後で分離する
- **ファイルが肥大化したら**
  - 目安は **350〜450行** で分割を検討する
  - 行数だけで判断せず、以下に該当するなら早めに分割する
    - 1ファイルに機能領域が2つ以上混在している
    - `describe` が 6〜8 個以上ある
    - 同じヘッダー/セットアップの繰り返しが目立つ
  - 共通セットアップは `_setup.ts` に切り出す

## コメントの扱い

- テストコードにもコメントを書いてよい
- 「なぜ」「比較」「注意点」は積極的に書く
- 「なぜこのテストが必要か」が不明確な場合はコメントで補足する
- 一時的なコメントも許容し、定期的に「これはもう分かる?」と自分に問い、不要になったら削除してよい

## 注意事項

- 秘密情報（トークン等）をテストやログに出さない
- 外部ネットワークを使うテストは追加しない
- 変更が設計に影響する場合は `docs/architecture.md` も更新する
