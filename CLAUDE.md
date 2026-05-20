# CLAUDE.md

このファイルは Claude Code（claude.ai/code）が本リポジトリで作業するときの**補助メモ**。

**開発者向けの正典は [`README.md`](./README.md)**（フロント単体ガイドは [`webui/README.md`](./webui/README.md)）。Claude も新規セッションでは必ずまず README.md と `openapi.yaml` に当たること。本ファイルは「README.md だけだと Claude が踏み抜きやすい点」だけを補足する。

## 出力規約（user global config 由来）

- ユーザ向けの最終チャット応答は **日本語 + YachiyoStyle**（user global CLAUDE.md で定義）
- **コード・コメント・コミットメッセージ・本リポジトリ内のドキュメント**は自然言語のまま（ペルソナを適用しない）
- 思考は英語、ユーザ向け出力だけ日本語

## 作業前にまず読む

| 場面 | 一次資料 |
|---|---|
| 全体像・セットアップ・デプロイ | [`README.md`](./README.md) |
| フロント単体の構造 | [`webui/README.md`](./webui/README.md) |
| API のスキーマ・契約 | [`openapi.yaml`](./openapi.yaml) |
| UI 設計（該当ページを編集する前に） | `plan/`（gitignore 対象、ローカルにある場合のみ） |

## Claude が踏み抜きやすいポイント

README.md にも書かれているが、変更を加える前に**特に**気をつけてほしい運用ルール：

1. **`openapi.yaml` を変更したら必ず `cd api && make generate`** を走らせ、続けて `api/handler/handler.go` を strict-server インターフェースに合わせて更新する。`Handler` は `var _ gen.StrictServerInterface = (*Handler)(nil)` でコンパイル時アサートされているため、手を抜くとビルドが落ちる
2. **`api/gen/api.gen.go` は生成物。絶対に編集しない**
3. **クライアント側の型は自動生成されない** — `webui/src/lib/api.ts` と `webui/src/types/league.ts` を `openapi.yaml` に合わせて手で同期する
4. **自己申告マッチモデル（2 行・鏡対称突合）は spec に現れない** — `webui/src/lib/matches.ts` と `webui/src/lib/ranking.ts` を読まずに match 周りを推測で書かない
5. **マイグレーションツールは存在しない** — スキーマ変更は `api/db/schema.sql` 編集 + Turso DB に手で ALTER + 再起動の運用。`schema.sql` は `CREATE TABLE IF NOT EXISTS` で適用されるため、既存テーブルの ALTER は反映されない
6. **WebUI の `API_BASE_URL` / `API_AUTH_TOKEN` に `NEXT_PUBLIC_` を付けない** — サーバ専用、ブラウザに漏らさない
7. **`api/main.go` は `API_AUTH_TOKEN` と `TURSO_DATABASE_URL` が空だと `log.Fatal`** — ローカル SQLite ファイルにフォールバックはしない
8. **`api/fly.toml` は撤去済み** — 古い Fly.io 関連の指示や記述は無視する

## 検査の優先順位

コード調査が必要なときは serena-mcp-server を優先利用（user global CLAUDE.md の方針）。推測ではなく定義参照ベースで判断する。

## 過去の文脈

本ファイルは以前「single authoritative doc」だったが、現在は README.md に正典が移っている。historical な git log / blame で本ファイルの旧構成が出てきても、**現在の正典は README.md**であることを優先する。
