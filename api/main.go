package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	appdb "ika-club-score-board/api/db"
	"ika-club-score-board/api/gen"
	"ika-club-score-board/api/handler"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "ika.db"
	}

	db, err := appdb.Open(dbPath)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	if err := appdb.Seed(context.Background(), db, appdb.ParseSeedMode(os.Getenv("SEED_TEST_DATA"))); err != nil {
		log.Fatalf("failed to seed: %v", err)
	}

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete},
	}))

	h := handler.New(db)
	strictHandler := gen.NewStrictHandler(h, nil)
	gen.RegisterHandlers(e, strictHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("starting server on :%s", port)
	if err := e.Start(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
