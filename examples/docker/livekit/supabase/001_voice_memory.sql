-- Run once in the Supabase SQL editor (or apply with your migration tooling).
-- Tables are namespaced to avoid overwriting unrelated application data.
begin;
create extension if not exists vector with schema extensions;

create table public.voice_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 200),
  content text not null check(length(content) between 1 and 12000),
  embedding extensions.vector(384),
  fts tsvector generated always as (to_tsvector('simple', title || ' ' || content)) stored,
  updated_at timestamptz not null default now(),
  unique(user_id, title)
);
create table public.voice_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null check(length(memory_type) between 1 and 200),
  content text not null check(length(content) between 1 and 12000),
  embedding extensions.vector(384),
  fts tsvector generated always as (to_tsvector('simple', memory_type || ' ' || content)) stored,
  updated_at timestamptz not null default now(),
  unique(user_id, memory_type)
);
create table public.voice_sessions (
  room text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check(status in ('active','completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  report jsonb
);
create table public.voice_turns (
  id uuid primary key default gen_random_uuid(),
  room text not null references public.voice_sessions(room) on delete cascade,
  item_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  unique(room,item_id)
);
create index on public.voice_knowledge using hnsw (embedding extensions.vector_cosine_ops);
create index on public.voice_memories using hnsw (embedding extensions.vector_cosine_ops);
create index on public.voice_knowledge using gin(fts);
create index on public.voice_memories using gin(fts);
create index on public.voice_memories(user_id, updated_at desc);
create index on public.voice_sessions(user_id, started_at desc);
create index on public.voice_turns(user_id, created_at desc);

alter table public.voice_knowledge enable row level security;
alter table public.voice_memories enable row level security;
alter table public.voice_sessions enable row level security;
alter table public.voice_turns enable row level security;
-- Shared KB is readable by signed-in users. Private memory/history stays owned.
create policy knowledge_read on public.voice_knowledge for select to authenticated using (true);
create policy memories_read on public.voice_memories for select to authenticated using (auth.uid() = user_id);
create policy sessions_read on public.voice_sessions for select to authenticated using (auth.uid() = user_id);
create policy turns_read on public.voice_turns for select to authenticated using (auth.uid() = user_id);
-- Writes go through the application server, which verifies identity and embeds content.
revoke all on public.voice_knowledge, public.voice_memories, public.voice_sessions, public.voice_turns from anon, authenticated;
grant select on public.voice_knowledge, public.voice_memories, public.voice_sessions, public.voice_turns to authenticated;
grant all on public.voice_knowledge, public.voice_memories, public.voice_sessions, public.voice_turns to service_role;

-- Hybrid rank fusion. Literal substring matching also handles Chinese terms/IDs
-- which the built-in simple tokenizer cannot reliably segment into words.
create function public.voice_search(p_user_id uuid, p_kind text, query_text text,
  query_embedding extensions.vector(384) default null, match_count int default 5)
returns table(id uuid, label text, content text, score double precision)
language sql security invoker set search_path = public, extensions as $$
with candidates as (
  select k.id, k.title as label, k.content, k.embedding, k.fts
  from voice_knowledge k where p_kind = 'knowledge'
  union all
  select m.id, m.memory_type, m.content, m.embedding, m.fts
  from voice_memories m where p_kind = 'memories' and m.user_id = p_user_id
), vectors as (
  select c.id, row_number() over(order by c.embedding <=> query_embedding) r
  from candidates c where query_embedding is not null and c.embedding is not null
  order by c.embedding <=> query_embedding limit 40
), lexical as (
  select c.id, row_number() over(order by
    ts_rank_cd(c.fts, plainto_tsquery('simple', query_text)) desc, c.id) r
  from candidates c where length(trim(query_text)) > 0 and
    (c.fts @@ plainto_tsquery('simple', query_text)
     or position(lower(query_text) in lower(c.label || ' ' || c.content)) > 0)
  limit 40
), scores as (
  select coalesce(v.id,l.id) id,
    coalesce(0.7/(60+v.r),0) + coalesce(0.3/(60+l.r),0) score
  from vectors v full outer join lexical l on v.id=l.id
)
select c.id,c.label,c.content,s.score::double precision from scores s
join candidates c on c.id=s.id order by s.score desc
limit least(greatest(match_count,1),10);
$$;
revoke all on function public.voice_search(uuid,text,text,extensions.vector,integer) from public, anon, authenticated;
grant execute on function public.voice_search(uuid,text,text,extensions.vector,integer) to service_role;

-- Realtime publication is required for the live control-panel tables.
do $$
declare t text;
begin
  foreach t in array array['voice_knowledge','voice_memories','voice_sessions','voice_turns'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
commit;
