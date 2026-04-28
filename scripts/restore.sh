#!/usr/bin/env bash
# =============================================================================
# restore.sh — Restaura backup PostgreSQL via psql
#
# Uso:
#   ./scripts/restore.sh ./backups/backup_20260501_020000.sql.gz
# =============================================================================

set -euo pipefail

# ─── Configuração ─────────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-postgres}"
DB_NAME="${POSTGRES_DB:-schedulewell}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Uso: $0 <arquivo-de-backup.sql.gz>"
  echo ""
  echo "Backups disponíveis:"
  ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  (nenhum backup encontrado em ./backups/)"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Erro: arquivo não encontrado — $BACKUP_FILE"
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Erro: arquivo compose não encontrado: $COMPOSE_FILE"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ATENÇÃO: Esta operação irá substituir todos os dados do banco '$DB_NAME'."
read -r -p "Confirmar restauração? (s/N) " CONFIRM

if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Restauração cancelada."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando restauração a partir de: $BACKUP_FILE"

# ─── Drop e recria o banco ────────────────────────────────────────────────────
docker compose -f "$COMPOSE_FILE" exec -T \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_SERVICE" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME};"

docker compose -f "$COMPOSE_FILE" exec -T \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_SERVICE" psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};"

# ─── Descomprime e restaura ───────────────────────────────────────────────────
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_SERVICE" psql -U "$DB_USER" "$DB_NAME"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauração concluída com sucesso."
