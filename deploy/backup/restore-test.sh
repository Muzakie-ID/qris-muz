#!/usr/bin/env bash
# Uji restore: ambil backup terbaru dari remote (atau lokal), pulihkan ke database sementara,
# periksa isinya, lalu hapus. Backup yang tidak pernah diuji belum tentu bisa dipulihkan.
set -uo pipefail
source /usr/local/bin/lib.sh

started=$(date -u +%FT%TZ)
test_db="qrismuz_restore_test"
admin_url="${DATABASE_URL%/*}/postgres"
test_url="${DATABASE_URL%/*}/$test_db"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"; psql "$admin_url" -q -c "drop database if exists $test_db" >/dev/null 2>&1' EXIT

fail() {
  log "GAGAL: $1"
  record restore_test false "${file:-}" "" "$1" "$started"
  exit 1
}

if [ -n "${RCLONE_REMOTE:-}" ]; then
  file=$(rclone lsf --files-only --include 'qrismuz-*.dump' "$RCLONE_REMOTE" 2>/dev/null | sort | tail -1)
  [ -n "$file" ] || fail "Tidak ada file backup di $RCLONE_REMOTE."
  err=$(rclone copy "$RCLONE_REMOTE/$file" "$tmp" 2>&1) || fail "rclone unduh: ${err:0:300}"
  dump="$tmp/$file"
else
  file=$(ls -1 /backups/qrismuz-*.dump 2>/dev/null | sort | tail -1 | xargs -r basename)
  [ -n "$file" ] || fail "Tidak ada file backup lokal."
  dump="/backups/$file"
fi

log "Uji restore $file"
psql "$admin_url" -q -c "drop database if exists $test_db" -c "create database $test_db" >/dev/null \
  || fail "Tidak bisa membuat database uji."
err=$(pg_restore --no-owner --no-privileges --exit-on-error --dbname="$test_url" "$dump" 2>&1) \
  || fail "pg_restore: ${err:0:300}"
counts=$(psql "$test_url" -At -c "select (select count(*) from transactions) || ' transaksi, ' ||
  (select count(*) from payment_events) || ' mutasi, ' || (select count(*) from projects) || ' proyek'" 2>&1) \
  || fail "Database hasil restore tidak lengkap: ${counts:0:300}"

record restore_test true "$file" "$(stat -c %s "$dump")" "Berhasil dipulihkan: $counts" "$started"
log "Uji restore berhasil: $counts"
