# 監査ログ追記失敗の運用手順（Runbook）

対象: 運用担当（Bot管理者）

## 目的

監査ログの欠落を早期検知し、必要に応じて補完して整合性を保つ。

## 1. 検知（アラート条件）

- 対象ログ文言: `監査ログの追記に失敗しました`
- 推奨アラート:
  - 直近 5 分で 3 回以上
  - 3 回連続で発生
  - 15 分以上継続

## 2. 初動確認

ログから以下を抽出する。

- `guildId`
- `entityType` / `entityId`
- `action` / `path`
- `actorUserId`
- 例外内容（`err`）

## 3. 影響確認

- 対象 API と操作種別を特定する（Settings / MemberSettings / Dictionary）。
- 実データの状態を API 取得で確認する。
- 変更が反映済みかを判断する。

## 4. 補完方針

- 監査ログが欠落している場合のみ補完する。
- 補完の前提情報:
  - API リクエストログ（URL / body / actor）
  - 対象エンティティの変更後状態
- `createdAt` は本来の `occurredAt` を再現する。

## 5. 補完手順（例）

- JSONL への追記で監査ログを追加する。
- 追加レコードの最低項目:
  - `id`（UUID）
  - `guildId`
  - `entityType` / `entityId`
  - `action` / `path`
  - `before` / `after`
  - `actorUserId` / `source`
  - `createdAt`

## 6. 事後対応

- 同期間の類似エラーを確認する。
- 必要に応じて監視閾値を見直す。
