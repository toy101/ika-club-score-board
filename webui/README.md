# webui — フロントエンド開発ガイド

`ika-club-score-board` のフロントエンド。Next.js 16 (App Router) + React 19 + Tailwind v4。

このディレクトリ単体で読み切れる構成にしている。リポジトリ全体の文脈（API ランタイム、デプロイ、OpenAPI コード生成の全体像）は親ディレクトリの [`../README.md`](../README.md) を参照。

## 目次

- [パッケージマネージャ](#パッケージマネージャ)
- [環境変数](#環境変数)
- [開発コマンド](#開発コマンド)
- [ルーティング構造](#ルーティング構造)
- [Server / Client 境界](#server--client-境界)
- [API クライアント層](#api-クライアント層)
- [WebUI→API プロキシ](#webuiapi-プロキシ)
- [OpenAPI との手動同期](#openapi-との手動同期)
- [自己申告マッチモデル（クライアント側突合）](#自己申告マッチモデルクライアント側突合)
- [順位計算](#順位計算)
- [スタイリング](#スタイリング)
- [リント／ビルド](#リントビルド)
- [デプロイ](#デプロイ)

## パッケージマネージャ

**pnpm 固定**（`package.json` の `packageManager` フィールドで `pnpm@10.21.0`）。`.npmrc` が `shamefully-hoist=true` を強制しているため、**npm / yarn には切り替えない**こと（依存解決が壊れる）。

```bash
pnpm install
```

## 環境変数

WebUI はサーバ側 API プロキシ `/api/*` 経由（または Server Component から直接）で Go API へ繋ぐ。以下は**サーバ専用**の環境変数で、**`NEXT_PUBLIC_` プレフィックスを付けてはならない**：

| 変数 | 説明 |
| --- | --- |
| `API_BASE_URL` | Go API のベース URL。ローカルは `http://localhost:8080`、本番は Render 公開 URL |
| `API_AUTH_TOKEN` | `Authorization: Bearer <token>` で API に送る共有トークン。API 側の `API_AUTH_TOKEN` と一致させる |

ブラウザは常に同一オリジンの `/api/*` のみを叩き、トークンは**サーバ側で注入**されクライアントには届かない。`NEXT_PUBLIC_API_BASE_URL` は廃止済み。

## 開発コマンド

```bash
API_BASE_URL=http://localhost:8080 API_AUTH_TOKEN=test pnpm dev   # http://localhost:3000
pnpm build                                                        # 本番ビルド
pnpm start                                                        # ビルド済みを起動
pnpm lint                                                         # ESLint 9（eslint-config-next、flat config）
```

API サーバも同じ `API_AUTH_TOKEN` で並走させる必要がある（[`../README.md` のクイックスタート](../README.md#クイックスタート)参照）。

## ルーティング構造

App Router 配下（`src/app/`）：

| ルート | 役割 | 種別 |
|---|---|---|
| `/` | ホーム | — |
| `/leagues` | リーグ一覧 | — |
| `/leagues/create` | 作成フォーム | Client（`"use client"`） |
| `/leagues/[leagueId]` | 詳細（主画面）。マッチ行列 + 順位表 | **Server Component** |
| `/api/[...path]` | Go API への catch-all プロキシ | Server Route Handler |

プレゼンテーション用セクションコンポーネントは `src/components/league/` 配下。パスエイリアス `@/*` → `./src/*`。

## Server / Client 境界

ここがフロントの肝。`src/lib/api.ts` の `request()` が **`typeof window === "undefined"`** で分岐する：

```ts
// src/lib/api.ts 抜粋
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === "undefined";
  // ...
  let url: string;
  if (isServer) {
    const baseUrl = process.env.API_BASE_URL;
    const token = process.env.API_AUTH_TOKEN;
    if (!baseUrl || !token) throw new Error(...);
    url = `${baseUrl}${path}`;
    headers.Authorization = `Bearer ${token}`;
  } else {
    url = `/api${path}`;
  }
  // ...
}
```

- **Server Component（例：`/leagues/[leagueId]/page.tsx`）** から呼ぶと：
  - `${API_BASE_URL}${path}` の絶対 URL に直接 `Authorization: Bearer ${API_AUTH_TOKEN}` を付与して fetch
  - プロキシを**経由しない**（Node の `fetch`（undici）が相対 URL を拒否するため）
  - 失敗時は `getLeague` 内で例外、ページ側で `notFound()` を呼ぶ
- **Client Component / クライアント側コード**（例：`MatchMatrix`、`MatchInputModal`、`useMatches` フック）から呼ぶと：
  - 相対 URL `/api${path}` で同一オリジン fetch
  - プロキシ（`src/app/api/[...path]/route.ts`）がサーバ側で Bearer を注入してから Go API に転送

両経路とも `cache: "no-store"`。トークンはサーバ専用で、ブラウザバンドルには出ない。

## API クライアント層

| ファイル | 役割 |
|---|---|
| `src/lib/api.ts` | リクエスト発火層。`listLeagues` / `createLeague` / `getLeague` / `listMatches` / `createMatch` / `updateMatch` を export |
| `src/types/league.ts` | リクエスト・レスポンス型。`openapi.yaml` を**手で**同期 |
| `src/lib/matches.ts` | 自己申告マッチモデルのクライアント突合（spec には現れない） |
| `src/lib/ranking.ts` | 順位計算（spec には現れない） |

クライアントコード生成は**ない**。`openapi.yaml` 変更時の同期手順は [OpenAPI との手動同期](#openapi-との手動同期)参照。

## WebUI→API プロキシ

実体：`src/app/api/[...path]/route.ts`（catch-all、`export const dynamic = "force-dynamic"`）。

- `GET` / `POST` / `PATCH` / `DELETE` に対応
- `${API_BASE_URL}/${joined}${search}` へ転送（クエリ文字列はそのまま）
- 転送するヘッダは `Authorization`（サーバ側で注入）と `Content-Type`（リクエストにあった場合のみ）の**最小構成**。クッキーやその他カスタムヘッダは通さない
- リクエスト／レスポンス両方とも `cache: "no-store"`
- レスポンスは upstream body をストリームでそのまま返し、`Content-Type` だけリレー

API に追加ヘッダを送りたい場合は、**このルートと `src/lib/api.ts` のサーバ分岐の両方**を同期して更新する必要がある（片方だけだと Server Component 経路で漏れる）。

## OpenAPI との手動同期

リポジトリ正典の `../openapi.yaml` がスキーマの唯一の source of truth。フロント側は**クライアントコード自動生成をしていない**ため、spec が変わったら手で 2 ファイル更新する：

1. `src/lib/api.ts` — 新エンドポイントの関数追加、シグネチャ調整、リクエスト body の構造変更
2. `src/types/league.ts` — リクエスト・レスポンスの型を spec に合わせる

サーバ側は `cd api && make generate` で `api/gen/api.gen.go` が再生成される（[`../README.md` の OpenAPI 節](../README.md#openapi-コード生成)参照）。**サーバとクライアントは別々のタイミングで更新する必要がある**ことに注意。

## 自己申告マッチモデル（クライアント側突合）

⚠️ これは `openapi.yaml` には現れない**フロント固有のドメインロジック**。spec 上 `matches` はただの行配列。

- 1 マッチ行は「ある 1 チームによる 1 試合の自己申告」
- `homeTeamId` = 申告者、`awayTeamId` = 相手
- `homeScore` / `awayScore` = 申告者から見た自軍 / 相手のスコア
- 同じ対戦カードは最大 **2 行**（方向ごとに 1 行）DB に並ぶ

突合は `src/lib/matches.ts` の `getCellStatus` がクライアントで行う：

| ステータス | 条件 | UI 表示意図 |
|---|---|---|
| `confirmed` | 両方向あり、完全に鏡対称（`mine.home === theirs.away && mine.away === theirs.home`） | 確定済み、順位計算に使用 |
| `mismatch`（⚠） | 両方向あるが鏡対称でない | 警告表示、人間が直すまで保留 |
| `reported` | 自軍だけ申告 | 相手の申告待ち |
| `other_only` / `empty` | 相手だけ / 何もなし | 入力導線 |

マッチ関連エンドポイントを触るとき（例：申告の差し戻し、ステータス追加）はこのモデルを壊さないこと。

## 順位計算

`src/lib/ranking.ts` がブラウザ側で完結する。**順位エンドポイントは API に存在しない**。

アルゴリズム：

1. **`confirmed` ペアだけを集計**（mismatch / pending は除外）
2. 勝点で降順ソート
3. 同点グループに `tiebreakers` 配列（先頭優先）を順に適用：
   - `head_to_head` — **同点グループ内**での直接対戦のみを集計（リーグ全体ではない）
   - `goal_difference` — 得失点差
   - `goals_scored` — 得点
4. 同点はそのまま同順位として並べる（次の順位は人数分だけ進める）

`tiebreakers` 配列の順序を変えると挙動が変わる。enum 候補は `head_to_head` / `goal_difference` / `goals_scored`（[`../README.md` の不変条件節](../README.md#ドメイン不変条件)参照）。

## スタイリング

- **Tailwind v4** を `@tailwindcss/postcss` 経由で利用（`postcss.config.mjs`）
- **コンポーネントライブラリ未使用**（shadcn 等は入っていない）
- グローバル CSS は `src/app/globals.css` 想定

## リント／ビルド

- リンタ：ESLint 9（フラット設定、`eslint.config.mjs`）+ `eslint-config-next`
- 型チェック：`tsconfig.json`（パスエイリアス `@/*` → `./src/*`）。ビルド時に Next が走らせる
- フォーマッタ設定はリポジトリに**ない**

```bash
pnpm lint
pnpm build
```

## デプロイ

WebUI は API（Render）とは**別途デプロイ**する。本番では：

- `API_BASE_URL` を Render 公開 URL に向ける
- `API_AUTH_TOKEN` は API 側のものと一致させる（共有シークレット）
- 両方とも環境変数として **サーバ側にのみ** 注入する。ブラウザバンドルには絶対に出さない

ブラウザは本番でも同一オリジンの `/api/*` のみを叩き、プロキシ経由で API に到達する。
