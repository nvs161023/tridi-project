-- =============================================================================
-- Мастерская: очередь проверки связи с принтером («Проверить связь»)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: после supabase/workshop_printer_protocols.sql (секреты
-- протокола) и supabase/workshop_farm_and_shop.sql (settings с agent_token).
-- Повторный запуск безопасен: таблица создаётся через `create table if not
-- exists`, политики — через `drop policy if exists` и повторное создание.
--
-- Зачем таблица, а не запрос «в лоб»: агент работает на компьютере мастера в
-- локальной сети и не имеет входящего порта — сервер не может вызвать
-- `adapter.probe()` сам. Поэтому кнопка в форме кладёт просьбу в очередь, а
-- агент забирает её на ближайшем опросе (раз в POLL_INTERVAL секунд), проверяет
-- принтер и возвращает результат в ту же строку. Это тот же приём, что у флага
-- workshop_settings.scan_requested, только с полезной нагрузкой и ответом.
--
-- Почему секреты лежат в строке очереди, хотя это копия printer_secrets: форма
-- добавления проверяет принтер ДО сохранения, когда строки в workshop_printers
-- ещё нет. Строка живёт до первого ответа агента и удаляется вместе с
-- остальными суточными при открытии новой проверки, поэтому копия секретов не
-- задерживается в базе. Доступ к строкам — только у владельца (RLS) и у
-- service_role, которым ходит агент.
-- =============================================================================

create table if not exists public.workshop_printer_probes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Протокол и адрес — то, без чего адаптер не собрать.
  protocol_type text not null,
  ip_address text not null,
  -- SN нужен Bambu (топики MQTT) и FlashForge (заголовок каждого запроса).
  serial_number text,
  -- Первичный секрет: ключ API, код доступа Bambu, пароль PrusaLink.
  api_key text,
  -- Остальные секреты протокола: checkCode FlashForge, username/password и
  -- deviceId/modeId Anycubic, mainboardId Elegoo, storage PrusaLink.
  printer_secrets jsonb,
  -- pending → running → done. Отдельного «failed» нет: отказ принтера — это
  -- ответ (`ok: false` и причина), а не сбой очереди.
  status text not null default 'pending',
  -- Ответ адаптера: model, serialNumber, firmware, capabilities, formats.
  result jsonb,
  -- Причина отказа своими словами: «неверный Access Code», «принтер выключен».
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint workshop_printer_probes_status_check
    check (status in ('pending', 'running', 'done')),
  -- Форма секретов: объект и не больше 4 КБ — как у workshop_printers.
  constraint workshop_printer_probes_secrets_check
    check (
      printer_secrets is null
      or (
        jsonb_typeof(printer_secrets) = 'object'
        and pg_column_size(printer_secrets) <= 4096
      )
    )
);

comment on table public.workshop_printer_probes is
  'Очередь проверки связи («Проверить связь»): форма кладёт просьбу, локальный агент забирает её на опросе, отвечает через adapter.probe() и возвращает результат в ту же строку. Секреты в строке — временная копия: она нужна, пока принтер не сохранён.';


-- Агент ищет только pending и только своей мастерской; частичный индекс
-- оставляет в нём лишь незавершённые проверки.
create index if not exists workshop_printer_probes_pending_idx
  on public.workshop_printer_probes (user_id, created_at)
  where status = 'pending';

-- Уборка суточных строк — по created_at.
create index if not exists workshop_printer_probes_created_idx
  on public.workshop_printer_probes (user_id, created_at);

alter table public.workshop_printer_probes enable row level security;

-- Владелец видит свои проверки и создаёт новые. Обновляет строки только агент
-- (service_role обходит RLS), иначе браузер мог бы подделать результат пробы.
drop policy if exists workshop_printer_probes_select_own
  on public.workshop_printer_probes;
create policy workshop_printer_probes_select_own
  on public.workshop_printer_probes
  for select
  using (auth.uid() = user_id);

drop policy if exists workshop_printer_probes_insert_own
  on public.workshop_printer_probes;
create policy workshop_printer_probes_insert_own
  on public.workshop_printer_probes
  for insert
  with check (auth.uid() = user_id);

-- Удаление — для уборки старых строк из той же формы: иначе таблица росла бы
-- копиями секретов после каждой неудачной попытки.
drop policy if exists workshop_printer_probes_delete_own
  on public.workshop_printer_probes;
create policy workshop_printer_probes_delete_own
  on public.workshop_printer_probes
  for delete
  using (auth.uid() = user_id);

-- PostgREST читает схему из кэша: без этого новая таблица отвечает PGRST205
-- «could not find the table in the schema cache».

-- -----------------------------------------------------------------------------
-- Проверка применения (выполнить вручную):
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'workshop_printer_probes'
--    order by ordinal_position;
--   Ожидание: 13 колонок, id | user_id | protocol_type | ip_address |
--             serial_number | api_key | printer_secrets | status | result |
--             error | created_at | started_at | finished_at.
--
--   select policyname, cmd from pg_policies
--    where tablename = 'workshop_printer_probes';
--   Ожидание: три политики — select, insert, delete.
--
--   select conname from pg_constraint
--    where conrelid = 'public.workshop_printer_probes'::regclass;
--   Ожидание: первичный ключ, внешний ключ на auth.users и два check:
--             workshop_printer_probes_status_check,
--             workshop_printer_probes_secrets_check.
-- -----------------------------------------------------------------------------

notify pgrst, 'reload schema';
