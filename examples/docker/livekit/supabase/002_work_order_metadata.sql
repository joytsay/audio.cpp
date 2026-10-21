begin;
create table public.voice_work_orders (
  room text primary key references public.voice_sessions(room) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reported_at timestamptz,
  customer text,
  work_order_name text,
  site_code text,
  test_result text,
  source_text text,
  readback_text text,
  updated_at timestamptz not null default now()
);
create table public.voice_maintenance_items (
  id uuid primary key default gen_random_uuid(),
  room text not null references public.voice_work_orders(room) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id text not null,
  maintenance_type text,
  exhaust_fan_quantity integer check(exhaust_fan_quantity >= 0),
  panel_fan_quantity integer check(panel_fan_quantity >= 0),
  source_text text,
  readback_text text,
  updated_at timestamptz not null default now(),
  unique(room,equipment_id)
);
create table public.voice_spare_parts (
  id uuid primary key default gen_random_uuid(),
  room text not null references public.voice_work_orders(room) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id text,
  part_number text not null,
  serial_number text not null,
  manufactured_on date,
  capacitance_value numeric check(capacitance_value >= 0),
  capacitance_unit text,
  source_text text,
  readback_text text,
  updated_at timestamptz not null default now(),
  unique(room,serial_number)
);
alter table public.voice_work_orders enable row level security;
alter table public.voice_maintenance_items enable row level security;
alter table public.voice_spare_parts enable row level security;
create policy work_orders_read on public.voice_work_orders for select to authenticated using(auth.uid()=user_id);
create policy maintenance_items_read on public.voice_maintenance_items for select to authenticated using(auth.uid()=user_id);
create policy spare_parts_read on public.voice_spare_parts for select to authenticated using(auth.uid()=user_id);
revoke all on public.voice_work_orders, public.voice_maintenance_items, public.voice_spare_parts from anon,authenticated;
grant select on public.voice_work_orders, public.voice_maintenance_items, public.voice_spare_parts to authenticated;
grant all on public.voice_work_orders, public.voice_maintenance_items, public.voice_spare_parts to service_role;
create index on public.voice_work_orders(user_id,updated_at desc);
create index on public.voice_maintenance_items(user_id,updated_at desc);
create index on public.voice_spare_parts(user_id,updated_at desc);

-- All related rows update in one transaction. Missing/null fields preserve prior values.
create function public.voice_save_work_order(p_user_id uuid,p_room text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb;
begin
  if not exists(select 1 from voice_sessions where room=p_room and user_id=p_user_id) then
    raise exception 'Owned session not found';
  end if;
  insert into voice_work_orders(room,user_id) values(p_room,p_user_id) on conflict(room) do nothing;
  update voice_work_orders set
    reported_at=coalesce((p_data->>'reported_at')::timestamptz,reported_at),
    customer=coalesce(p_data->>'customer',customer),
    work_order_name=coalesce(p_data->>'work_order_name',work_order_name),
    site_code=coalesce(p_data->>'site_code',site_code),
    test_result=coalesce(p_data->>'test_result',test_result),
    source_text=coalesce(p_data->>'source_text',source_text),
    readback_text=coalesce(p_data->>'readback_text',readback_text),updated_at=now()
    where room=p_room and user_id=p_user_id;
  for item in select * from jsonb_array_elements(coalesce(p_data->'equipment','[]'::jsonb)) loop
    insert into voice_maintenance_items(room,user_id,equipment_id,maintenance_type,exhaust_fan_quantity,panel_fan_quantity,source_text,readback_text)
    values(p_room,p_user_id,item->>'equipment_id',item->>'maintenance_type',
      (item->>'exhaust_fan_quantity')::integer,(item->>'panel_fan_quantity')::integer,item->>'source_text',item->>'readback_text')
    on conflict(room,equipment_id) do update set
      maintenance_type=coalesce(excluded.maintenance_type,voice_maintenance_items.maintenance_type),
      exhaust_fan_quantity=coalesce(excluded.exhaust_fan_quantity,voice_maintenance_items.exhaust_fan_quantity),
      panel_fan_quantity=coalesce(excluded.panel_fan_quantity,voice_maintenance_items.panel_fan_quantity),
      source_text=coalesce(excluded.source_text,voice_maintenance_items.source_text),
      readback_text=coalesce(excluded.readback_text,voice_maintenance_items.readback_text),updated_at=now();
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_data->'spare_parts','[]'::jsonb)) loop
    insert into voice_spare_parts(room,user_id,equipment_id,part_number,serial_number,manufactured_on,capacitance_value,capacitance_unit,source_text,readback_text)
    values(p_room,p_user_id,item->>'equipment_id',item->>'part_number',item->>'serial_number',
      (item->>'manufactured_on')::date,(item->>'capacitance_value')::numeric,item->>'capacitance_unit',item->>'source_text',item->>'readback_text')
    on conflict(room,serial_number) do update set
      equipment_id=coalesce(excluded.equipment_id,voice_spare_parts.equipment_id),part_number=excluded.part_number,
      manufactured_on=coalesce(excluded.manufactured_on,voice_spare_parts.manufactured_on),
      capacitance_value=coalesce(excluded.capacitance_value,voice_spare_parts.capacitance_value),
      capacitance_unit=coalesce(excluded.capacitance_unit,voice_spare_parts.capacitance_unit),
      source_text=coalesce(excluded.source_text,voice_spare_parts.source_text),
      readback_text=coalesce(excluded.readback_text,voice_spare_parts.readback_text),updated_at=now();
  end loop;
  return jsonb_build_object('saved',true,'room',p_room);
end $$;
revoke all on function public.voice_save_work_order(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.voice_save_work_order(uuid,text,jsonb) to service_role;
alter publication supabase_realtime add table public.voice_work_orders,public.voice_maintenance_items,public.voice_spare_parts;
commit;
