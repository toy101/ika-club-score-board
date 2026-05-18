# webui

`ika-club-score-board` のフロントエンド。Next.js 16 (App Router) + React 19 + Tailwind v4。

> リポジトリ全体の正典は [`../CLAUDE.md`](../CLAUDE.md)。アーキテクチャ・認証プロキシ・ドメインモデルはそちらを参照。

## パッケージマネージャ

**pnpm 固定**（`pnpm@10.21.0`）。`.npmrc` が `shamefully-hoist=true` を強制しているため、npm / yarn に切り替えないこと。

```bash
pnpm install
```

## Environment

WebUI はサーバ側 API プロキシ `/api/*` 経由で Go API へ転送する。以下は**サーバ専用**の環境変数で、**`NEXT_PUBLIC_` を付けてはいけない**（ブラウザに露出させない）：

| Variable | Description |
| --- | --- |
| `API_BASE_URL` | Go API のベース URL（ローカルは `http://localhost:8080`、本番は Fly.io 公開 URL） |
| `API_AUTH_TOKEN` | API へ `Authorization: Bearer <token>` で送る共有トークン。API 側の `API_AUTH_TOKEN` と一致させる |

ブラウザは常に同一オリジンの `/api/*` のみを叩き、トークンはサーバ側で注入されクライアントには届かない。プロキシ実体は `src/app/api/[...path]/route.ts`（catch-all, force-dynamic）。

## コマンド

```bash
API_BASE_URL=http://localhost:8080 API_AUTH_TOKEN=test pnpm dev   # http://localhost:3000
pnpm build                                                        # 本番ビルド
pnpm start                                                        # ビルド済みを起動
pnpm lint                                                         # ESLint 9 (eslint-config-next, flat config)
```

API サーバも同じ `API_AUTH_TOKEN` で並走させる必要がある（[`../README.md`](../README.md) 参照）。

## 構成メモ

- ルート: `/`（ホーム）, `/leagues`（一覧）, `/leagues/create`（作成フォーム）, `/leagues/[leagueId]`（詳細＝主画面、マッチ行列＋順位表）
- `/leagues/[leagueId]/page.tsx` は async Server Component で `getLeague` を直接呼ぶ。作成フォームと `MatchMatrix`/`MatchInputModal` は `"use client"`
- API 呼び出しは `src/lib/api.ts` に集約、型は `src/types/league.ts`。どちらも `openapi.yaml` を**手動同期**
- 順位は**ブラウザ側で算出**（`src/lib/ranking.ts`）。マッチ突合ロジックは `src/lib/matches.ts`（自己申告マッチモデル、仕様には現れない）
- パスエイリアス `@/*` → `./src/*`。スタイリングは Tailwind v4（コンポーネントライブラリなし）
