#!/usr/bin/env bash
# =============================================================================
# backup.sh — Backup do banco PostgreSQL via pg_dump
#
# Uso:
#   ./scripts/backup.sh
#   ./scripts/backup.sh --output /caminho/personalizado
#
# Cron (diário às 2h):
#   0 2 * * * /caminho/para/scripts/backup.sh >> /var/log/escala-backup.log 2>&1
# =============================================================================

set -euo pipefail

# ─── Configuração ─────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-escala_lagoinha_db}"
DB_NAME="${POSTGRES_DB:-escala_lagoinha}"
DB_USER="${POSTGRES_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

# ─── Opção de diretório customizado ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) BACKUP_DIR="$2"; shift 2 ;;
    *) echo "Opção desconhecida: $1"; exit 1 ;;
  esac
done

# ─── Garante que o diretório existe ──────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup do banco '$DB_NAME'..."

# ─── Executa pg_dump dentro do container e comprime ──────────────────────────
docker exec "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"

# ─── Remove backups mais antigos que RETENTION_DAYS dias ─────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removendo backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

REMAINING=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup concluído. Arquivos mantidos: ${REMAINING}"
