-- =============================================================================
-- Мастерская: надёжность очереди печати и журнал заданий
-- =============================================================================
-- Обновление для базы, где `workshop_print_jobs` уже создана по
-- `supabase/workshop_farm_and_shop.sql`. Применяется вручную: Supabase
-- Dashboard → SQL Editor (или psql/Termius). Повторный запуск безопасен:
-- колонки добавляются через `add column if not exists`, ограничения и политики
-- пересоздаются, функции — `create or replace`.
--
-- Зачем:
--   1. причина отказа задания (`last_error`): агент присылает её вместе со
--      статусом, и карточка заказа показывает «G-code не загружен на принтер:
--      …», а не просто «провалено»;
--   2. оценка слайсера (`estimated_seconds`, `filament_grams`): агент читает её
--      из G-code, карточка показывает «≈2 ч 5 мин» и пластик;
--   3. метки этапов (`queued_at`, `started_at`, `finished_at`): очередь и
--      длительность печати считаются по базе, а не по `updated_at`;
--   4. флаг `cancel_requested`: кнопка «Отменить печать» останавливает уже
--      начатую печать — агент видит флаг при следующем опросе;
--   5. статус `cancelled`: отмена не притворяется ошибкой печати;
--   6. журнал `workshop_print_events`: кто и когда поставил, начал, закрыл или
--      отменил задание. Таблица в публикации Realtime — карточка заказа
--      обновляется без перезагрузки;
--   7. триггер `workshop_print_jobs_sync_order()` (AFTER, чтобы журнал мог
--      ссылаться на уже записанное задание) переносит заказ по Канбану там же,
--      где меняется задание: раньше это делали Server Action и агент по
--      очереди, и при обрыве сети доска оставалась в неверной колонке;
--   8. функция `workshop_cancel_print_job(uuid)` — единственный путь отмены:
--      проверяет владельца и сама решает, отменять задание или просить агента
--      остановить печать.
--
-- Зависимости: `auth.users` и `auth.uid()` (Supabase), таблицы
-- `workshop_orders`, `workshop_printers`, `workshop_print_jobs`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Колонки задания
-- -----------------------------------------------------------------------------
alter table public.workshop_print_jobs
  add column if not exists last_error text,
  add column if not exists estimated_seconds integer,
  add column if not exists filament_grams numeric(10, 2),
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists cancel_requested boolean not null default false;

-- Старые задания получили момент постановки из created_at: без этого очередь
-- не смогла бы показать позицию задания в списке.
update public.workshop_print_jobs
   set queued_at = created_at
 where queued_at is null;

alter table public.workshop_print_jobs
  alter column queued_at set default now();

alter table public.workshop_print_jobs
  drop constraint if exists workshop_print_jobs_status_check;
alter table public.workshop_print_jobs
  add constraint workshop_print_jobs_status_check
  check (status in ('queued', 'printing', 'done', 'failed', 'cancelled'));

alter table public.workshop_print_jobs
  drop constraint if exists workshop_print_jobs_last_error_check;
alter table public.workshop_print_jobs
  add constraint workshop_print_jobs_last_error_check
  check (last_error is null or char_length(btrim(last_error)) between 1 and 500);

-- Оценка слайсера: секунды в году и 100 кг пластика — верхние границы разбора,
-- они же в agent/gcode_metadata.py.
alter table public.workshop_print_jobs
  drop constraint if exists workshop_print_jobs_estimated_seconds_check;
alter table public.workshop_print_jobs
  add constraint workshop_print_jobs_estimated_seconds_check
  check (
    estimated_seconds is null
    or estimated_seconds between 1 and 31536000
  );

alter table public.workshop_print_jobs
  drop constraint if exists workshop_print_jobs_filament_grams_check;
alter table public.workshop_print_jobs
  add constraint workshop_print_jobs_filament_grams_check
  check (
    filament_grams is null
    or (filament_grams > 0 and filament_grams <= 100000)
  );

comment on column public.workshop_print_jobs.last_error is
  'Причина последнего отказа: текст агента (до 500 символов) или отмены мастером.';
comment on column public.workshop_print_jobs.estimated_seconds is
  'Оценка времени печати из G-code, с; null — слайсер её не писал.';
comment on column public.workshop_print_jobs.filament_grams is
  'Оценка массы пластика из G-code, г; null — слайсер её не писал.';
comment on column public.workshop_print_jobs.queued_at is
  'Момент постановки в очередь; по нему считается позиция задания.';
comment on column public.workshop_print_jobs.started_at is
  'Момент, когда агент начал печать; null — задание ещё не запускалось.';
comment on column public.workshop_print_jobs.finished_at is
  'Момент закрытия задания (done, failed, cancelled); null — задание активно.';
comment on column public.workshop_print_jobs.cancel_requested is
  'Мастер попросил остановить печать: агент увидит флаг при следующем опросе.';

-- Позиция в очереди: задания мастерской в порядке постановки.
create index if not exists workshop_print_jobs_queue_idx
  on public.workshop_print_jobs (user_id, status, queued_at);

-- -----------------------------------------------------------------------------
-- 2. Журнал событий задания
-- -----------------------------------------------------------------------------
-- job_id — `on delete set null`, а не `on delete cascade`: мастер может удалить
-- само задание, но история печати заказа должна остаться (журнал читают по
-- order_id). Каскад нужен только заказу — `order_id` выше чистит журнал вместе
-- с ним. На ошибку `23503` вид ссылки не влияет: она возникала из-за BEFORE.
create table if not exists public.workshop_print_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null references public.workshop_orders (id) on delete cascade,
  job_id uuid references public.workshop_print_jobs (id) on delete set null,
  printer_id uuid references public.workshop_printers (id) on delete set null,
  event text not null,
  message text,
  created_at timestamptz not null default now(),

  constraint workshop_print_events_event_check
    check (
      event in (
        'queued',
        'started',
        'done',
        'failed',
        'cancelled',
        'cancel_requested'
      )
    ),
  constraint workshop_print_events_message_check
    check (message is null or char_length(btrim(message)) between 1 and 500)
);

comment on table public.workshop_print_events is
  'Журнал очереди печати: постановка, запуск, завершение, отказ и отмена заданий.';
comment on column public.workshop_print_events.event is
  'queued | started | done | failed | cancelled | cancel_requested.';
comment on column public.workshop_print_events.message is
  'Пояснение: причина отказа или просьба об отмене (до 500 символов).';

create index if not exists workshop_print_events_order_idx
  on public.workshop_print_events (order_id, created_at desc);
create index if not exists workshop_print_events_user_idx
  on public.workshop_print_events (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Синхронизация заказа и журнала при смене статуса задания
-- -----------------------------------------------------------------------------
-- Триггер AFTER, и это обязательно: журнал `workshop_print_events` ссылается на
-- задание через `job_id references workshop_print_jobs (id)`, а в BEFORE INSERT
-- строки задания в таблице ещё нет. Внешний ключ отвечал
--   23503 insert or update on table "workshop_print_events" violates
--   foreign key constraint "workshop_print_events_job_id_fkey"
-- и задание не создавалось вовсе — в интерфейсе это `write_failed`. В
-- AFTER-триггере строка уже записана, `new.id` существует, и `job_id` уходит в
-- журнал корректно.
--
-- Метки этапов (`queued_at`, `started_at`, `finished_at`, `cancel_requested`,
-- `last_error`) раньше проставлялись прямо в `new`, но AFTER-триггер строку
-- менять не может — они пишутся отдельным `update` ниже. `status` в его `set`
-- не входит, поэтому триггер не вызывает сам себя.
--
-- Заказ двигается здесь, а не в Server Action: агент пишет статус через
-- PostgREST и при обрыве сети после `update` доска раньше оставалась в
-- колонке «В очереди». Теперь обе записи меняются одной транзакцией.
create or replace function public.workshop_print_jobs_sync_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining_active integer := 0;
  event_name text;
  event_message text;
  -- Значения, которыми должна стать строка задания после этого перехода:
  -- в AFTER-триггере их применяет update в конце функции.
  next_queued_at timestamptz := new.queued_at;
  next_started_at timestamptz := new.started_at;
  next_finished_at timestamptz := new.finished_at;
  next_cancel_requested boolean := new.cancel_requested;
  next_last_error text := new.last_error;
begin
  -- Прогресс без смены статуса журнал не засоряет: агент присылает его каждые
  -- несколько секунд. `old` есть только у UPDATE, поэтому проверка вложенная.
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return null;
    end if;
  end if;

  if new.status = 'queued' then
    next_queued_at := coalesce(new.queued_at, now());
    -- Заказ остаётся в «Новых»: «В печати» ставит только переход задания в
    -- `printing`, то есть реальный старт на станке (блок ниже). Иначе очередь из
    -- пятнадцати заданий на десять принтеров целиком показывалась бы
    -- печатающейся, и колонка «В печати» переставала быть сигналом. Состояние
    -- «ждёт принтер» карточка заказа берёт из самого задания
    -- (`getOrderActivePrintJob`), статус заказа ей для этого не нужен.

    event_name := 'queued';
    event_message := null;
  elsif new.status = 'printing' then
    next_started_at := coalesce(new.started_at, now());
    next_finished_at := null;
    next_cancel_requested := false;

    -- Повторная печать возвращает заказ из «Готово» в «Печать».
    update public.workshop_orders
       set status = 'printing'
     where id = new.order_id
       and user_id = new.user_id
       and status in ('new', 'ready');

    event_name := 'started';
    event_message := 'агент начал печать';
  elsif new.status = 'done' then
    next_finished_at := coalesce(new.finished_at, now());
    next_cancel_requested := false;

    event_name := 'done';
    event_message := 'печать завершена';
  elsif new.status = 'cancelled' then
    next_finished_at := coalesce(new.finished_at, now());
    next_cancel_requested := false;
    next_last_error := coalesce(
      nullif(left(btrim(new.last_error), 500), ''),
      'отменено мастером'
    );

    event_name := 'cancelled';
    event_message := next_last_error;
  else
    next_finished_at := coalesce(new.finished_at, now());
    next_cancel_requested := false;
    next_last_error := nullif(left(btrim(new.last_error), 500), '');

    event_name := 'failed';
    event_message := coalesce(next_last_error, 'печать не удалась');
  end if;

  -- Метки этапов и причина отказа. В BEFORE-триггере это была правка `new`; в
  -- AFTER строку меняет только отдельный update. Запрос холостой, когда менять
  -- нечего: при обычной постановке в очередь все значения уже проставлены
  -- умолчаниями колонок (`queued_at default now()`, `cancel_requested false`).
  --
  -- Обрезка до 500 символов ниже — страховка для уже коротких значений. Причину
  -- длиннее база не примет раньше, чем сюда попадёт: `check` проверяется сразу
  -- после записи строки, до AFTER-триггера. В приложении это не достижимо —
  -- роут `/api/agent/status` и агент режут текст до 500 (STATUS_MESSAGE_MAX).
  update public.workshop_print_jobs
     set queued_at = next_queued_at,
         started_at = next_started_at,
         finished_at = next_finished_at,
         cancel_requested = next_cancel_requested,
         last_error = next_last_error
   where id = new.id
     and (
       queued_at is distinct from next_queued_at
       or started_at is distinct from next_started_at
       or finished_at is distinct from next_finished_at
       or cancel_requested is distinct from next_cancel_requested
       or last_error is distinct from next_last_error
     );

  -- Заказ закрывается, когда у него не осталось активных заданий: у заказа из
  -- нескольких позиций последнее слово за последним заданием.
  if new.status in ('done', 'failed', 'cancelled') then
    select count(*) into remaining_active
      from public.workshop_print_jobs
     where order_id = new.order_id
       and user_id = new.user_id
       and id <> new.id
       and status in ('queued', 'printing');

    if remaining_active = 0 then
      update public.workshop_orders
         set status = case when new.status = 'done' then 'ready' else 'new' end
       where id = new.order_id
         and user_id = new.user_id
         and status = 'printing';
    end if;
  end if;

  insert into public.workshop_print_events (
    user_id,
    order_id,
    job_id,
    printer_id,
    event,
    message
  )
  values (
    new.user_id,
    new.order_id,
    new.id,
    new.printer_id,
    event_name,
    event_message
  );

  -- AFTER-триггер уже ничего не возвращает: строка задания записана, её правки
  -- применил update выше.
  return null;
end;
$$;

comment on function public.workshop_print_jobs_sync_order() is
  'Двигает заказ по Канбану и пишет событие в журнал при смене статуса задания.';

-- AFTER, а не BEFORE: событие журнала ссылается на задание через job_id, и
-- внешний ключ должен видеть уже вставленную строку (`23503` на постановке в
-- очередь). drop перед create пересоздаёт триггер при повторном применении
-- файла — старый BEFORE-вариант снимается здесь же.
drop trigger if exists workshop_print_jobs_sync_order
  on public.workshop_print_jobs;
create trigger workshop_print_jobs_sync_order
  after insert or update of status on public.workshop_print_jobs
  for each row execute function public.workshop_print_jobs_sync_order();

-- -----------------------------------------------------------------------------
-- 4. Отмена задания мастером
-- -----------------------------------------------------------------------------
-- Кнопка «Отменить печать» не может обновить задание напрямую: у роли
-- authenticated есть только select/insert/delete (`workshop_farm_and_shop.sql`,
-- раздел 9.3), статусы меняет агент. Функция вынесена в security definer,
-- проверяет владельца и решает по статусу:
--   queued   → задание сразу закрывается как cancelled;
--   printing → поднимается cancel_requested, агент останавливает печать при
--              следующем опросе GET /api/agent/status.
create or replace function public.workshop_cancel_print_job(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.workshop_print_jobs;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в мастерскую'
      using errcode = '42501';
  end if;

  select * into job
    from public.workshop_print_jobs
   where id = p_job_id
     and user_id = auth.uid()
     for update;

  if not found then
    raise exception 'Задание не найдено'
      using errcode = 'P0002';
  end if;

  if job.status = 'queued' then
    update public.workshop_print_jobs
       set status = 'cancelled',
           last_error = 'отменено мастером до запуска'
     where id = job.id;

    return 'cancelled';
  end if;

  if job.status = 'printing' then
    update public.workshop_print_jobs
       set cancel_requested = true
     where id = job.id;

    insert into public.workshop_print_events (
      user_id,
      order_id,
      job_id,
      printer_id,
      event,
      message
    )
    values (
      job.user_id,
      job.order_id,
      job.id,
      job.printer_id,
      'cancel_requested',
      'мастер попросил остановить печать'
    );

    return 'requested';
  end if;

  raise exception 'Задание уже закрыто'
    using errcode = 'P0001';
end;
$$;

comment on function public.workshop_cancel_print_job(uuid) is
  'Отмена задания мастером: queued закрывается сразу, printing получает флаг для агента.';

revoke all on function public.workshop_cancel_print_job(uuid) from public;
revoke all on function public.workshop_cancel_print_job(uuid) from anon;
grant execute on function public.workshop_cancel_print_job(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Доступ к журналу и Realtime
-- -----------------------------------------------------------------------------
alter table public.workshop_print_events enable row level security;

drop policy if exists "workshop_print_events_select_own"
  on public.workshop_print_events;
create policy "workshop_print_events_select_own"
  on public.workshop_print_events
  for select to authenticated using (auth.uid() = user_id);

-- Журнал пишет только триггер (security definer), поэтому insert/update/delete
-- у браузера отобраны: подделанных событий в истории быть не может.
revoke all on public.workshop_print_events from anon, authenticated;
grant select on public.workshop_print_events to authenticated;
grant all on public.workshop_print_events to service_role;

-- Без строки в публикации подписка молча не получает ничего.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'workshop_print_events'
    ) then
      alter publication supabase_realtime
        add table public.workshop_print_events;
    end if;
  end if;
end
$$;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не увидит
-- новые колонки, таблицу и функцию.
notify pgrst, 'reload schema';


-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонки задания:
--      select column_name, data_type, is_nullable, column_default
--        from information_schema.columns
--       where table_schema = 'public'
--         and table_name = 'workshop_print_jobs'
--         and column_name in (
--           'last_error', 'estimated_seconds', 'filament_grams',
--           'queued_at', 'started_at', 'finished_at', 'cancel_requested'
--         )
--       order by column_name;
--    Ожидается семь строк, `cancel_requested` — boolean not null default false.
--
-- 2) Триггер и функция отмены на месте, триггер именно AFTER:
--      select tgname, pg_get_triggerdef(oid) as definition
--        from pg_trigger
--       where tgrelid = 'public.workshop_print_jobs'::regclass
--         and not tgisinternal;
--      select proname from pg_proc
--       where proname in (
--         'workshop_print_jobs_sync_order', 'workshop_cancel_print_job'
--       );
--    Ожидается два триггера (sync_order и touch_updated_at) и две функции.
--    В definition у sync_order должно быть `AFTER INSERT OR UPDATE OF status`.
--    Если видно `BEFORE`, применился старый вариант файла: журнал снова начнёт
--    падать с `23503` на постановке в очередь.
--
-- 3) Постановка задания пишет событие, но заказ пока не двигает (в SQL Editor
--    роль другая, поэтому проверять через приложение или service_role):
--      insert into public.workshop_print_jobs (user_id, order_id, order_item_id)
--      values ('<USER_ID>', '<ORDER_ID>', '<ORDER_ITEM_ID>')
--      returning id, status, queued_at;
--      select status from public.workshop_orders where id = '<ORDER_ID>';
--      select job_id, event, message from public.workshop_print_events
--       where order_id = '<ORDER_ID>' order by created_at desc limit 3;
--    Ожидается статус заказа new (в «Печати» он появится только после старта:
--    update public.workshop_print_jobs set status = 'printing' where id = '<JOB_ID>'
--    → заказ printing) и событие queued с тем же job_id, что вернул insert.
--    Ошибки `23503 ... workshop_print_events_job_id_fkey` быть не должно: журнал
--    пишется AFTER, когда строка задания уже в таблице.
--
-- 4) Отмена печатающегося задания просит агента остановиться:
--      select public.workshop_cancel_print_job('<JOB_ID>');   -- как владелец
--    Ожидается 'requested' и cancel_requested = true; после ответа агента статус
--    cancelled, finished_at заполнен, в журнале событие cancelled.
-- =============================================================================
