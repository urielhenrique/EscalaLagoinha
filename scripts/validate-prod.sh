#!/usr/bin/env bash
# =============================================================================
# validate-prod.sh — Validacao rapida de ambiente de producao/homologacao
#
# Uso:
#   ./scripts/validate-prod.sh \
#     --frontend https://app.seudominio.com \
#     --backend https://api.seudominio.com/api
# =============================================================================

set -euo pipefail

FRONTEND_URL=""
BACKEND_API_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frontend) FRONTEND_URL="$2"; shift 2 ;;
    --backend) BACKEND_API_URL="$2"; shift 2 ;;
    *) echo "Opcao desconhecida: $1"; exit 1 ;;
  esac
done

if [[ -z "$FRONTEND_URL" || -z "$BACKEND_API_URL" ]]; then
  echo "Uso: $0 --frontend <url-frontend> --backend <url-backend-api>"
  echo "Exemplo: $0 --frontend https://app.seudominio.com --backend https://api.seudominio.com/api"
  exit 1
fi

HEALTH_URL="${BACKEND_API_URL%/}/health"

echo ""
echo "==============================================="
echo "Validacao de producao/homologacao"
echo "Frontend: $FRONTEND_URL"
echo "Backend : $BACKEND_API_URL"
echo "Health  : $HEALTH_URL"
echo "==============================================="

echo ""
echo "[1/6] Frontend responde HTTP..."
FRONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
echo "HTTP frontend: $FRONT_STATUS"

if [[ "$FRONT_STATUS" -lt 200 || "$FRONT_STATUS" -ge 400 ]]; then
  echo "Falha: frontend nao esta respondendo corretamente."
  exit 1
fi

echo ""
echo "[2/6] Backend health responde HTTP..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
echo "HTTP health: $HEALTH_STATUS"

if [[ "$HEALTH_STATUS" -ne 200 ]]; then
  echo "Falha: healthcheck do backend nao retornou 200."
  exit 1
fi

echo ""
echo "[3/6] Conteudo do healthcheck..."
HEALTH_BODY=$(curl -s "$HEALTH_URL")
echo "$HEALTH_BODY"

if ! echo "$HEALTH_BODY" | grep -qi '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "Falha: status do health nao esta ok."
  exit 1
fi

if ! echo "$HEALTH_BODY" | grep -qi '"database"[[:space:]]*:[[:space:]]*"connected"'; then
  echo "Falha: banco nao aparece como connected no health."
  exit 1
fi

echo ""
echo "[4/6] SSL frontend..."
if [[ "$FRONTEND_URL" == https://* ]]; then
  echo "OK: frontend em HTTPS"
else
  echo "Falha: frontend nao esta em HTTPS"
  exit 1
fi

echo ""
echo "[5/6] SSL backend..."
if [[ "$BACKEND_API_URL" == https://* ]]; then
  echo "OK: backend em HTTPS"
else
  echo "Falha: backend nao esta em HTTPS"
  exit 1
fi

echo ""
echo "[6/6] Headers de seguranca basicos no frontend..."
HEADERS=$(curl -sI "$FRONTEND_URL")
if ! echo "$HEADERS" | grep -qi "x-content-type-options"; then
  echo "Aviso: header X-Content-Type-Options nao encontrado"
else
  echo "OK: X-Content-Type-Options presente"
fi

if ! echo "$HEADERS" | grep -qi "x-frame-options"; then
  echo "Aviso: header X-Frame-Options nao encontrado"
else
  echo "OK: X-Frame-Options presente"
fi

echo ""
echo "Validacao concluida com sucesso."
