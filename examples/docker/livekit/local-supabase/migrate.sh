#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS public.voice_schema_migrations (filename text primary key, applied_at timestamptz not null default now());'
psql -v ON_ERROR_STOP=1 -c 'REVOKE ALL ON public.voice_schema_migrations FROM anon,authenticated;'
for file in /migrations/[0-9]*.sql; do
    name=$(basename "$file")
    # Filenames are repository-owned migration names, never browser input.
    applied=$(psql -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.voice_schema_migrations WHERE filename='$name'")
    if [ "$applied" = 0 ]; then
        echo "Applying $name"
        psql -v ON_ERROR_STOP=1 -f "$file"
        psql -v ON_ERROR_STOP=1 -c "INSERT INTO public.voice_schema_migrations(filename) VALUES ('$name');"
    fi
done
