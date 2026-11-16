-- =============================================================================
-- Скачивания STL в Конструкторе: бесплатный лимит 3 в календарный месяц
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. каждая успешная генерация STL бесплатным пользователем оставляет запись;
--   2. сервер считает записи за текущий месяц по UTC и блокирует четвёртую
--      попытку до начала следующего месяца;
--   3. Pro-пользователи не записываются: для них лимита нет.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'constructor_downloads';
--   select indexname from pg_indexes where tablename = 'constructor_downloads';
-- =============================================================================

create table if not exists public.constructor_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Быстрый подсчёт за месяц: выборка всегда идёт по пользователю и периоду.
create index if not exists constructor_downloads_user_created_idx
  on public.constructor_downloads (user_id, created_at desc);

-- Row Level Security: пользователь видит только свои скачивания. Записывать
-- их может только service_role из API после успешной генерации STL, поэтому
-- политик insert/update/delete для authenticated намеренно нет.
alter table public.constructor_downloads enable row level security;

drop policy if exists "constructor_downloads_select_own"
  on public.constructor_downloads;

create policy "constructor_downloads_select_own"
  on public.constructor_downloads
  for select to authenticated using (auth.uid() = user_id);

-- Явно убираем права на запись у клиентских ролей: даже при будущей политике
-- INSERT не должна открыться возможность обойти лимит из браузера.
revoke all on public.constructor_downloads from anon, authenticated;
grant select on public.constructor_downloads to authenticated;
grant all on public.constructor_downloads to service_role;

-- =============================================================================
-- Атомарное списание бесплатного лимита
-- =============================================================================
-- Проверка «посчитай и вставь» двумя запросами гоняется: две параллельные
-- генерации обе видят count = 2 и обе получают третье скачивание. Функция
-- берёт транзакционную блокировку по пользователю, считает записи за текущий
-- месяц UTC и вставляет новую только при наличии места.
--
-- Возвращает id резерва или NULL, если лимит исчерпан. Роут при ошибке
-- генерации удаляет резерв (`release_constructor_download`), чтобы неудачная
-- попытка не сжигала скачивание.
--
-- security definer нужен, потому что запись делает только service_role, но
-- execute намеренно закрыт для anon/authenticated: иначе пользователь мог бы
-- резервировать слоты за других. p_limit проверяется в разумных границах,
-- чтобы ошибка вызова не заблокировала всех навсегда.
-- =============================================================================

create or replace function public.reserve_constructor_download(
  p_user_id uuid,
  p_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100'
      using errcode = '22023';
  end if;

  -- Блокировка на пользователя, а не на таблицу: генерации разных людей не
  -- ждут друг друга.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)::integer
    into v_used
    from public.constructor_downloads
   where user_id = p_user_id
     and created_at >= (date_trunc('month', now() at time zone 'utc')
                        at time zone 'utc');

  if v_used >= p_limit then
    return null;
  end if;

  insert into public.constructor_downloads (user_id)
  values (p_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.reserve_constructor_download(uuid, integer) is
  'Атомарно резервирует бесплатное скачивание STL; NULL — месячный лимит исчерпан.';

-- Удаление резерва при неудачной генерации. Отдельная функция, чтобы у
-- service_role не было прямого доступа к произвольному delete из клиента.
create or replace function public.release_constructor_download(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.constructor_downloads where id = p_id;
end;
$$;

comment on function public.release_constructor_download(uuid) is
  'Возвращает бесплатное скачивание, если генерация STL завершилась ошибкой.';

revoke all on function public.reserve_constructor_download(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.release_constructor_download(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_constructor_download(uuid, integer)
  to service_role;
grant execute on function public.release_constructor_download(uuid)
  to service_role;

-- Примеры проверки доступа:
--   select count(*) from public.constructor_downloads
--    where user_id = '<UUID>'
--      and created_at >= date_trunc('month', now() at time zone 'utc');
--
-- Удалить тестовые записи пользователя:
--   delete from public.constructor_downloads where user_id = '<UUID>';
-- =============================================================================
