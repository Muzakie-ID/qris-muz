# Backup harian PostgreSQL (pg_dump) ke Google Drive lewat rclone, plus uji restore berkala.
# Berbasis image postgres yang sama dengan database, jadi versi pg_dump selalu cocok.
FROM rclone/rclone:1.68.2 AS rclone

FROM postgres:16-alpine
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY backup.sh restore-test.sh lib.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore-test.sh /usr/local/bin/lib.sh /usr/local/bin/entrypoint.sh
ENV RCLONE_CONFIG=/config/rclone/rclone.conf
VOLUME ["/backups", "/config/rclone"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD []
