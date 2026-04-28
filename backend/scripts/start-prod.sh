#!/usr/bin/env sh
set -eu

MAX_RETRIES="${PRISMA_MIGRATE_MAX_RETRIES:-10}"
RETRY_DELAY="${PRISMA_MIGRATE_RETRY_DELAY_SECONDS:-5}"
RUN_SEED="${RUN_PRISMA_SEED:-false}"

attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  echo "[startup] Running prisma migrate deploy (attempt ${attempt}/${MAX_RETRIES})"
  if node node_modules/.bin/prisma migrate deploy; then
    echo "[startup] Prisma migrations applied successfully"
    break
  fi

  if [ "$attempt" -eq "$MAX_RETRIES" ]; then
    echo "[startup] Migration failed after ${MAX_RETRIES} attempts"
    exit 1
  fi

  echo "[startup] Migration failed, retrying in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
  attempt=$((attempt + 1))
done

if [ "$RUN_SEED" = "true" ]; then
  echo "[startup] RUN_PRISMA_SEED=true detected, executing controlled seed"
  node node_modules/.bin/prisma db seed
else
  echo "[startup] Seed skipped (RUN_PRISMA_SEED=false)"
fi

echo "[startup] Starting NestJS application"
exec node dist/src/main.js
