# SettingsAuditLog API を一覧取得のみで提供する

## Context

- 監査ログはフェーズ1から必ず残す方針であり、Bot/将来の WebUI から参照できる必要がある。
- SettingsAuditLog は API 側が内部的に追記するデータであり、クライアントからの作成・更新は不要である。
- Store には guild 単位で最新 N 件を取得する操作が用意されている。
- 認可は API 側で完結させる設計であり、閲覧でも Actor 情報が必要になる。

## Decision

- SettingsAuditLog は「一覧取得のみ」の API を提供する。
  - エンドポイントは `/v1/guilds/:guildId/audit-logs` とする。
  - 取得件数は `limit` のみを受け付け、未指定時は既定値を補完して createdAt 降順の最新 N 件を返す。
- 認可は `permissions.manageMode` に連動させ、API 側で判定する。
- 認可に必要な Actor は `X-Yomicord-Actor-*` ヘッダーで受け取る。
  - `User-Id` / `Role-Ids` / `Is-Admin` を必須とし、その他は任意とする。
- 作成・更新・削除 API は提供しない（監査ログは API 内部でのみ追記する）。
- 具体的な入出力の詳細は `docs/contracts-and-storage.md` の該当節を正とする。

## Consequences

### 利点

- 監査ログが読み取り専用になり、改ざん経路を最小化できる。
- 既存の Store 仕様と整合し、実装が単純になる。
- Bot / 将来の WebUI から共通の参照が可能になる。

### 欠点

- pagination/cursor や期間指定がなく、長期履歴の閲覧に制約がある。
- entityType/actor などの条件で絞り込みできない。

### 今後の影響

- ログ肥大化や運用要件に応じて、pagination/cursor や期間指定の追加を再検討する。
- 取得条件の追加は contracts 変更を伴うため、互換性に注意が必要になる。
- pagination/cursor を追加する場合、Store の取得インターフェース拡張が必要になる。

## Alternatives

- pagination/cursor を最初から追加する。
- entityType/actor/action などのフィルタ付き一覧 API を提供する。
- エンティティ別の監査ログ取得 API（例: `dictionary/:entryId/audit-logs`）を提供する。
