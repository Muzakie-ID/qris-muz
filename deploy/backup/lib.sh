#!/usr/bin/env bash
# Fungsi bersama skrip backup.

# File dump berisi seluruh data: hanya bisa dibaca root.
umask 077
# Sembunyikan NOTICE PostgreSQL (mis. "database ... does not exist, skipping").
export PGOPTIONS='-c client_min_messages=warning'

log() { echo "[$(date '+%F %T')] $*"; }

# Mencatat hasil (variabel psql dikutip aman lewat :'nama', jadi pesan error apa pun aman) ke tabel backup_runs agar tampil di dashboard dan memicu alarm Telegram.
# record <kind> <ok:true|false> <file> <size_bytes> <detail> <started_at>
record() {
  local id="bkp_$(date +%s)_${RANDOM}"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
    -v id="$id" -v kind="$1" -v ok="$2" -v file="$3" -v size="$4" -v detail="$5" -v started="$6" \
    <<'SQL' || log "Gagal mencatat hasil ke database."
insert into backup_runs (id, kind, ok, file, size_bytes, detail, started_at)
values (:'id', :'kind', :'ok'::boolean, nullif(:'file', ''), nullif(:'size', '')::bigint,
        nullif(:'detail', ''), nullif(:'started', '')::timestamptz);
SQL
}
