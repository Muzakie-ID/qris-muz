#!/usr/bin/env bash
# pg_dump (format custom, terkompresi) → /backups → salin ke RCLONE_REMOTE → hapus yang lama.
set -uo pipefail
source /usr/local/bin/lib.sh

started=$(date -u +%FT%TZ)
file="qrismuz-$(date +%Y%m%d-%H%M%S).dump"
path="/backups/$file"

fail() {
  log "GAGAL: $1"
  record backup false "$file" "" "$1" "$started"
  exit 1
}

log "Mulai backup $file"
err=$(pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$path" 2>&1) \
  || fail "pg_dump: ${err:0:300}"
# Pastikan file bisa dibaca kembali sebelum dianggap berhasil.
pg_restore --list "$path" > /dev/null 2>&1 || fail "File dump rusak (pg_restore --list gagal)."
size=$(stat -c %s "$path")

find /backups -name 'qrismuz-*.dump' -mtime +"${LOCAL_KEEP_DAYS:-7}" -delete

if [ -z "${RCLONE_REMOTE:-}" ]; then
  # Tetap dicatat gagal agar ketahuan: backup yang hanya ada di VPS ikut hilang bila VPS rusak.
  record backup false "$file" "$size" "Tersimpan di VPS saja; RCLONE_REMOTE belum diisi, jadi belum ada salinan di luar VPS." "$started"
  log "Backup lokal selesai, tetapi RCLONE_REMOTE kosong."
  exit 1
fi

err=$(rclone copy "$path" "$RCLONE_REMOTE" --retries 3 2>&1) || fail "rclone copy: ${err:0:300}"
rclone delete "$RCLONE_REMOTE" --min-age "${REMOTE_KEEP_DAYS:-30}d" --include 'qrismuz-*.dump' 2>/dev/null \
  || log "Peringatan: gagal menghapus backup lama di remote."

record backup true "$file" "$size" "" "$started"
log "Selesai: $file ($size byte) → $RCLONE_REMOTE"
