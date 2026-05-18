# ika-club-score-board

リーグ戦のスコアボード管理アプリ。Go + SQLite の API と Next.js の WebUI からなる。

> **詳細な開発ガイドは [`CLAUDE.md`](./CLAUDE.md) が唯一の正典。** アーキテクチャ・自己申告マッチモデル・ドメイン不変条件・デプロイはそちらを参照。この README はセットアップの入口だけを扱う。

## 構成

ルート直下に独立した 2 パッケージ（モノレポツールなし）：

- `api/` — Go 1.25 + Echo v4 + SQLite（`mattn/go-sqlite3`、**cgo 必須**）。OpenAPI からサーバコード生成
- `webui/` — Next.js 16 (App Router) + React 19 + pnpm 10 + Tailwind v4
- `openapi.yaml`（ルート） — API と WebUI の**唯一の契約**
- `plan/` — UI 設計仕様（gitignore 対象）

## セットアップ

### 1. API（`api/` で実行）

```sh
make generate                       # openapi.yaml 変更後は必須（gen/api.gen.go 再生成）
API_AUTH_TOKEN=test make run        # http://localhost:8080
```

`API_AUTH_TOKEN` は**必須**。未設定だと `main.go` が起動時に `log.Fatal` で即終了する。

主な環境変数：

| 変数 | デフォルト | 説明 |
|---|---|---|
| `API_AUTH_TOKEN` | （必須） | Bearer トークン。WebUI 側と一致させる |
| `PORT` | `8080` | 待ち受けポート |
| `DB_PATH` | `ika.db` | SQLite ファイルパス |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3000` | CORS 許可オリジン |
| `SEED_TEST_DATA` | `if-empty` | テストデータ投入挙動（下記） |

### 2. WebUI（`webui/` で実行）

```sh
pnpm install                                                       # .npmrc が shamefully-hoist=true を強制（pnpm 固定）
API_BASE_URL=http://localhost:8080 API_AUTH_TOKEN=test pnpm dev     # http://localhost:3000
```

`API_BASE_URL` と `API_AUTH_TOKEN` は**サーバ専用**。`NEXT_PUBLIC_` を付けてはいけない（ブラウザに漏らさない）。詳細は [`webui/README.md`](./webui/README.md)。

### 3. スタック起動

両サーバを起動し、**同じ `API_AUTH_TOKEN` を共有**させる。ブラウザは常に同一オリジンの `/api/*` だけを叩き、トークンはサーバ側でのみ注入される。

シード済みテストリーグ（デフォルトシードで常に存在）：

```
http://localhost:3000/leagues/00000000-0000-4000-a000-000000000001
```

## テストデータ

`SEED_TEST_DATA` でシード挙動を切り替える。`api/db/seed.go` が起動毎に実行される。

| 値 | 挙動 |
|---|---|
| 未設定 / `if-empty`（デフォルト） | `leagues` テーブルが空のときだけシード |
| `force` | 固定テストリーグを削除（CASCADE）して強制再投入 |
| `off` | 何もしない |

```sh
cd api
SEED_TEST_DATA=force API_AUTH_TOKEN=test make run   # 既存 DB に上書き投入
```

シード内容：テストリーグ（固定 ID `00000000-0000-4000-a000-000000000001`）・4 チーム × 各 4 名、および UI 確認用に confirmed / pending / mismatch を混在させたマッチ群。

### 確認方法

API は Bearer 認証必須（`/healthz` のみ認証スキップ）：

```sh
curl -H "Authorization: Bearer test" http://localhost:8080/leagues
curl -H "Authorization: Bearer test" \
  http://localhost:8080/leagues/00000000-0000-4000-a000-000000000001/teams
```

UI はブラウザで上記テストリーグの URL を開き、4 チームとメンバーが表示されれば OK。

## OpenAPI コード生成

`openapi.yaml` が source of truth。フローは**非対称**：

- **サーバ（Go）**: `api/gen/api.gen.go` は `oapi-codegen` で全生成（編集禁止）。`make generate` 後、`api/handler/handler.go` を strict-server インターフェースに合わせる
- **クライアント（TS）**: クライアント生成は**ない**。`webui/src/lib/api.ts` と `webui/src/types/league.ts` は手書きで、仕様変更時は手動同期する

詳細手順とドメインモデル（自己申告マッチ・クライアント側順位計算など）は [`CLAUDE.md`](./CLAUDE.md) を参照。

## デプロイ

API は Fly.io（`api/Dockerfile` + `api/fly.toml`、リージョン `nrt`、永続ボリューム `ika_data`）。WebUI は別途デプロイし、本番では `API_BASE_URL` を Fly 公開 URL に向ける。詳細は [`CLAUDE.md`](./CLAUDE.md) の Deployment 節。
