#!/usr/bin/env bash
#
# keep-alive.sh
#
# Render の無料プランは一定時間アクセスがないとサービスがスリープし、
# 次のリクエストでコールドスタートの大きなレイテンシが発生する。
# このスクリプトは認証不要の /healthz へ定期的に GET を投げ続けて
# サービスをスリープさせないようにする。
#
# 使い方:
#   ./script/keep-alive.sh
#
#   バックグラウンド常駐させる場合:
#   nohup ./script/keep-alive.sh > keep-alive.log 2>&1 &
#
# 環境変数で挙動を変更できる:
#   HEALTHCHECK_URL  ping 先 URL
#                    (デフォルト: https://ika-club-score-board-api.onrender.com/healthz)
#   INTERVAL         ping 間隔 (秒, デフォルト: 600)
#
# 停止: Ctrl-C (常駐させた場合は kill でプロセスを終了)

set -uo pipefail

HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://ika-club-score-board-api.onrender.com/healthz}"
INTERVAL="${INTERVAL:-600}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

# Ctrl-C / TERM を受けたらループを抜けて終了する
trap 'log "stopped"; exit 0' INT TERM

log "keep-alive started: url=${HEALTHCHECK_URL} interval=${INTERVAL}s"

while true; do
  # -s 静音, -o /dev/null で本文を破棄し, -w でステータスと所要時間だけ取得する。
  # --max-time はコールドスタート時の長い応答も待てるよう余裕を持たせる。
  # curl 自体が失敗した場合はループを止めず "000" として記録する。
  response="$(curl -s -o /dev/null -w '%{http_code} %{time_total}' \
    --max-time 60 "${HEALTHCHECK_URL}" 2>/dev/null)" || response="000 0"

  http_code="${response%% *}"
  time_total="${response##* }"

  if [ "${http_code}" = "200" ]; then
    log "ok    status=${http_code} time=${time_total}s"
  else
    log "warn  status=${http_code} time=${time_total}s"
  fi

  sleep "${INTERVAL}"
done
