-- =============================================================================
-- Мастерская: принтеры и заказы
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения важен: файл ссылается на уже существующие таблицы.
--   1. supabase/workshop_settings.sql
--   2. supabase/workshop_filaments.sql
--   3. этот файл
--   4. если workshop_printers уже создана без винта Z — supabase/workshop_printer_z_screw.sql
-- Если workshop_filaments ещё нет, create table с references (...) упадёт с
-- ошибкой 42P01 — это ожидаемо, примените склад пластика первым.
--
-- Зачем таблицы:
--   1. workshop_printers — парк принтеров мастера. Для каждого хранится общая
--      наработка, наработка сопла, смазки осей и винта Z и интервалы
--      обслуживания. Вкладка «Принтеры» рисует прогресс-бары и сбрасывает
--      счётчики кнопками «Заменить сопло», «Смазать оси» и «Смазать винт Z».
--      Интервал смазки осей 0 — «смазывать нечего»: так у Bambu Lab с
--      карбоновыми стержнями, которые чистят спиртом. Для сопла и винта Z 0 не
--      допускается: на них делят процент износа.
--   2. workshop_orders — заказы клиентов. У заказа необязательные ссылки на
--      принтер и катушку; при создании заказа Server Action прибавляет время
--      печати к наработке принтера и списывает вес модели со склада.
--
-- Пределы в check повторяют ограничения формы (lib/workshop/printers.ts и
-- lib/workshop/orders.ts): форма не даст ввести число, которое база отклонит,
-- а база не пропустит запрос в обход формы.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('workshop_printers', 'workshop_orders')
--    order by table_name, ordinal_position;
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and tablename in ('workshop_printers', 'workshop_orders')
--    order by tablename, policyname;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Принтеры
-- -----------------------------------------------------------------------------

create table if not exists public.workshop_printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Имя от пользователя («Мой Ender»), а brand/model — из справочника
  -- PRINTER_PRESETS: по ним карточка показывает модель и подсказку об уходе.
  name text not null
    check (char_length(btrim(name)) between 1 and 60),
  brand text not null
    check (char_length(btrim(brand)) between 1 and 40),
  model text not null
    check (char_length(btrim(model)) between 1 and 60),
  -- Наработки в часах: numeric(12, 2), чтобы минуты не терялись.
  total_hours numeric(12, 2) not null default 0
    check (total_hours >= 0 and total_hours <= 1000000),
  nozzle_hours numeric(12, 2) not null default 0
    check (nozzle_hours >= 0 and nozzle_hours <= 1000000),
  -- Интервал сопла — от 1 ч: на ноль делят прогресс-бар и признак «пора».
  nozzle_interval integer not null default 400
    check (nozzle_interval between 1 and 10000),
  lubrication_hours numeric(12, 2) not null default 0
    check (lubrication_hours >= 0 and lubrication_hours <= 1000000),
  -- 0 — смазка не требуется (карбоновые стержни Bambu Lab).
  lubrication_interval integer not null default 300
    check (lubrication_interval between 0 and 10000),
  -- Винт Z: наработка с последней смазки и интервал. Ноль в интервале не
  -- допускается — на него делят прогресс-бар, а винт Z есть у всех моделей.
  z_screw_hours numeric(12, 2) not null default 0
    check (z_screw_hours >= 0 and z_screw_hours <= 1000000),
  z_screw_interval integer not null default 720
    check (z_screw_interval between 1 and 10000),
  -- Дата последнего обслуживания: её выставляет сброс счётчика.
  last_maintenance_date date,
  created_at timestamptz not null default now()
);

comment on table public.workshop_printers is
  'Мастерская: принтеры мастера, их наработка и интервалы обслуживания.';
comment on column public.workshop_printers.name is
  'Имя принтера от пользователя: «Мой Ender», «Принтер в гараже».';
comment on column public.workshop_printers.brand is
  'Бренд из справочника PRINTER_PRESETS на момент добавления.';
comment on column public.workshop_printers.model is
  'Модель из справочника PRINTER_PRESETS на момент добавления.';
comment on column public.workshop_printers.total_hours is
  'Общая наработка принтера, ч; растёт на время печати каждого заказа.';
comment on column public.workshop_printers.nozzle_hours is
  'Наработка сопла с последней замены, ч; сбрасывается кнопкой «Заменить сопло».';
comment on column public.workshop_printers.nozzle_interval is
  'Интервал замены сопла, ч (1…10 000; по умолчанию 400).';
comment on column public.workshop_printers.lubrication_hours is
  'Наработка с последней смазки, ч; сбрасывается кнопкой «Смазать оси».';
comment on column public.workshop_printers.lubrication_interval is
  'Интервал смазки, ч (0…10 000; 0 — смазка не требуется, например карбоновые стержни).';
comment on column public.workshop_printers.z_screw_hours is
  'Наработка винта Z с последней смазки, ч; сбрасывается кнопкой «Смазать винт Z».';
comment on column public.workshop_printers.z_screw_interval is
  'Интервал смазки винта Z, ч (1…10 000; по умолчанию 720).';
comment on column public.workshop_printers.last_maintenance_date is
  'Дата последнего обслуживания; null — обслуживания ещё не было.';
comment on column public.workshop_printers.created_at is
  'Когда принтер добавили; по нему сортируется список.';

-- Список принтеров всегда фильтруется по владельцу и сортируется по дате
-- добавления — под этот запрос и индекс.
create index if not exists workshop_printers_user_created_idx
  on public.workshop_printers (user_id, created_at);

alter table public.workshop_printers enable row level security;

drop policy if exists "workshop_printers_select_own" on public.workshop_printers;
create policy "workshop_printers_select_own" on public.workshop_printers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_printers_insert_own" on public.workshop_printers;
create policy "workshop_printers_insert_own" on public.workshop_printers
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_printers_update_own" on public.workshop_printers;
create policy "workshop_printers_update_own" on public.workshop_printers
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Удаление своих строк: проданный или ошибочно добавленный принтер нужно уметь
-- убрать. В интерфейсе кнопки пока нет — она появится вместе с архивом.
drop policy if exists "workshop_printers_delete_own" on public.workshop_printers;
create policy "workshop_printers_delete_own" on public.workshop_printers
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workshop_printers from anon, authenticated;
grant select, insert, update, delete on public.workshop_printers to authenticated;
grant all on public.workshop_printers to service_role;

-- -----------------------------------------------------------------------------
-- 2. Заказы
-- -----------------------------------------------------------------------------

create table if not exists public.workshop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null
    check (char_length(btrim(title)) between 1 and 80),
  -- Пустое имя клиента хранится как null, а не пустой строкой.
  client_name text
    check (
      client_name is null
      or char_length(btrim(client_name)) between 1 and 60
    ),
  status text not null default 'new'
    check (status in ('new', 'printing', 'ready', 'delivered')),
  total_cost numeric(10, 2) not null default 0
    check (total_cost >= 0 and total_cost <= 1000000),
  material_weight_g integer not null default 0
    check (material_weight_g >= 0 and material_weight_g <= 100000),
  print_time_hours numeric(10, 2) not null default 0
    check (print_time_hours >= 0 and print_time_hours <= 100000),
  -- Ссылки необязательные: заказ можно завести до выбора принтера и катушки.
  -- Удаление принтера или катушки не стирает заказ, а обнуляет ссылку.
  printer_id uuid references public.workshop_printers (id) on delete set null,
  filament_id uuid references public.workshop_filaments (id) on delete set null,
  notes text
    check (notes is null or char_length(notes) <= 1000),
  deadline date,
  created_at timestamptz not null default now()
);

comment on table public.workshop_orders is
  'Мастерская: заказы клиентов со статусом, стоимостью и расходом ресурсов.';
comment on column public.workshop_orders.title is
  'Название заказа или модели: «Подставка для телефона».';
comment on column public.workshop_orders.client_name is
  'Имя клиента; null — клиент не указан.';
comment on column public.workshop_orders.status is
  'Статус: new → printing → ready → delivered.';
comment on column public.workshop_orders.total_cost is
  'Стоимость заказа для клиента, ₽.';
comment on column public.workshop_orders.material_weight_g is
  'Вес модели в граммах; при создании заказа списывается с выбранной катушки.';
comment on column public.workshop_orders.print_time_hours is
  'Время печати, ч; при создании заказа прибавляется к наработке принтера.';
comment on column public.workshop_orders.printer_id is
  'Принтер заказа; null — принтер не выбран, наработка не меняется.';
comment on column public.workshop_orders.filament_id is
  'Катушка заказа; null — пластик не списывается.';
comment on column public.workshop_orders.notes is
  'Заметки по заказу до 1000 символов; null — заметок нет.';
comment on column public.workshop_orders.deadline is
  'Срок сдачи; null — без срока.';
comment on column public.workshop_orders.created_at is
  'Когда заказ создали; по нему сортируется список.';

-- Список заказов: свои строки, новые сверху. Второй индекс — под фильтр по
-- статусу, когда появится архив.
create index if not exists workshop_orders_user_created_idx
  on public.workshop_orders (user_id, created_at desc);
create index if not exists workshop_orders_user_status_idx
  on public.workshop_orders (user_id, status);

alter table public.workshop_orders enable row level security;

drop policy if exists "workshop_orders_select_own" on public.workshop_orders;
create policy "workshop_orders_select_own" on public.workshop_orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_orders_insert_own" on public.workshop_orders;
create policy "workshop_orders_insert_own" on public.workshop_orders
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_orders_update_own" on public.workshop_orders;
create policy "workshop_orders_update_own" on public.workshop_orders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workshop_orders_delete_own" on public.workshop_orders;
create policy "workshop_orders_delete_own" on public.workshop_orders
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты такие же, как у склада: select/insert/update/delete своих строк.
-- RLS проверяет только user_id, поэтому существование принтера и катушки и их
-- принадлежность владельцу проверяет Server Action перед записью: чужой uuid
-- в printer_id RLS не отсекает, но и прочитать чужой принтер интерфейс не даст.
revoke all on public.workshop_orders from anon, authenticated;
grant select, insert, update, delete on public.workshop_orders to authenticated;
grant all on public.workshop_orders to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новые таблицы.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Пользователь видит только свои принтеры и заказы:
--      select id, name, brand, model, total_hours, nozzle_hours,
--             nozzle_interval, lubrication_hours, lubrication_interval,
--             z_screw_hours, z_screw_interval, last_maintenance_date, created_at
--        from public.workshop_printers
--       where user_id = '<USER_ID>'
--       order by created_at;
--      select id, title, status, total_cost, material_weight_g,
--             print_time_hours, printer_id, filament_id, deadline, created_at
--        from public.workshop_orders
--       where user_id = '<USER_ID>'
--       order by created_at desc;
--
-- 2) Наработка растёт на время печати, остаток уменьшается на вес модели:
--      select total_hours, nozzle_hours, lubrication_hours, z_screw_hours
--        from public.workshop_printers where id = '<PRINTER_ID>';
--      select remaining_weight_g
--        from public.workshop_filaments where id = '<FILAMENT_ID>';
--    После заказа на 2,5 ч и 120 г все четыре счётчика выросли на 2,5, а
--    остаток уменьшился на 120.
--
-- 3) Списать больше остатка нельзя: Server Action вернёт ошибку «В катушке
--    осталось … г», заказ не появится.
--
-- 4) Сброс обслуживания:
--      update public.workshop_printers
--         set nozzle_hours = 0, last_maintenance_date = current_date
--       where id = '<PRINTER_ID>' and user_id = '<USER_ID>';
--
-- 5) Убрать тестовые строки:
--      delete from public.workshop_orders where user_id = '<USER_ID>';
--      delete from public.workshop_printers where user_id = '<USER_ID>';
-- =============================================================================
