# DictionaryEntry API を一覧取得 + 作成 + 単一全置換 + 削除で提供する

## Status

採用（2026-01-15）

## Context

- 本文辞書（DictionaryEntry）は Bot/将来の WebUI から共通で操作する必要がある。
- `guildId + surfaceKey` の重複禁止や正規化など、契約ファーストでの仕様固定が必要。
- 認可はサーバー設定（permissions.manageMode）に連動させ、API 側で判断する前提。
- 取得は件数が増える可能性があるため、pagination/limit を最初から設ける。

## Decision

- DictionaryEntry の API は 4 操作（一覧取得 / 作成 / 単一全置換更新 / 削除）で提供する。
  - GET: guild 単位の辞書を pagination/limit 付きで取得する。
  - POST: 辞書エントリを新規作成する（重複 surfaceKey はエラー）。
  - PUT: 単一エントリを全置換で更新する。
  - DELETE: 単一エントリを削除する。
- 認可は `permissions.manageMode` に連動し、API 側で判定する。
- Actor は `X-Yomicord-Actor-*` ヘッダーで受け取り、監査・認可に利用する。

## Consequences

### 利点

- UI からの辞書操作（作成/更新/削除）が直感的で、実装が素直。
- 単一エントリ更新の全置換により、監査ログの before/after が明確になる。
- pagination/limit を先に設けることで、将来の件数増加に耐えやすい。

### 欠点

- 一覧取得に pagination が必要となり、クライアント実装がやや複雑。
- 部分更新（PATCH）には向かず、更新時に全体送信が必要。

### 今後の影響

- 権限モデルを拡張する場合、API の認可判定ロジックを更新する必要がある。
- pagination/limit の仕様変更はクライアント影響が大きく、慎重な互換設計が必要。
- 取得は一覧 API を前提とするため、キャッシュ導入時は `guildId` 単位の無効化で整合性を保ちやすい。
- キャッシュ実装時の戦略:
  - 基本: `guildId` 単位でキャッシュを無効化（更新時に該当 guild の全キャッシュを削除）
  - 条件付きGET（ETag/Last-Modified）の導入により、クライアント側キャッシュを活用可能
  - 辞書エントリ数が増加し更新頻度が高くなった場合、個別エントリキャッシュへの分割を検討

## Alternatives

- GET/POST/PATCH/DELETE を採用し、更新を部分更新にする。
- GET/PUT(全置換) のみで一覧を丸ごと更新する。
