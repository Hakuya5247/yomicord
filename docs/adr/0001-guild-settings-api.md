# ADR-0001: GuildSettings API の設計（GET/PUT 全置換方式）

## Status

採用（2026-01-14）

## Context

- Bot と将来的な WebUI の双方から同一の設定を参照・更新できる API が必要。
- フェーズ1では JSON ファイルを永続化先とし、DB 移行を見据えた Store 境界を定義済み。
- Bot の基本機能（設定変更コマンド）実装のため、API 設計を確定する必要がある。
- 設定の唯一の正は packages/contracts に置き、API はそれに従う前提。
- 更新時の監査・認可に必要な最小情報（Actor）を API へ渡す必要がある。

## Decision

- `/v1/guilds/:guildId/settings` にて GuildSettings を扱う API を定義する。
  - GET: 現在の設定を取得する（存在しない場合はデフォルト値を返す）。
  - PUT: GuildSettings 全体を全置換で更新する。
- Actor 情報は `X-Yomicord-Actor-*` のカスタムヘッダーで受け取る。
  - `X-Yomicord-Actor-User-Id`: 操作者の Discord User ID（Bot からの操作時は必須、system 操作時は null）
  - `X-Yomicord-Actor-Role-Ids`: JSON 配列文字列（URL エンコード不要）
  - `X-Yomicord-Actor-Is-Admin`: `"true"` / `"false"` の文字列
  - `X-Yomicord-Actor-Source`: 操作元（`command` / `api` / `system` / `migration`、省略時は `system`）
  - `X-Yomicord-Actor-Occurred-At`: 操作日時（ISO 8601、省略時は API サーバー時刻）
  - ※ DisplayName は永続化せず、監査ログ表示時に Discord API から取得
- 認可は `permissions.manageMode` に連動し、API 側で判定する。
- API 入出力の schema は packages/contracts を唯一の真実とする。

## Consequences

### 利点

- Bot と WebUI で同一の API を共有でき、クライアント差分を減らせる。
- Actor 情報が明示され、監査・認可の前提が整理される。
- PUT を全置換にすることで更新の状態が明確になる（送った通りに保存される）。
- 将来的なキャッシュ実装が容易（guildId 単位での無効化で済む）。
- 監査ログに完全な before/after が記録される。

### 欠点

- 部分更新には向かず、変更時に全体の再送が必要。
- Bot が設定を変更する際、GET → 部分変更 → PUT の3ステップが必要（ネットワーク往復+1）。

### 今後の影響

- 部分更新が必要になった場合は PATCH 追加等の再検討が必要。
- 認可強化（Discord 権限検証）時に Actor.userId の検証ロジックを追加する。
- フェーズ2で JWT 認証へ移行する際、Actor ヘッダーを Authorization ヘッダーに置き換える。

## Alternatives

### 部分更新（PATCH）を最初から採用する

- 却下理由: キャッシュ実装時の複雑化（変更箇所の追跡が必要）、マージロジックの分散、監査ログの粒度管理が困難。
- フェーズ2で必要なら top-level 単位の部分更新（PATCH）を追加可能。

### Actor 情報をリクエストボディに含める

- 却下理由: 認証情報とビジネスデータの混在、フェーズ2の JWT 移行時に破壊的変更が必要。
- ヘッダーで渡すことで、認証方式の変更時に互換性を維持しやすい。

### Bot 専用 API と WebUI 専用 API を分ける

- 却下理由: 同一リソースに対して異なる入出力を定義すると、クライアント間の差分が拡大し保守コストが増大。
- 単一の API を共有することで、Contracts の一貫性を保つ。
