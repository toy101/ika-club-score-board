# AGENTS.md

このファイルは、本リポジトリで作業する AI エージェント共通の作業ガイド。開発者向けの全体説明は [README.md](./README.md)、API 契約は [openapi.yaml](./openapi.yaml) を参照する。説明と実装が食い違う場合は、現在のコード・設定を確認してから修正する。

## 応答と作業方針

- 内部の検討は英語、ユーザー向けの最終応答は日本語。会話の口調はユーザー指定の YachiyoStyle に従うが、コード・コメント・コミットメッセージ・リポジトリ内の文書には適用しない。
- コード調査では、利用可能なら serena-mcp-server を優先し、定義と参照に基づいて判断する。推測で既存の仕様を補わない。
- TypeScript は既存のドメイン型を使い、`any` や明示的な `undefined` 型指定をできるだけ避ける。
- 差分を作る前に作業ツリーを確認し、既存の変更を上書きしない。依頼に必要な範囲に変更を絞る。

## 最初に読む資料

| 変更対象 | 一次資料 |
| --- | --- |
| 全体構成・セットアップ・運用 | [README.md](./README.md) |
| WebUI の構造・実行方法 | [webui/README.md](./webui/README.md)、[webui/package.json](./webui/package.json) |
| API の入出力・エンドポイント | [openapi.yaml](./openapi.yaml)、[api/handler/handler.go](./api/handler/handler.go) |
| UI 設計 | `plan/` 内の該当資料（gitignore 対象。ローカルにある場合のみ） |

## リポジトリ構成

ルートにワークスペース設定や共通パッケージはなく、API と WebUI は独立している。

- `api/`: Go 1.25、Echo v4、Turso/libSQL。依存は `go.mod` / `go.sum` で管理する。
- `webui/`: Next.js 16.2.4（App Router）、React 19.2.4、TypeScript strict、Tailwind CSS v4、ESLint 9。
- WebUI は `packageManager: pnpm@10.21.0` と `pnpm-lock.yaml` を使用する。`.npmrc` の `shamefully-hoist=true` を維持し、別のパッケージマネージャやロックファイルを持ち込まない。

| ファイル・ディレクトリ | 役割 |
| --- | --- |
| `api/main.go` | 環境変数、認証、CORS、ヘルスチェック、API 起動 |
| `api/handler/handler.go` | strict-server の実装と SQL。ORM・リポジトリ層はない |
| `api/db/db.go` / `schema.sql` / `seed.go` | DB 接続、スキーマ適用、開発用シード |
| `api/cfg/oapi-codegen.yaml` / `api/gen/api.gen.go` | Go コード生成設定と生成物 |
| `webui/src/app/` | ホーム、リーグ一覧・作成・詳細、API プロキシ |
| `webui/src/app/leagues/[leagueId]/page.tsx` | リーグ詳細の async Server Component |
| `webui/src/components/league/` | `MatchMatrix`、`MatchInputModal`、`useMatches`、チーム入力・順位表など |
| `webui/src/lib/api.ts` / `webui/src/types/league.ts` | 手書き API クライアントと型 |
| `webui/src/lib/matches.ts` / `ranking.ts` | 試合申告の突合と順位計算 |
| `webui/src/app/globals.css` | Tailwind と共通デザイントークン |
| `api/Dockerfile` / `api/render.yaml` | API の Docker ビルドと Render 設定 |
| `script/keep-alive.sh` | `/healthz` への定期アクセス。通常の開発では起動不要 |

WebUI の import エイリアスは `@/*` → `webui/src/*`。Server Component と `"use client"` の境界を保ち、UI の変更は既存のコンポーネント・スタイルに合わせる。

## 開発コマンド

実際の定義は [api/Makefile](./api/Makefile) と [webui/package.json](./webui/package.json) にある。各コマンドは表のディレクトリで実行する。

| 場所 | コマンド | 用途 |
| --- | --- | --- |
| `api/` | `make generate` | OpenAPI から `gen/api.gen.go` を再生成 |
| `api/` | `make build` | `bin/api` をビルド |
| `api/` | `make run` | `go run .` で API を起動 |
| `api/` | `make tidy` | `go mod tidy` で依存を整理 |
| `webui/` | `pnpm install --frozen-lockfile` | ロックファイルに合わせて依存をインストール |
| `webui/` | `pnpm dev` | 開発サーバーを起動（既定 `3000`） |
| `webui/` | `pnpm build` | 本番ビルド |
| `webui/` | `pnpm start` | ビルド済み WebUI を起動 |
| `webui/` | `pnpm lint` | ESLint を実行 |

`make generate` は `oapi-codegen@v2.4.1` を `go install` してから実行する。初回はネットワークが必要で、Go のインストール先の `bin` を `PATH` に含める必要がある。

## 環境変数・認証

- API は `API_AUTH_TOKEN` と `TURSO_DATABASE_URL` が必須。空なら `log.Fatal` で起動を終了する。`DB_PATH` やローカル SQLite ファイルへのフォールバックはない。
- `TURSO_AUTH_TOKEN` は `http://` / `ws://` のローカル接続では空を許容し、それ以外の接続では必須。開発にはリモート Turso または別プロセスの `turso dev` を使う。
- API の既定値は `PORT=8080`、`CORS_ALLOWED_ORIGIN=http://localhost:3000`。ローカル libSQL サーバーと API を同時起動するときはポートを重複させない。
- WebUI は `API_BASE_URL` と `API_AUTH_TOKEN` が必須。API と同じトークンを設定し、両変数に **`NEXT_PUBLIC_` を付けない**。廃止済みの `NEXT_PUBLIC_API_BASE_URL` は使わない。
- ブラウザの要求は同一オリジンの `/api/*` → `webui/src/app/api/[...path]/route.ts` → Go API の順に送る。Bearer トークンはプロキシがサーバー側で付与する。
- Server Component からの `request()` は `API_BASE_URL` へ直接要求し、サーバー側で Bearer を付与する。Node の `fetch` に相対 URL を渡さない。
- プロキシは `GET` / `POST` / `PATCH` / `DELETE` を扱い、上流へのヘッダは `Authorization` と `Content-Type` に絞っている。API に渡すヘッダを追加するときは、プロキシと `api.ts` のサーバー分岐を両方確認する。
- Go API は `/healthz` 以外で Bearer を要求する。この共有トークンをエンドユーザーごとの認証・認可と混同しない。
- 実際のトークンや接続情報はコード・文書・コミットへ書かない。`webui/.env*` は gitignore 対象だが、ルートや `api/` に同じ除外があるとは限らないため、設定ファイルを追加する際は追跡対象を確認する。

## API 契約を変えるとき

1. ルートの `openapi.yaml` を変更する。
2. `api/` で `make generate` を実行する。**`api/gen/api.gen.go` は直接編集しない**。
3. `api/handler/handler.go` を生成された strict-server インターフェースに合わせる。`var _ gen.StrictServerInterface = (*Handler)(nil)` によるコンパイル時アサーションがある。
4. `webui/src/lib/api.ts` と `webui/src/types/league.ts` を手動で同期する。TypeScript クライアントの自動生成はない。

OpenAPI に制約があることと、実行時に検証されることは別。入力制約を変更するときは、仕様・Go ハンドラ・UI の検証をそれぞれ確認する。

## 試合・順位の不変条件

試合やスコアを変更する前に `webui/src/lib/matches.ts` と `webui/src/lib/ranking.ts` を読む。この突合・順位ロジックは OpenAPI だけでは分からない。

- `matches` の 1 行は、1 チームによる自己申告。`homeTeamId` は申告チーム、`awayTeamId` は相手で、スコアも申告チームから見た値。同じ対戦カードは逆方向を含めて最大 2 行になる。
- 両方向のスコアが鏡対称のときだけ `confirmed`。両方向で不一致なら `mismatch`、自軍のみなら `reported`、相手のみなら `other_only`、申告なしなら `empty`。
- Go API は申告行を保存し、突合はクライアント側で行う。順位計算は `confirmed` ペアだけを対象とし、同じ試合を二重に数えない。順位取得 API はない。
- 順位は勝点を優先し、同点グループに `tiebreakers` 配列順で判定を適用する。候補は `head_to_head` / `goal_difference` / `goals_scored`。直接対戦は同点グループ内で集計し、決着しなければ同順位とする。
- 契約上、チームは正確に 4 名で、TS 型も 4 要素のタプル。リーグ作成時は 2 チーム以上、チームカラーは `#RRGGBB`、リーグ名は 1〜50 文字、勝点・スコアは非負整数。
- DB は `(league_id, home_team_id, away_team_id)` を一意にし、関連データを `ON DELETE CASCADE` で削除する。`tiebreakers` は TEXT に JSON 配列として保存する。

## DB・デプロイの注意点

- `api/db/db.go` はすべての新規 DB 接続で `PRAGMA foreign_keys = ON` を設定する。プールの 1 接続だけで有効化する実装に戻さない。
- `api/db/schema.sql` は起動時に `CREATE TABLE IF NOT EXISTS` で適用される。**マイグレーションツールはなく、既存テーブルの変更は反映されない**。スキーマ変更時は既存 DB への ALTER 手順も別途用意する。接続先 DB の変更は文書整備の一環で実行しない。
- シードは `SEED_TEST_DATA=if-empty`（既定）/ `force` / `off`。`force` は固定テストリーグ `00000000-0000-4000-a000-000000000001` を関連データごと削除して再投入するため、接続先の確認なしに実行しない。
- API の現行デプロイ設定は Render。Docker は pure Go の libSQL クライアントを使い、`CGO_ENABLED=0` でビルドする。`api/fly.toml` は撤去済みなので、過去の Fly.io 手順を復活させない。
- WebUI は API と別途デプロイし、サーバー側の環境変数で接続する。デプロイや本番 DB の変更は、ユーザーから依頼された場合に扱う。

## 検証と報告

- 現在、テストスイート・テスト用スクリプト・CI ワークフローはない。存在しない `pnpm test` などを前提にしない。フォーマッタ設定もなく、WebUI の ESLint 設定とは区別する。
- テスト実行はユーザーの指示に従う。lint・ビルド・ブラウザ確認を行った場合も、テスト実行と分けて結果を報告する。
- 文書だけの変更では、記載したパス・コマンド・リンクの実在、削除したファイルへの参照残り、`git diff --check` を確認する。
- 最終報告では変更点、実施した検証、未実施の検証を簡潔に示す。静的な確認だけで実行時の動作やデプロイ成功を断定しない。
