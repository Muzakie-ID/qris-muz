#!/usr/bin/env bash
# Menjadwalkan backup dan uji restore dengan crond (zona waktu dari TZ).
# Perintah lain diteruskan, mis.: docker compose run --rm backup backup.sh
set -euo pipefail

if [ "$#" -gt 0 ]; then exec "$@"; fi

mkdir -p /backups /config/rclone
{
  echo "${BACKUP_CRON:-30 2 * * *} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1"
  echo "${RESTORE_TEST_CRON:-15 4 * * 0} /usr/local/bin/restore-test.sh >> /proc/1/fd/1 2>&1"
} > /etc/crontabs/root
echo "Jadwal backup: ${BACKUP_CRON:-30 2 * * *}; uji restore: ${RESTORE_TEST_CRON:-15 4 * * 0} (TZ=${TZ:-UTC})"
[ -f /config/rclone/rclone.conf ] || echo "Peringatan: /config/rclone/rclone.conf belum ada. Lihat deploy/README.md."
exec crond -f -l 6
