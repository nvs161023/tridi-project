-- =============================================================================
-- Мастерская: жёсткий сброс триггеров очереди печати
-- =============================================================================
-- Когда запускать: постановка в очередь падает с
--   insert or update on table "workshop_print_events" violates foreign key
--   constraint "workshop_print_events_job_id_fkey"   (SQLSTATE 23503)
-- уже после того, как применён `workshop_print_queue_hardening.sql` с
-- AFTER-триггером. Это значит, что в базе остался старый BEFORE-триггер
-- (под тем же или другим именем), либо функция не перезаписалась, либо
-- предыдущий скрипт откатился целиком и ничего не изменил.
--
-- Что делает скрипт:
--   0. показывает, куда он вообще попал, и что стоит на таблице до правок;
--   1. снимает ВСЕ триггеры с `public.workshop_print_jobs` (любые имена);
--   2. удаляет прежние функции задания вместе с зависимостями (cascade);
--   3. возвращает триггер `updated_at`, который шаг 1 тоже снял: без него
--      `updated_at` перестанет обновляться (он объявлен в
--      `workshop_farm_and_shop.sql`, а не в этом файле);
--   4. создаёт заново функцию журнала и Канбана — строго AFTER-логика;
--   5. создаёт триггер `after insert or update of status`;
--   6. перевешивает ссылку журнала на задание: констрейнт с любым именем
--      удаляется, создаётся `workshop_print_events_job_id_fkey` →
--      `workshop_print_jobs (id)`;
--   7. показывает результат и перечитывает схему для PostgREST.
--
-- Скрипт идемпотентен: повторный запуск ничего не ломает. Выполнять целиком
-- одним запросом (Supabase Dashboard → SQL Editor → Run): это одна транзакция,
-- и при ошибке в любом шаге база останется как была.
--
-- Зависимости: `public.workshop_orders`, `public.workshop_printers`,
-- `public.workshop_print_jobs`, `auth.users` (Supabase).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Диагностика «до»: куда попал скрипт и что стоит на таблице
-- -----------------------------------------------------------------------------
-- Если в выводе не та база, что видит сайт (`NEXT_PUBLIC_SUPABASE_URL`), значит
-- файл применяется не к тому проекту — именно поэтому ошибка «не меняется».
select current_database() as database,
       current_user as role,
       inet_server_addr() as server,
       version() as version;

-- Все нестандартные триггеры задания: здесь видно, есть ли лишний BEFORE
-- (или триггер с неожиданным именем).
select tgname, pg_get_triggerdef(oid) as definition
  from pg_trigger
 where tgrelid = 'public.workshop_print_jobs'::regclass
   and not tgisinternal
 order by tgname;

-- Кто ещё пишет в журнал: функции, в теле которых есть `workshop_print_events`,
-- и триггеры, которые их вызывают. Чужая функция с insert в журнал — вторая
-- причина той же ошибки; после шага 1 её триггер тоже исчезнет.
select p.oid::regprocedure as function,
       t.tgname as trigger,
       t.tgrelid::regclass as table
  from pg_proc p
  left join pg_trigger t on t.tgfoid = p.oid
 where p.pronamespace = 'public'::regnamespace
   and p.prosrc ilike '%workshop_print_events%'
 order by 1, 2;


-- -----------------------------------------------------------------------------
-- 1. Снять все триггеры таблицы задания
-- -----------------------------------------------------------------------------
-- Имена не перечисляем: старый BEFORE-вариант мог остаться под другим именем,
-- и именно он вставляет событие раньше, чем задание появилось в таблице.
do $$
declare
  r record;
begin
  for r in (
    select tgname
      from pg_trigger
     where tgrelid = 'public.workshop_print_jobs'::regclass
       and not tgisinternal
  )
  loop
    execute 'drop trigger ' || quote_ident(r.tgname)
      || ' on public.workshop_print_jobs';
    raise notice 'снят триггер %', r.tgname;
  end loop;
end
$$;


-- -----------------------------------------------------------------------------
-- 2. Удалить прежние функции
-- -----------------------------------------------------------------------------
-- cascade здесь не страшен: триггеры уже сняты шагом 1, а больше от этих
-- функций ничего не зависит.
drop function if exists public.workshop_print_jobs_sync_order() cascade;
drop function if exists public.workshop_print_jobs_touch_updated_at() cascade;


-- -----------------------------------------------------------------------------
-- 3. Вернуть триггер updated_at (его снял шаг 1)
-- -----------------------------------------------------------------------------
-- Без него `updated_at` перестанет обновляться при смене статуса: агент пишет
-- статус через PostgREST и поле не передаёт, а по `updated_at` доска понимает,
-- что задание живое. Копия из `workshop_farm_and_shop.sql`, раздел 8 — держать
-- формулировку одинаковой.
create or replace function public.workshop_print_jobs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- drop перед create: шаг 1 его уже снял, но если скрипт запускают частями,
-- повторный create упал бы с «trigger already exists».
drop trigger if exists workshop_print_jobs_touch_updated_at
  on public.workshop_print_jobs;
create trigger workshop_print_jobs_touch_updated_at
  before update on public.workshop_print_jobs
  for each row execute function public.workshop_print_jobs_touch_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Функция журнала и Канбана — строго AFTER-логика
-- -----------------------------------------------------------------------------
-- Триггер AFTER обязателен: журнал `workshop_print_events` ссылается на задание
-- через `job_id references workshop_print_jobs (id)`, а в BEFORE INSERT строки
-- задания в таблице ещё нет — внешний ключ отвечал
--   23503 insert or update on table "workshop_print_events" violates
--   foreign key constraint "workshop_print_events_job_id_fkey"
-- и задание не создавалось вовсе (в интерфейсе `write_failed`). В AFTER строка
-- уже записана, `new.id` существует, `job_id` уходит в журнал корректно.
--
-- AFTER-триггер строку менять не может, поэтому метки этапов (`queued_at`,
-- `started_at`, `finished_at`, `cancel_requested`, `last_error`) копятся в
-- переменных `next_*` и применяются отдельным `update` в конце. `status` в его
-- `set` не входит — сам себя триггер не вызывает.
--
-- Заказ двигается здесь, а не в Server Action: агент пишет статус через
-- PostgREST, и при обрыве сети после `update` доска раньше оставалась в
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

  -- Метки этапов и причина отказа. Запрос холостой, когда менять нечего: при
  -- обычной постановке в очередь все значения уже проставлены умолчаниями
  -- колонок (`queued_at default now()`, `cancel_requested false`).
  --
  -- Обрезка до 500 символов — страховка для уже коротких значений: причину
  -- длиннее база не примет раньше, чем сюда попадёт (`check` проверяется сразу
  -- после записи строки, до AFTER-триггера). В приложении это не достижимо —
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

  -- AFTER-триггер ничего не возвращает: строка задания записана, её правки
  -- применил update выше.
  return null;
end;
$$;

comment on function public.workshop_print_jobs_sync_order() is
  'Двигает заказ по Канбану и пишет событие в журнал при смене статуса задания.';


-- -----------------------------------------------------------------------------
-- 5. Триггер AFTER (создаётся с нуля)
-- -----------------------------------------------------------------------------
-- `update of status` — триггер реагирует только на смену статуса; собственный
-- `update` внутри функции статус не трогает, поэтому рекурсии нет.
drop trigger if exists workshop_print_jobs_sync_order
  on public.workshop_print_jobs;
create trigger workshop_print_jobs_sync_order
  after insert or update of status on public.workshop_print_jobs
  for each row execute function public.workshop_print_jobs_sync_order();


-- -----------------------------------------------------------------------------
-- 6. Перевесить ссылку журнала на задание
-- -----------------------------------------------------------------------------
-- Вторая возможная причина той же `23503`: ссылка `journal.job_id` смотрит не
-- туда (таблицу журнала когда-то создали вручную, констрейнт назвали иначе или
-- он указывал на другую таблицу). Поэтому удаляем ВСЕ внешние ключи журнала,
-- которые смотрят на `workshop_print_jobs`, и создаём один правильный —
-- под тем именем, которое ждёт PostgREST: `workshop_print_events_job_id_fkey`.
-- `on delete set null`: мастер может удалить задание, но история печати заказа
-- должна остаться (журнал читают по `order_id`, там `on delete cascade`).
do $$
declare
  fk record;
begin
  if to_regclass('public.workshop_print_events') is null then
    raise warning
      'таблица public.workshop_print_events не найдена — сначала примените supabase/workshop_print_queue_hardening.sql';
    return;
  end if;

  for fk in (
    select conname
      from pg_constraint
     where conrelid = 'public.workshop_print_events'::regclass
       and contype = 'f'
       and confrelid = 'public.workshop_print_jobs'::regclass
  )
  loop
    execute format(
      'alter table public.workshop_print_events drop constraint %I',
      fk.conname
    );
    raise notice 'снят внешний ключ %', fk.conname;
  end loop;

  alter table public.workshop_print_events
    add constraint workshop_print_events_job_id_fkey
    foreign key (job_id) references public.workshop_print_jobs (id)
    on delete set null;
end
$$;


-- -----------------------------------------------------------------------------
-- 7. Проверка результата
-- -----------------------------------------------------------------------------
-- На таблице должно остаться ровно два триггера: `workshop_print_jobs_sync_order`
-- (AFTER INSERT OR UPDATE OF status) и `workshop_print_jobs_touch_updated_at`
-- (BEFORE UPDATE). Если в списке есть что-то ещё — это и был виновник `23503`.
select tgname, pg_get_triggerdef(oid) as definition
  from pg_trigger
 where tgrelid = 'public.workshop_print_jobs'::regclass
   and not tgisinternal
 order by tgname;

-- Машинная проверка: триггер есть и он AFTER (у BEFORE в tgtype выставлен бит 2).
select 'workshop_print_jobs_sync_order is AFTER' as check,
       exists (
         select 1
           from pg_trigger
          where tgrelid = 'public.workshop_print_jobs'::regclass
            and tgname = 'workshop_print_jobs_sync_order'
            and (tgtype & 2) = 0
       ) as ok;

-- Тело функции целиком: в нём не должно быть ни одного `new.<поле> :=`
-- (AFTER строку менять не может) и должен быть insert в журнал с `new.id`.
select pg_get_functiondef('public.workshop_print_jobs_sync_order()'::regprocedure)
         as function;

-- Ссылка журнала: ожидается одна строка `workshop_print_events_job_id_fkey` →
-- `workshop_print_jobs(id)` с `SET NULL`.
select con.conname,
       pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
 where con.conrelid = 'public.workshop_print_events'::regclass
   and con.contype = 'f'
 order by con.conname;

-- PostgREST держит описание схемы в кэше: после пересоздания триггеров его
-- нужно перечитать.
notify pgrst, 'reload schema';


-- =============================================================================
-- Проверка вживую (по желанию, отдельным запросом после применения скрипта)
-- =============================================================================
-- Возьмите любой существующий заказ и принтер своей мастерской. Вставка должна
-- вернуть id задания, а журнал — событие `queued` с тем же job_id. `23503`
-- означает, что скрипт не применён к той базе, с которой работает сайт.
--
--   begin;
--   insert into public.workshop_print_jobs (
--     user_id, order_id, order_item_id, printer_id, gcode_url, status
--   )
--   select o.user_id, o.id, i.id, pr.pid, null, 'queued'
--     from public.workshop_orders o
--     join lateral (
--       select id from public.workshop_order_items
--        where order_id = o.id
--        order by created_at
--        limit 1
--     ) i on true
--     left join lateral (
--       select id as pid from public.workshop_printers
--        where user_id = o.user_id
--        order by id
--        limit 1
--     ) pr on true
--    where o.id = 'ВАШ_ЗАКАЗ'::uuid
--   returning id, status, queued_at, cancel_requested;
--
--   select event, job_id, message
--     from public.workshop_print_events
--    where order_id = 'ВАШ_ЗАКАЗ'::uuid
--    order by created_at desc
--    limit 1;
--
--   -- Тест не оставляет мусора: задание, событие и статус заказа откатятся.
--   rollback;
-- =============================================================================
