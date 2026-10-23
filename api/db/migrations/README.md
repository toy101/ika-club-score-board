# DB migration

`schema.sql` の `CREATE TABLE IF NOT EXISTS` は既存テーブルへ列を追加しないため、既存DBでは API 更新前にマイグレーションを適用する。

## 001_add_series_scoring.sql

1. 対象DBをバックアップする。
2. `001_add_series_scoring.sql` を対象DBへ1回だけ適用する。
3. 次のクエリで既存リーグが従来方式の既定値になっていることを確認する。

```sql
SELECT id, scoring_mode, best_of, points_per_game_win FROM leagues;
```

既存行は `match_points`, `3`, `1` になる。マイグレーションを再実行すると列の重複で失敗するため、適用履歴を管理して重複実行しない。
