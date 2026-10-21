-- Supabase's PostgreSQL image supplies these roles and the auth schema.
\getenv pgpass POSTGRES_PASSWORD
alter role postgres with password :'pgpass';
alter role supabase_admin with password :'pgpass';
alter role authenticator with password :'pgpass';
alter role supabase_auth_admin with password :'pgpass';
create schema if not exists _realtime authorization supabase_admin;
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
