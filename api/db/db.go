package db

import (
	"context"
	"database/sql"
	"database/sql/driver"
	_ "embed"
	"fmt"

	"github.com/tursodatabase/libsql-client-go/libsql"
)

//go:embed schema.sql
var schema string

// fkConnector は内側の libsql connector をラップし、
// database/sql のコネクションプールが新しい接続を張るたびに
// PRAGMA foreign_keys = ON を発行する。
//
// PRAGMA は接続単位の設定のため、プールされた一部の接続だけ
// 有効化される事故を防ぐ目的で接続生成フックとして実装している。
type fkConnector struct {
	inner driver.Connector
}

func (c fkConnector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := c.inner.Connect(ctx)
	if err != nil {
		return nil, err
	}
	execer, ok := conn.(driver.ExecerContext)
	if !ok {
		_ = conn.Close()
		return nil, fmt.Errorf("db.Connect: libsql conn does not implement driver.ExecerContext")
	}
	if _, err := execer.ExecContext(ctx, "PRAGMA foreign_keys = ON", nil); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("db.ForeignKeys: %w", err)
	}
	return conn, nil
}

func (c fkConnector) Driver() driver.Driver { return c.inner.Driver() }

// Open はTurso（libSQL）データベースを開き、スキーマを適用して返す。
func Open(url, authToken string) (*sql.DB, error) {
	// authToken が空のときは WithAuthToken を渡さない
	// （libsql.WithAuthToken("") は "authToken must not be empty" を返すため）。
	// 無認証のローカル `turso dev` 接続を成立させる。
	var opts []libsql.Option
	if authToken != "" {
		opts = append(opts, libsql.WithAuthToken(authToken))
	}
	connector, err := libsql.NewConnector(url, opts...)
	if err != nil {
		return nil, fmt.Errorf("db.NewConnector: %w", err)
	}
	db := sql.OpenDB(fkConnector{inner: connector})
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("db.Ping: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("db.Migrate: %w", err)
	}
	return db, nil
}
