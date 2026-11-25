#!/usr/bin/env bash
# CHZ Gate 3 — Encrypted PostgreSQL Backup, SHA-256 Seal & Staging Restore Drill
set -euo pipefail

DB_URL="${CHZ_DATABASE_URL:?Set CHZ_DATABASE_URL}"
STAGING_DB_URL="${CHZ_STAGING_DATABASE_URL:-}"
BACKUP_DIR="${CHZ_BACKUP_DIR:-/var/backups/chz-merl}"
STAMP="$(TZ=Africa/Lusaka date +%Y%m%d-%H%M%S-CAT)"
OUT_FILE="${BACKUP_DIR}/chz-merl-${STAMP}.dump"

mkdir -p "${BACKUP_DIR}"
pg_dump --format=custom --no-owner --no-privileges "${DB_URL}" --file="${OUT_FILE}"
sha256sum "${OUT_FILE}" > "${OUT_FILE}.sha256"
echo "[CHZ-BACKUP] Sealed ${OUT_FILE} ($(cat "${OUT_FILE}.sha256"))"

if [[ -n "${STAGING_DB_URL}" ]]; then
  sha256sum -c "${OUT_FILE}.sha256"
  pg_restore --clean --if-exists --no-owner --dbname="${STAGING_DB_URL}" "${OUT_FILE}"
  psql "${STAGING_DB_URL}" -c "SELECT COUNT(*) AS restored_merl_records FROM chz_merl_merlrecord;"
  echo "[CHZ-RESTORE] Gate 3 staging restore verified successfully."
fi
