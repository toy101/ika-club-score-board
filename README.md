# ika-club-score-board

サークル内リーグ戦のスコアボードを管理する Web アプリ。Go + Turso/libSQL の API と Next.js の WebUI から成る。

このリポジトリの**正典は本ファイル**。開発に必要な全容（アーキテクチャ／認証フロー／OpenAPI コード生成／ドメインモデル／デプロイ）はここに集約している。`CLAUDE.md` は Claude Code 向けの補助メモであり、開発者は README.md だけ読めば足りる。

## 目次

- [リポジトリ構成](#リポジトリ構成)
- [クイックスタート](#クイックスタート)
- [環境変数リファレンス](#環境変数リファレンス)
- [認証と WebUI→API プロキシ](#認証と-webuiapi-プロキシ)
- [OpenAPI コード生成](#openapi-コード生成)
- [API アーキテクチャ](#api-アーキテクチャ)
- [WebUI アーキテクチャ](#webui-アーキテクチャ)
- [自己申告マッチモデル](#自己申告マッチモデル)
- [ドメイン不変条件](#ドメイン不変条件)
- [テストデータ／シード](#テストデータシード)
- [デプロイ](#デプロイ)
- [ドキュメント体系](#ドキュメント体系)

## リポジトリ構成

ルート直下に独立した 2 パッケージ（**モノレポツールなし**：ワークスペースも共有ロックファイルもない）：

- `api/` — Go 1.25 + Echo v4 + Turso/libSQL（`tursodatabase/libsql-client-go`、**pure Go・CGO 不要**）。OpenAPI から strict-server を自動生成
- `webui/` — Next.js 16 (App Router) + React 19 + pnpm 10 + Tailwind v4。フロント単体のガイドは [`webui/README.md`](./webui/README.md) を参照
- `openapi.yaml`（ルート） — API と WebUI の**唯一の契約**
- `plan/` — UI 設計仕様。該当ページを編集する前に読むこと（`/plan` は gitignore 対象）
- CI／テストスイート／フォーマッタ設定は**存在しない**

## クイックスタート

ローカル開発では API と WebUI を別ターミナルで並走させ、**同じ `API_AUTH_TOKEN` を共有**させる必要がある。

### 1. API（`api/` で実行）

```sh
make generate                       # oapi-codegen → gen/api.gen.go（openapi.yaml 変更後は必須）
make build                          # → bin/api
API_AUTH_TOKEN=test \
TURSO_DATABASE_URL='libsql://<db>-<org>.turso.io' \
TURSO_AUTH_TOKEN='<token>' \
make run                            # http://localhost:8080（リモート Turso）

# ローカル libsql サーバを使う場合（別ターミナルで `turso dev` 起動、無認証）
API_AUTH_TOKEN=test TURSO_DATABASE_URL=http://127.0.0.1:8080 make run

make tidy                           # go.sum 更新
```

`make generate` は毎回 `go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.4.1` を実行する（冪等、初回はネットワーク必要）。

ローカル SQLite ファイルモードは**存在しない**：開発でもリモート Turso か `turso dev` のどちらかが必要。`API_AUTH_TOKEN` と `TURSO_DATABASE_URL` は**必須**で、`main.go` が空のまま起動すると `log.Fatal` で即終了する。

### 2. WebUI（`webui/` で実行）

```sh
pnpm install                                                       # .npmrc が shamefully-hoist=true を強制（pnpm 固定）
API_BASE_URL=http://localhost:8080 API_AUTH_TOKEN=test pnpm dev    # http://localhost:3000
pnpm build                                                         # 本番ビルド
pnpm start                                                         # ビルド済みを起動
pnpm lint                                                          # ESLint 9（eslint-config-next、flat config）
```

WebUI が必要とする `API_BASE_URL` と `API_AUTH_TOKEN` は**サーバ専用**。`NEXT_PUBLIC_` プレフィックスを付けてはならない（ブラウザに漏らさない）。`NEXT_PUBLIC_API_BASE_URL` は廃止済み。

### 3. 動作確認

シード済みテストリーグ（デフォルトシードで常に存在）：

```
http://localhost:3000/leagues/00000000-0000-4000-a000-000000000001
```

API は Bearer 認証必須（`/healthz` のみスキップ）：

```sh
curl -H "Authorization: Bearer test" http://localhost:8080/leagues
curl -H "Authorization: Bearer test" \
  http://localhost:8080/leagues/00000000-0000-4000-a000-000000000001/teams
```

UI はブラウザで上記テストリーグ URL を開き、4 チームとメンバーが表示されれば OK。

## 環境変数リファレンス

### API

| 変数 | デフォルト | 説明 |
|---|---|---|
| `API_AUTH_TOKEN` | **（必須）** | Bearer トークン。WebUI 側と一致させる |
| `TURSO_DATABASE_URL` | **（必須）** | libSQL 接続 URL。`libsql://`（リモート） / `http://`（`turso dev`） |
| `TURSO_AUTH_TOKEN` | （条件付き必須） | リモート（`libsql://`/`https://`/`wss://`）では必須。`turso dev`（`http://`/`ws://`）では空可 |
| `PORT` | `8080` | 待ち受けポート |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3000` | CORS 許可オリジン |
| `SEED_TEST_DATA` | `if-empty` | シード挙動：`if-empty` / `force` / `off`（[テストデータ／シード](#テストデータシード)参照） |

`DB_PATH` は廃止済み（API は SQLite ファイルを開かなくなった）。

### WebUI

| 変数 | デフォルト | 説明 |
|---|---|---|
| `API_BASE_URL` | **（必須）** | Go API のベース URL。ローカルは `http://localhost:8080`、本番は Render 公開 URL |
| `API_AUTH_TOKEN` | **（必須）** | `Authorization: Bearer <token>` で API に送る共有トークン。API 側と一致させる |

両方とも**サーバ専用**で、`NEXT_PUBLIC_` を付けてはならない。

## 認証と WebUI→API プロキシ

ブラウザは **Go API を直接叩かない**。`webui/src/lib/api.ts` の `request()` が実行コンテキストで分岐する：

```
# ブラウザ / Client Component
browser → /api/* （同一オリジン）
        → webui/src/app/api/[...path]/route.ts （Next.js catch-all、force-dynamic、サーバ側）
        → ${API_BASE_URL}/* に Authorization: Bearer ${API_AUTH_TOKEN} を付与して転送
        → Echo の KeyAuth middleware が検証

# Server Component（Node ランタイム、DOM なし）
Server Component → request() が `typeof window === "undefined"` を検出
                 → ${API_BASE_URL}/* に直接 Authorization: Bearer ${API_AUTH_TOKEN} を付けて要求
                 → Echo の KeyAuth middleware が検証
```

- `webui/src/lib/api.ts` `request()` は `typeof window` で分岐：サーバ側は絶対 URL `${API_BASE_URL}` + 自前で `Authorization` 注入、ブラウザ側は相対 `/api${path}` でプロキシに任せる。両者とも `cache: "no-store"`
- なぜ分けるか：Node の `fetch`（undici）は相対 URL を拒否するため、Server Component は同一オリジンプロキシを通れない。どのみち自ホストの絶対 URL が必要なので、API を直接叩いて 1 ホップ省く方が単純。トークンは両経路ともサーバ専用で、ブラウザには露出しない
- プロキシ実体 `webui/src/app/api/[...path]/route.ts` は `Authorization` + `Content-Type` のみを転送する（クッキーやその他ヘッダは通さない）。`cache: "no-store"` で意図的にミニマル。API に追加ヘッダを渡したい場合はここと `request()` のサーバ分岐の両方を更新する
- Go 側のすべてのルートが Bearer を必須。例外は **`/healthz` のみ**（認証スキップ、Render のヘルスチェック用）
- `CORS_ALLOWED_ORIGIN` は残っているが、両経路とも server-to-server で cross-origin browser fetch が発生しないため実質ほぼ無効

## OpenAPI コード生成

`openapi.yaml`（ルート）が source of truth。フローは**非対称**：

- **サーバ（Go）**: `api/gen/api.gen.go` は `oapi-codegen` で全生成（config: `api/cfg/oapi-codegen.yaml`、モード: `strict-server` + `echo-server`）。**編集禁止**。`api/handler/handler.go` の `Handler` はコンパイル時に生成インターフェースと突き合わされる：

  ```go
  var _ gen.StrictServerInterface = (*Handler)(nil)
  ```

  `openapi.yaml` に operation を追加・変更すると、`Handler` が対応メソッドを実装するまでこのアサーションでビルドが落ちる
- **クライアント（TS）**: クライアント生成は**ない**。`webui/src/lib/api.ts` と `webui/src/types/league.ts` は手書きで、仕様変更時は手動同期する

`openapi.yaml` を変更したときの手順：

1. `cd api && make generate`
2. `api/handler/handler.go` を新しい strict-server メソッドに合わせて更新
3. `webui/src/lib/api.ts` と `webui/src/types/league.ts` を手で書き換え

> 注：`webui/src/lib/matches.ts` と `webui/src/lib/ranking.ts` は spec に現れない**クライアント固有のドメインロジック**（[自己申告マッチモデル](#自己申告マッチモデル)参照）。spec は match 行を素のまま往復させるだけで、突合・順位算定は一切行わない。

## API アーキテクチャ

- エントリポイント `api/main.go` — `API_AUTH_TOKEN` と `TURSO_DATABASE_URL` が必須（空なら `log.Fatal`）。`TURSO_AUTH_TOKEN` は URL スキームがリモート（`libsql`/`https`/`wss`）のときだけ必須で、ローカル `http`/`ws`（`turso dev`）では空可。libSQL 接続を開き、シーダを実行し、Echo middleware（logger / recover / CORS / KeyAuth）を組み立て、`/healthz` を登録し、strict handler を mount する
- DB `api/db/db.go` — Turso/libSQL を `libsql.NewConnector` + `WithAuthToken` で開き、独自の `fkConnector` でラップして**プール内のすべての新規接続**に対して `PRAGMA foreign_keys = ON` を発火させる（PRAGMA は接続単位なので、`db.Exec` の一回呼び出しではプールの 1 接続しかカバーされない）。`schema.sql` を `//go:embed` で埋め込み、起動毎に `CREATE TABLE IF NOT EXISTS` で適用する
- **マイグレーションツールは存在しない** — スキーマを進化させるときは `schema.sql` を編集し、Turso DB に対して手で ALTER を当て、再起動する。ローカルに DB ファイルはない
- シーダ `api/db/seed.go` — 起動毎に `SEED_TEST_DATA` の指示で動く（[テストデータ／シード](#テストデータシード)参照）
- ハンドラ `api/handler/handler.go`（約 550 行） — 生 `*sql.DB` を保持し、SQL をインラインで書く（ORM もリポジトリ層もない）。複数行 insert（例 `CreateLeague`）は `BeginTx` + `defer tx.Rollback()` を明示する
- ID — leagues / teams / matches は `uuid.NewString()`、members は libSQL/SQLite の `INTEGER PRIMARY KEY AUTOINCREMENT`
- `tiebreakers` は `TEXT` カラムに JSON 文字列で格納し、scan ヘルパで marshal / unmarshal する。保存形式の一貫性を保つこと
- カスケード削除 — `teams.league_id`、`members.team_id`、`matches.{home,away}_team_id` がすべて `ON DELETE CASCADE`。`matches` には `UNIQUE(league_id, home_team_id, away_team_id)` 制約があり、リーグ・方向ごとに 1 申告

## WebUI アーキテクチャ

App Router 配下（`webui/src/app/`）：

- `/`（ホーム）
- `/leagues`（一覧）
- `/leagues/create`（作成フォーム）
- `/leagues/[leagueId]`（詳細＝主画面、マッチ行列＋順位表）

Server vs Client 境界が重要：

- `/leagues/[leagueId]/page.tsx` は **async Server Component**。`getLeague` を直接呼び、その fetch は `${API_BASE_URL}` へ直結する（プロキシ経由ではない）。失敗時は `notFound()`
- 作成フォームと `MatchMatrix` / `MatchInputModal` は `"use client"`。クライアント側のマッチデータは `useMatches` フック（`fetch` + `refetch`）で同一オリジンプロキシ経由

その他：

- プレゼンテーション用セクションコンポーネントは `webui/src/components/league/` 配下
- パスエイリアス `@/*` → `./src/*`
- API 呼び出しは `webui/src/lib/api.ts` に集約、型は `webui/src/types/league.ts`。どちらも `openapi.yaml` を手で同期する
- **順位はブラウザ側で算出**（`webui/src/lib/ranking.ts`） — 順位エンドポイントは存在しない。再帰的 tiebreaker グループ分割：勝点でソート → 同点グループに `tiebreakers` 配列順で適用（`head_to_head` は同点グループ内だけで集計）→ 同点は同順位。**`confirmed` ペアのみがランキング対象**
- スタイリングは Tailwind v4 via `@tailwindcss/postcss`。コンポーネントライブラリは未使用

フロント単体の詳細ガイドは [`webui/README.md`](./webui/README.md) を参照。

## 自己申告マッチモデル

⚠️ **これは `openapi.yaml` の spec には現れない**。マッチエンドポイントやスコア、順位を変更するときは必ずこのモデルを保つこと。

`matches` の 1 行は、**ある 1 チームによる 1 試合の自己申告**であり、中立的な結果ではない：

- `homeTeamId` = 申告したチーム、`awayTeamId` = 対戦相手
- `homeScore` / `awayScore` = **申告者から見た**自軍 / 相手のスコア
- ゆえに同じ対戦カードは最大**2 行**（方向ごとに 1 行）DB に並ぶ。API は両方向の行を生のまま保管し、突合は**一切しない**

突合はクライアント側のみ（`webui/src/lib/matches.ts` の `getCellStatus`）：

| ステータス | 条件 |
|---|---|
| `confirmed` | 両方向ありかつ完全に鏡対称（`mine.home === theirs.away && mine.away === theirs.home`） |
| `mismatch`（⚠） | 両方向あるが鏡対称でない |
| `reported` | 自軍だけ申告（相手待ち） |
| `other_only` / `empty` | 相手だけ申告 / 何もなし |

**ランキングに乗るのは `confirmed` のみ**。mismatch / pending は UI で可視化するが順位計算からは除外される。

## ドメイン不変条件

`openapi.yaml` で型として強制され、一部は実行時にも再チェックされる：

- チームは**正確に 4 名**（`minItems: 4, maxItems: 4`）。TS 型は 4-tuple `[Member, Member, Member, Member]`
- リーグは**最低 2 チーム**で作成（`teams.minItems: 2`）。`CreateLeague` ハンドラでも再検証
- チームカラーは `^#[0-9a-fA-F]{6}$` パターン、`sortOrder` は表示順（≥ 1）
- `tiebreakers` enum: `head_to_head` / `goal_difference` / `goals_scored`（配列順 = 優先度、先勝ち）
- リーグ名は 1〜50 文字。ランキングルールの勝点とマッチスコアは非負整数
- `(league, homeTeam, awayTeam)` あたりマッチ申告は 1 件（DB `UNIQUE` 制約）。方向ごとのペア解決は[自己申告マッチモデル](#自己申告マッチモデル)を参照

## テストデータ／シード

`api/db/seed.go` が起動毎に走る。挙動は `SEED_TEST_DATA` で切り替え：

| 値 | 挙動 |
|---|---|
| 未設定 / `if-empty`（デフォルト） | `leagues` テーブルが空のときだけシード |
| `force` | 固定テストリーグ（ID `00000000-0000-4000-a000-000000000001`）を CASCADE 削除して再投入 |
| `off` | 何もしない |

```sh
cd api
SEED_TEST_DATA=force API_AUTH_TOKEN=test \
TURSO_DATABASE_URL='libsql://<db>-<org>.turso.io' TURSO_AUTH_TOKEN='<token>' \
make run   # 接続先 Turso DB に強制再投入（向け先の DB を壊すので注意）
```

シード内容：4 チーム × 各 4 名、UI 確認用に confirmed / pending / mismatch を混在させたマッチ群。

## デプロイ

### API（Render）

- `api/Dockerfile` — multi-stage：`golang:1.25` で `CGO_ENABLED=0` ビルド（libsql-client-go が pure Go なので CGO 不要）、ランタイムは `debian:bookworm-slim` + `ca-certificates`。永続化が完全外部化（Turso）されたため、ランタイムイメージはデータを持たず、`scratch` / Alpine への切り替えも視野に入る
- `api/render.yaml` — Render サービス名 `ika-club-score-board-api`、`runtime: docker`、`dockerfilePath: ./api/Dockerfile`。`PORT=8080` と `SEED_TEST_DATA=if-empty` のみコミット済み。`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` / `API_AUTH_TOKEN` / `CORS_ALLOWED_ORIGIN` は `sync: false`（Render ダッシュボードで手動設定、コミットしない）
- ヘルスチェックは `GET /healthz`
- Turso DB は Turso CLI で個別作成し、URL とトークンを Render env vars に貼り付ける
- `api/fly.toml` は撤去済み。Fly.io デプロイは廃止された

### WebUI

別途デプロイし、本番の `API_BASE_URL` は Render 公開 URL を指す。ブラウザは本番でも常に同一オリジンの `/api/*` のみを叩く（トークンはサーバ側で注入される）。

## ドキュメント体系

- **このファイル（`README.md`）** — 開発者向けの正典。全容はここ
- [`webui/README.md`](./webui/README.md) — フロントエンド単体で完結する開発ガイド
- `CLAUDE.md` — Claude Code が AI で作業するときの補助メモ。開発者は読まなくてよい
- `openapi.yaml` — API と WebUI の唯一の契約
- `plan/` — UI 設計仕様（gitignore 対象）
