#!/usr/bin/env bash
# Joue supabase/schema.sql deux fois (idempotence) puis les tests comportementaux sur une base Postgres vierge.
# Connexion via les variables libpq standard : PGHOST, PGPORT, PGUSER (ex. PGHOST=localhost PGUSER=postgres).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="rdv_test_$$"
psql -d postgres -q -c "create database $DB"
trap 'psql -d postgres -q -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -d "$DB" -q -v ON_ERROR_STOP=1 "$@" 2>&1 | { grep -v NOTICE || true; }; }
run -f supabase/tests/00_supabase_stubs.sql
run -f supabase/schema.sql
run -f supabase/schema.sql
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/10_booking_and_search.sql
