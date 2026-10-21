-- Shared local workspace. Identities authenticate callers; they do not isolate data.
begin;
drop policy if exists memories_read on public.voice_memories;
drop policy if exists sessions_read on public.voice_sessions;
drop policy if exists turns_read on public.voice_turns;
create policy memories_read on public.voice_memories for select to authenticated using (true);
create policy sessions_read on public.voice_sessions for select to authenticated using (true);
create policy turns_read on public.voice_turns for select to authenticated using (true);

-- Preserve existing same-title records while making future titles workspace-wide.
-- The UUID suffix keeps the renamed record identifiable without discarding content.
with duplicates as (
  select id, row_number() over(partition by memory_type order by updated_at desc,id) as n
  from public.voice_memories
)
update public.voice_memories m
set memory_type=left(m.memory_type,159) || ' [' || m.id::text || ']'
from duplicates d where m.id=d.id and d.n>1;
create unique index voice_memories_shared_slot on public.voice_memories(memory_type);

create function public.voice_search_shared(query_text text,
  query_embedding extensions.vector(384) default null, match_count int default 5)
returns table(id uuid,label text,content text,score double precision)
language sql security invoker set search_path=public,extensions as $$
with vectors as (
  select m.id,row_number() over(order by m.embedding <=> query_embedding) r
  from voice_memories m where query_embedding is not null and m.embedding is not null
  order by m.embedding <=> query_embedding limit 40
), lexical as (
  select m.id,row_number() over(order by
    ts_rank_cd(m.fts,plainto_tsquery('simple',query_text)) desc,m.id) r
  from voice_memories m where length(trim(query_text))>0 and
    (m.fts @@ plainto_tsquery('simple',query_text)
     or position(lower(query_text) in lower(m.memory_type || ' ' || m.content))>0)
  limit 40
), scores as (
  select coalesce(v.id,l.id) id,
    coalesce(0.7/(60+v.r),0)+coalesce(0.3/(60+l.r),0) score
  from vectors v full outer join lexical l on v.id=l.id
)
select m.id,m.memory_type,m.content,s.score::double precision
from scores s join voice_memories m on m.id=s.id
order by s.score desc limit least(greatest(match_count,1),10);
$$;
revoke all on function public.voice_search_shared(text,extensions.vector,integer) from public,anon,authenticated;
grant execute on function public.voice_search_shared(text,extensions.vector,integer) to service_role;
notify pgrst, 'reload schema';
commit;
