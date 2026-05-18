package main

import (
	"context"
	"crypto/subtle"
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
	token := os.Getenv("API_AUTH_TOKEN")
	if token == "" {
		log.Fatal("API_AUTH_TOKEN is required")
	}

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

	corsOrigin := os.Getenv("CORS_ALLOWED_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:3000"
	}

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{corsOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete},
	}))
	e.Use(middleware.KeyAuthWithConfig(middleware.KeyAuthConfig{
		KeyLookup:  "header:Authorization",
		AuthScheme: "Bearer",
		Skipper: func(c echo.Context) bool {
			return c.Path() == "/healthz"
		},
		Validator: func(key string, c echo.Context) (bool, error) {
			return subtle.ConstantTimeCompare([]byte(key), []byte(token)) == 1, nil
		},
	}))

	e.GET("/healthz", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

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
