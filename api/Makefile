.PHONY: generate tidy build run

OAPI_CODEGEN_VERSION := v2.4.1
OPENAPI_SPEC        := ../openapi.yaml

## oapi-codegen をインストールして gen/api.gen.go を生成する
generate:
	go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION)
	oapi-codegen --config cfg/oapi-codegen.yaml $(OPENAPI_SPEC)

## go.sum を更新する
tidy:
	go mod tidy

## バイナリをビルドする
build:
	go build -o bin/api .

## サーバーを起動する（DB_PATH / PORT は環境変数で上書き可）
run:
	go run . 
