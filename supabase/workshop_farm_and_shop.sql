-- =============================================================================
-- Мастерская: 3D-ферма, товары и позиции заказов (CRM)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения (важен, файл расширяет готовые таблицы):
--   1. supabase/workshop_settings.sql
--   2. supabase/workshop_filaments.sql
--   3. supabase/workshop_printers_orders.sql
--   4. supabase/workshop_products.sql
--   5. supabase/workshop_farm_and_shop.sql (этот файл)
-- Повторный запуск безопасен: все колонки добавляются через `if not exists`,
-- ограничения — через проверку pg_constraint, таблицы — через `create table if
-- not exists`, политики пересоздаются через `drop policy if exists`.
--
-- Что делает файл:
--   1. расширяет workshop_orders деньгами маркетплейсов: номер заказа на
--      площадке, сумма для клиента, комиссия площадки и внутренняя
--      себестоимость печати. Из них аналитика считает маржу;
--   2. расширяет workshop_printers полями локального агента: протокол, адрес,
--      ключ, серийный номер (SN для Bambu), состояние, прогресс и остаток
--      печати;
--   3. выдаёт workshop_settings.agent_token — персональный ключ агента 3D-фермы
--      (аналог webhook_token у Ozon) — и заводит флаг scan_requested: просьбу
--      мастера «просканировать сеть», которую агент читает в цикле опроса;
--   4. расширяет workshop_products ссылкой на G-code и колонкой `name`;
--   5. создаёт workshop_marketplace_links — соответствие «SKU площадки → товар
--      каталога» (по нему заказ с Ozon/WB/Яндекса находит G-code);
--   6. создаёт workshop_order_items — позиции заказа (в заказе может быть
--      несколько товаров);
--   7. создаёт workshop_print_jobs — очередь печати для агента фермы;
--   8. создаёт workshop_discovered_printers — принтеры, найденные агентом при
--      сканировании сети: мастер даёт им имена, и они переезжают в
--      workshop_printers;
--   9. включает Realtime на workshop_orders, workshop_printers и
--      workshop_print_jobs: Канбан подписывается на изменения заказов, а вкладка
--      «Принтеры» — на статус, прогресс и текущее задание, и обе перезапрашивают
--      данные без перезагрузки страницы.
--
-- Мультитенантность: у каждой новой таблицы есть user_id с `on delete cascade`
-- на auth.users; RLS разрешает пользователю только свои строки. Агент работает
-- через service_role, поэтому мастерскую определяет токен: он ищется в
-- workshop_settings и задаёт user_id для выборки очереди.
--
-- Про workshop_products.name:
--   таблица уже существует и называет товар колонкой `title` (её читают
--   lib/workshop/products.ts и вкладка «Товары»). Переименование сломало бы
--   приложение и старые данные, поэтому `name` — генерируемый алиас
--   `generated always as (title) stored`: новое имя есть в схеме и в PostgREST,
--   а источником правды остаётся title. `gcode_url` — новая необязательная
--   колонка, её заполняет мастер при подготовке товара к печати.
--
-- Про agent_token:
--   это секрет, как пароль. Он не должен попадать в клиентские компоненты,
--   логи и URL страниц (только в заголовок запроса агента). Пока агент не
--   подключён, токен просто лежит в настройках мастерской.
--
-- Про scan_requested:
--   браузер не видит локальную сеть мастерской — её видит только агент, который
--   стоит рядом с принтерами. Поэтому кнопка «Найти принтеры в сети» не
--   сканирует сама, а поднимает флаг: Server Action requestNetworkScan() пишет
--   true, агент читает его в цикле опроса (GET /api/agent/scan-status), обходит
--   сеть, отправляет находки в POST /api/agent/discover и сбрасывает флаг
--   (POST /api/agent/scan-complete). default false: без просьбы мастера агент
--   сеть не сканирует.
--
-- Про деньги: numeric(10, 2) вместо float — копейки не должны «плыть» при
-- сложении комиссий и себестоимости. null означает «неизвестно» и не
-- превращается в 0: маржа по заказу без комиссии считается неполной.
--
-- Проверить после применения — в конце файла.
-- =============================================================================

-- Весь файл — одна транзакция: при ошибке база остаётся в прежнем состоянии,
-- а не в частично применённом. Повторный запуск после исправления безопасен.
begin;

-- -----------------------------------------------------------------------------
-- 1. Заказы: деньги маркетплейсов
-- -----------------------------------------------------------------------------

alter table public.workshop_orders
  add column if not exists marketplace_order_id text,
  add column if not exists total_amount numeric(10, 2),
  add column if not exists marketplace_commission numeric(10, 2),
  add column if not exists internal_print_cost numeric(10, 2);

comment on column public.workshop_orders.marketplace_order_id is
  'Номер заказа на площадке (Ozon/WB/Яндекс Маркет); null — ручной заказ.';
comment on column public.workshop_orders.total_amount is
  'Сумма, которую платит покупатель на площадке, ₽; null — неизвестна.';
comment on column public.workshop_orders.marketplace_commission is
  'Комиссия площадки, ₽; null — неизвестна (маржа считается неполной).';
comment on column public.workshop_orders.internal_print_cost is
  'Внутренняя себестоимость печати, ₽ (пластик, электричество, работа); null — не посчитана.';

-- Суммы не бывают отрицательными, а номер заказа не должен быть пустой
-- строкой: RLS и Server Action проверяют владельца, но не формат денег.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_orders'::regclass
       and conname = 'workshop_orders_marketplace_amounts_check'
  ) then
    alter table public.workshop_orders
      add constraint workshop_orders_marketplace_amounts_check
      check (
        (total_amount is null or total_amount >= 0)
        and (marketplace_commission is null or marketplace_commission >= 0)
        and (internal_print_cost is null or internal_print_cost >= 0)
        and (
          marketplace_order_id is null
          or char_length(btrim(marketplace_order_id)) between 1 and 128
        )
      );
  end if;
end;
$$;

-- Статус `unmapped` — заказ маркетплейса, в котором хотя бы один SKU не связан
-- с товаром каталога. Старая миграция workshop_printers_orders.sql создала
-- check только на четыре статуса, поэтому ограничение пересоздаётся здесь:
-- drop/add идемпотентен и работает на уже существующей таблице.
alter table public.workshop_orders
  drop constraint if exists workshop_orders_status_check;

alter table public.workshop_orders
  add constraint workshop_orders_status_check
  check (status in ('new', 'printing', 'ready', 'delivered', 'unmapped'));

comment on column public.workshop_orders.status is
  'Статус: unmapped → new → printing → ready → delivered. unmapped — в заказе есть SKU без связи с товаром.';

-- Один и тот же заказ площадки не должен импортироваться дважды: иначе
-- вебхук Ozon создаст дубль и удвоит выручку в аналитике. Уникальность — в
-- пределах мастерской; разные площадки в теории могут выдать одинаковый номер,
-- но префиксы Ozon/WB/Яндекс это исключают, а лишняя колонка source в индексе
-- потребовала бы ещё одну миграцию-предусловие.
create unique index if not exists workshop_orders_user_marketplace_order_uidx
  on public.workshop_orders (user_id, marketplace_order_id)
  where marketplace_order_id is not null;

-- Индекс по статусу уже создан в workshop_printers_orders.sql. Повторяем его
-- здесь дословно: `if not exists` ничего не делает на готовой базе, но файл
-- остаётся самодостаточным, если старую миграцию применили частично.
create index if not exists workshop_orders_user_status_idx
  on public.workshop_orders (user_id, status);

-- -----------------------------------------------------------------------------
-- 2. Принтеры: связь с локальным агентом 3D-фермы
-- -----------------------------------------------------------------------------

-- protocol_type — чем управляется принтер:
--   moonraker — Klipper (Ender/Voron после перепрошивки);
--   octoprint — OctoPrint REST API;
--   bambu     — MQTT Bambu Lab (в агенте отдельный драйвер).
-- status — состояние, которое агент обновляет при опросе. progress — проценты
-- 0…100, remaining_time — секунды до конца печати. last_seen_at — когда агент
-- последний раз успешно связался с принтером; по нему ферма показывает
-- «офлайн», не полагаясь на status.
-- serial_number — серийный номер Bambu Lab: по нему строятся топики
-- device/<serial>/report и device/<serial>/request. У Moonraker и OctoPrint
-- такого понятия нет, поэтому колонка nullable.
alter table public.workshop_printers
  add column if not exists protocol_type text not null default 'moonraker',
  add column if not exists ip_address text,
  add column if not exists api_key text,
  add column if not exists serial_number text,
  add column if not exists status text not null default 'idle',
  add column if not exists progress integer not null default 0,
  add column if not exists remaining_time integer not null default 0,
  add column if not exists last_seen_at timestamptz;

-- Повторный запуск после частичного применения: заполняем пропуски и
-- закрепляем default/not null. Без этого старые строки могли бы получить null
-- в status/progress, если колонка когда-то была создана вручную.
update public.workshop_printers
   set protocol_type = coalesce(protocol_type, 'moonraker'),
       status = coalesce(status, 'idle'),
       progress = coalesce(progress, 0),
       remaining_time = coalesce(remaining_time, 0)
 where protocol_type is null
    or status is null
    or progress is null
    or remaining_time is null;

alter table public.workshop_printers
  alter column protocol_type set default 'moonraker',
  alter column protocol_type set not null,
  alter column status set default 'idle',
  alter column status set not null,
  alter column progress set default 0,
  alter column progress set not null,
  alter column remaining_time set default 0,
  alter column remaining_time set not null;

comment on column public.workshop_printers.protocol_type is
  'Протокол управления: moonraker (Klipper), octoprint или bambu (MQTT).';
comment on column public.workshop_printers.ip_address is
  'Локальный адрес принтера в сети мастерской; null — агент ещё не настроен.';
comment on column public.workshop_printers.api_key is
  'Ключ API принтера (Moonraker/OctoPrint). Секрет: только для агента, не для интерфейса.';
comment on column public.workshop_printers.serial_number is
  'Серийный номер Bambu Lab (SN): из него агент строит MQTT-топики. null — не задан, агент найдёт номер сам.';
comment on column public.workshop_printers.status is
  'Состояние от агента: idle, printing, paused, error или offline.';
comment on column public.workshop_printers.progress is
  'Прогресс текущей печати, % (0…100); 0 — печать не идёт.';
comment on column public.workshop_printers.remaining_time is
  'Остаток текущей печати, секунды; 0 — печать не идёт.';
comment on column public.workshop_printers.last_seen_at is
  'Когда агент последний раз получил ответ от принтера; null — ещё ни разу.';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_printers'::regclass
       and conname = 'workshop_printers_farm_fields_check'
  ) then
    alter table public.workshop_printers
      add constraint workshop_printers_farm_fields_check
      check (
        protocol_type in ('moonraker', 'octoprint', 'bambu')
        and status in ('idle', 'printing', 'paused', 'error', 'offline')
        and progress between 0 and 100
        and remaining_time >= 0
        and (
          ip_address is null
          or char_length(btrim(ip_address)) between 1 and 253
        )
        and (api_key is null or char_length(api_key) between 1 and 512)
      );
  end if;
end;
$$;

-- Серийник необязателен, но если он есть — это непустая строка до 64 символов:
-- агент подставляет её в топик device/<serial>/…, и пустое или слишком длинное
-- значение дало бы молчаливо нерабочую подписку. Предел с запасом покрывает
-- формат Bambu (15 знаков) и будущие модели; пробелы по краям обрезает форма.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_printers'::regclass
       and conname = 'workshop_printers_serial_number_check'
  ) then
    alter table public.workshop_printers
      add constraint workshop_printers_serial_number_check
      check (
        serial_number is null
        or char_length(btrim(serial_number)) between 1 and 64
      );
  end if;
end;
$$;

-- Ферма показывает «кто печатает и кто свободен» — фильтр по владельцу и
-- статусу. Отдельный индекс по created_at уже есть в старой миграции.
create index if not exists workshop_printers_user_status_idx
  on public.workshop_printers (user_id, status);

-- -----------------------------------------------------------------------------
-- 3. Настройки: токен агента 3D-фермы и флаг сканирования сети
-- -----------------------------------------------------------------------------

-- Токен — такой же персональный ключ, как webhook_token у Ozon: агент
-- присылает его в заголовке, серверная функция ищет мастерскую по токену и
-- отдаёт только её очередь. Default заполняет и старые строки, unique не даёт
-- двум мастерским получить один ключ.
alter table public.workshop_settings
  add column if not exists agent_token uuid not null default gen_random_uuid();

update public.workshop_settings
   set agent_token = gen_random_uuid()
 where agent_token is null;

alter table public.workshop_settings
  alter column agent_token set default gen_random_uuid(),
  alter column agent_token set not null;

create unique index if not exists workshop_settings_agent_token_key
  on public.workshop_settings (agent_token);

comment on column public.workshop_settings.agent_token is
  'Персональный UUID агента 3D-фермы; секрет, только для заголовка запроса агента.';

-- Просьба мастера «найти принтеры в сети»: кнопка в мастере подключения ставит
-- флаг, агент читает его в цикле опроса и сбрасывает после обхода сети (см.
-- app/api/agent/scan-status и app/api/agent/scan-complete). not null default
-- false — старые строки сразу получают «сканировать не просили», иначе агент
-- обходил бы сеть при каждом запуске.
alter table public.workshop_settings
  add column if not exists scan_requested boolean not null default false;

comment on column public.workshop_settings.scan_requested is
  'Запрос мастера «просканировать сеть»: true — агент обойдёт сеть при следующем опросе и сбросит флаг.';

-- -----------------------------------------------------------------------------
-- 4. Товары: G-code и алиас name
-- -----------------------------------------------------------------------------

-- gcode_url — ссылка на файл печати (Supabase Storage, локальный сервер или
-- https-хранилище). Пустая строка запрещена: «нет файла» — это null.
alter table public.workshop_products
  add column if not exists gcode_url text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_products'::regclass
       and conname = 'workshop_products_gcode_url_check'
  ) then
    alter table public.workshop_products
      add constraint workshop_products_gcode_url_check
      check (
        gcode_url is null
        or char_length(btrim(gcode_url)) between 1 and 2048
      );
  end if;
end;
$$;

comment on column public.workshop_products.gcode_url is
  'Ссылка на G-code товара для агента печати; null — файла ещё нет.';

-- name — только для чтения: генерируемый алиас существующего title. Так CRM,
-- агент и новые запросы используют привычное `name`, а форма «Товары»
-- продолжает писать title, и данные не дублируются.
alter table public.workshop_products
  add column if not exists name text generated always as (title) stored;

comment on column public.workshop_products.name is
  'Алиас title (генерируемая колонка): название товара для CRM и агента.';

-- -----------------------------------------------------------------------------
-- 5. Связь SKU маркетплейса с товаром каталога
-- -----------------------------------------------------------------------------

-- Заказ с Ozon приходит с артикулом площадки (SKU), а печатать нужно товар из
-- каталога с G-code. Таблица хранит это соответствие. Один SKU у одной
-- мастерской на одной площадке — уникален (unique ниже); товар можно удалить,
-- тогда связь уходит вместе с ним (on delete cascade), а не висит мусором.
create table if not exists public.workshop_marketplace_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  marketplace text not null,
  sku text not null,
  product_id uuid not null
    references public.workshop_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint workshop_marketplace_links_marketplace_check
    check (marketplace in ('ozon', 'wb', 'yandex')),
  constraint workshop_marketplace_links_sku_check
    check (char_length(btrim(sku)) between 1 and 128),
  constraint workshop_marketplace_links_user_marketplace_sku_key
    unique (user_id, marketplace, sku)
);

comment on table public.workshop_marketplace_links is
  'Мастерская: соответствие SKU маркетплейса товару каталога (для поиска G-code).';
comment on column public.workshop_marketplace_links.marketplace is
  'Площадка: ozon, wb или yandex.';
comment on column public.workshop_marketplace_links.sku is
  'Артикул товара на площадке (Ozon SKU / артикул WB / SKU Яндекса).';
comment on column public.workshop_marketplace_links.product_id is
  'Товар каталога, который печатается по этому SKU.';

-- Уникальный индекс (user_id, marketplace, sku) уже покрывает поиск по
-- владельцу. Отдельный индекс нужен для списка связей товара и каскада.
create index if not exists workshop_marketplace_links_user_product_idx
  on public.workshop_marketplace_links (user_id, product_id);
create index if not exists workshop_marketplace_links_product_idx
  on public.workshop_marketplace_links (product_id);

-- -----------------------------------------------------------------------------
-- 6. Позиции заказа
-- -----------------------------------------------------------------------------

-- Один заказ может содержать несколько товаров (например, три вазы разных
-- цветов). Строка хранит снимок SKU на момент заказа: если товар переименуют
-- или удалят, история заказа останется понятной. product_id тогда станет null
-- (on delete set null), но sku и количество сохранятся.
create table if not exists public.workshop_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null
    references public.workshop_orders (id) on delete cascade,
  product_id uuid
    references public.workshop_products (id) on delete set null,
  sku text,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint workshop_order_items_sku_check
    check (sku is null or char_length(btrim(sku)) between 1 and 128),
  constraint workshop_order_items_quantity_check
    check (quantity between 1 and 10000)
);

comment on table public.workshop_order_items is
  'Мастерская: позиции заказа — товар, SKU на момент заказа и количество.';
comment on column public.workshop_order_items.order_id is
  'Заказ, к которому относится позиция; удаляется вместе с заказом.';
comment on column public.workshop_order_items.product_id is
  'Товар каталога; null — товар удалён или позиция добавлена вручную.';
comment on column public.workshop_order_items.sku is
  'Артикул на момент заказа (снимок); null — ручная позиция без артикула.';
comment on column public.workshop_order_items.quantity is
  'Сколько штук этого товара в заказе (1…10 000).';

-- Позиции всегда читаются в разрезе заказа и владельца. Индекс по order_id
-- нужен ещё и каскаду при удалении заказа, по product_id — обнулению ссылки.
create index if not exists workshop_order_items_user_order_idx
  on public.workshop_order_items (user_id, order_id);
create index if not exists workshop_order_items_order_idx
  on public.workshop_order_items (order_id);
create index if not exists workshop_order_items_product_idx
  on public.workshop_order_items (product_id);

-- -----------------------------------------------------------------------------
-- 7. Очередь печати для агента
-- -----------------------------------------------------------------------------

-- Жизненный цикл задания: queued → printing → done | failed.
--     queued   — создано приложением и ждёт агента;
--     printing — агент взял задание и печатает;
--     done     — печать завершена;
--     failed   — ошибка печати; причина пока остаётся в логах агента.
-- printer_id необязателен: задание можно поставить в очередь до выбора
-- принтера, а агент назначит свободный. gcode_url — снимок ссылки на момент
-- задания: если товар отредактируют, уже поставленная печать не изменится.
create table if not exists public.workshop_print_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null
    references public.workshop_orders (id) on delete cascade,
  order_item_id uuid not null
    references public.workshop_order_items (id) on delete cascade,
  printer_id uuid
    references public.workshop_printers (id) on delete set null,
  gcode_url text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_print_jobs_status_check
    check (status in ('queued', 'printing', 'done', 'failed')),
  constraint workshop_print_jobs_gcode_url_check
    check (
      gcode_url is null
      or char_length(btrim(gcode_url)) between 1 and 2048
    )
);

comment on table public.workshop_print_jobs is
  'Мастерская: очередь печати, которую разбирает локальный агент 3D-фермы.';
comment on column public.workshop_print_jobs.order_item_id is
  'Позиция заказа, которую печатает задание; удаляется вместе с ней.';
comment on column public.workshop_print_jobs.printer_id is
  'Назначенный принтер; null — агент выберет свободный.';
comment on column public.workshop_print_jobs.gcode_url is
  'Ссылка на G-code на момент создания задания; null — у товара не было файла.';
comment on column public.workshop_print_jobs.status is
  'Статус: queued → printing → done или failed. Меняет только агент (service_role).';
comment on column public.workshop_print_jobs.updated_at is
  'Момент последнего изменения; выставляется триггером при каждом update.';

-- Агент опрашивает очередь по владельцу и статусу, сортируя по времени
-- создания. Этот же индекс обслуживает список заданий в интерфейсе.
create index if not exists workshop_print_jobs_user_status_idx
  on public.workshop_print_jobs (user_id, status, created_at);
create index if not exists workshop_print_jobs_order_idx
  on public.workshop_print_jobs (order_id);
create index if not exists workshop_print_jobs_order_item_idx
  on public.workshop_print_jobs (order_item_id);
create index if not exists workshop_print_jobs_printer_idx
  on public.workshop_print_jobs (printer_id);

-- У одной позиции заказа не может быть двух активных заданий: иначе повторный
-- вебхук или двойной клик отправит модель на печать дважды. Завершённые и
-- провалившиеся задания индекс не трогает — повторную печать можно поставить.
create unique index if not exists workshop_print_jobs_active_item_uidx
  on public.workshop_print_jobs (order_item_id)
  where status in ('queued', 'printing');

-- updated_at не должен зависеть от клиента: даже если агент забыл передать
-- поле, триггер перезапишет его при update.
create or replace function public.workshop_print_jobs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workshop_print_jobs_touch_updated_at
  on public.workshop_print_jobs;
create trigger workshop_print_jobs_touch_updated_at
  before update on public.workshop_print_jobs
  for each row execute function public.workshop_print_jobs_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Найденные принтеры: автообнаружение фермы
-- -----------------------------------------------------------------------------

-- Мастеру со ста принтерами не вбить парк вручную: агент сканирует локальную
-- сеть и присылает адреса в POST /api/agent/discover (lib/workshop/printers.ts
-- разбирает ответ), а мастер только даёт имена. Найденная строка — черновик:
-- после подтверждения Server Action approveDiscoveredPrinters создаёт принтер в
-- workshop_printers и удаляет черновик, поэтому таблица остаётся списком «что
-- ждёт решения», а не историей сканирований. Статус `added` в check оставлен на
-- будущее: если решат хранить историю находок, код и база уже готовы.
-- name по умолчанию не пустая строка: карточка показывает «Неизвестный
-- принтер», пока мастер не введёт своё имя. protocol_type повторяет
-- справочник workshop_printers.protocol_type: агент знает, каким API ответил
-- принтер, и это знание не должно потеряться при подтверждении.
create table if not exists public.workshop_discovered_printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ip_address text not null,
  name text default 'Неизвестный принтер',
  protocol_type text default 'moonraker',
  serial_number text,
  status text default 'discovered',
  created_at timestamptz not null default now(),
  constraint workshop_discovered_printers_ip_check
    check (char_length(btrim(ip_address)) between 1 and 253),
  constraint workshop_discovered_printers_name_check
    check (name is null or char_length(btrim(name)) between 1 and 60),
  constraint workshop_discovered_printers_protocol_check
    check (protocol_type in ('moonraker', 'octoprint', 'bambu')),
  constraint workshop_discovered_printers_status_check
    check (status in ('discovered', 'added'))
);

comment on table public.workshop_discovered_printers is
  'Мастерская: принтеры, найденные агентом сканированием сети и ждущие подтверждения мастером.';
comment on column public.workshop_discovered_printers.ip_address is
  'Адрес принтера в локальной сети (IPv4 или имя узла), как его увидел агент.';
comment on column public.workshop_discovered_printers.name is
  'Имя, которое введёт мастер; до этого «Неизвестный принтер».';
comment on column public.workshop_discovered_printers.protocol_type is
  'Протокол, которым ответил принтер: moonraker (Klipper), octoprint или bambu.';
comment on column public.workshop_discovered_printers.serial_number is
  'Серийный номер, который принтер назвал сам (Bambu — поле USN в SSDP-ответе); null — не назвал.';
comment on column public.workshop_discovered_printers.status is
  'discovered — ждёт подтверждения мастера; added — уже перенесён в workshop_printers.';

-- Колонка добавлена после первого применения миграции: у уже созданной таблицы
-- serial_number нет, а `create table if not exists` её не дорастит. Поэтому
-- отдельный идемпотентный alter — его можно выполнять повторно.
alter table public.workshop_discovered_printers
  add column if not exists serial_number text;

-- Тот же предел, что у workshop_printers.serial_number (1…64 символа): пустой
-- номер — это «номера нет» (null), а строка длиннее 64 символов — уже не
-- серийник, а мусор от чужого устройства в подсети.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_discovered_printers'::regclass
       and conname = 'workshop_discovered_printers_serial_number_check'
  ) then
    alter table public.workshop_discovered_printers
      add constraint workshop_discovered_printers_serial_number_check
      check (
        serial_number is null
        or char_length(btrim(serial_number)) between 1 and 64
      );
  end if;
end;
$$;

-- Сканирование заменяет только неподтверждённые строки своей мастерской, а
-- подтверждение удаляет выбранные, поэтому выборка всегда идёт парой «владелец +
-- статус».
create index if not exists workshop_discovered_printers_user_status_idx
  on public.workshop_discovered_printers (user_id, status);

-- -----------------------------------------------------------------------------
-- 9. RLS и гранты новых таблиц
-- -----------------------------------------------------------------------------
-- Правило одно: authenticated видит и меняет строки только со своим user_id.
-- Вложенные проверки родителей (заказ, товар, принтер) не дают подставить чужой
-- uuid: RLS на родительской таблице отфильтрует его, а exists вернёт false.
-- Для workshop_print_jobs статус меняет только агент через service_role:
-- браузер не должен уметь объявить печать завершённой.

-- 9.1. Связи SKU ---------------------------------------------------------------

alter table public.workshop_marketplace_links enable row level security;

drop policy if exists "workshop_marketplace_links_select_own"
  on public.workshop_marketplace_links;
create policy "workshop_marketplace_links_select_own"
  on public.workshop_marketplace_links
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_marketplace_links_insert_own"
  on public.workshop_marketplace_links;
create policy "workshop_marketplace_links_insert_own"
  on public.workshop_marketplace_links
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.workshop_products p
       where p.id = workshop_marketplace_links.product_id
         and p.user_id = auth.uid()
    )
  );

drop policy if exists "workshop_marketplace_links_update_own"
  on public.workshop_marketplace_links;
create policy "workshop_marketplace_links_update_own"
  on public.workshop_marketplace_links
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.workshop_products p
       where p.id = workshop_marketplace_links.product_id
         and p.user_id = auth.uid()
    )
  );

drop policy if exists "workshop_marketplace_links_delete_own"
  on public.workshop_marketplace_links;
create policy "workshop_marketplace_links_delete_own"
  on public.workshop_marketplace_links
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workshop_marketplace_links from anon, authenticated;
grant select, insert, update, delete on public.workshop_marketplace_links
  to authenticated;
grant all on public.workshop_marketplace_links to service_role;

-- 9.2. Позиции заказа ----------------------------------------------------------

alter table public.workshop_order_items enable row level security;

drop policy if exists "workshop_order_items_select_own"
  on public.workshop_order_items;
create policy "workshop_order_items_select_own"
  on public.workshop_order_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_order_items_insert_own"
  on public.workshop_order_items;
create policy "workshop_order_items_insert_own"
  on public.workshop_order_items
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.workshop_orders o
       where o.id = workshop_order_items.order_id
         and o.user_id = auth.uid()
    )
    and (
      workshop_order_items.product_id is null
      or exists (
        select 1
          from public.workshop_products p
         where p.id = workshop_order_items.product_id
           and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "workshop_order_items_update_own"
  on public.workshop_order_items;
create policy "workshop_order_items_update_own"
  on public.workshop_order_items
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.workshop_orders o
       where o.id = workshop_order_items.order_id
         and o.user_id = auth.uid()
    )
    and (
      workshop_order_items.product_id is null
      or exists (
        select 1
          from public.workshop_products p
         where p.id = workshop_order_items.product_id
           and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists "workshop_order_items_delete_own"
  on public.workshop_order_items;
create policy "workshop_order_items_delete_own"
  on public.workshop_order_items
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workshop_order_items from anon, authenticated;
grant select, insert, update, delete on public.workshop_order_items
  to authenticated;
grant all on public.workshop_order_items to service_role;

-- 9.3. Очередь печати ----------------------------------------------------------

alter table public.workshop_print_jobs enable row level security;

drop policy if exists "workshop_print_jobs_select_own"
  on public.workshop_print_jobs;
create policy "workshop_print_jobs_select_own"
  on public.workshop_print_jobs
  for select to authenticated using (auth.uid() = user_id);

-- Пользователь ставит задание в очередь только для своей позиции своего
-- заказа и своего принтера. status при вставке обязан быть 'queued': без этого
-- браузер мог бы сразу прислать status='done' в обход default. Статусы дальше
-- меняет только агент — update у authenticated отобран грантом.
drop policy if exists "workshop_print_jobs_insert_own"
  on public.workshop_print_jobs;
create policy "workshop_print_jobs_insert_own"
  on public.workshop_print_jobs
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and workshop_print_jobs.status = 'queued'
    and exists (
      select 1
        from public.workshop_order_items i
       where i.id = workshop_print_jobs.order_item_id
         and i.order_id = workshop_print_jobs.order_id
         and i.user_id = auth.uid()
    )
    and exists (
      select 1
        from public.workshop_orders o
       where o.id = workshop_print_jobs.order_id
         and o.user_id = auth.uid()
    )
    and (
      workshop_print_jobs.printer_id is null
      or exists (
        select 1
          from public.workshop_printers pr
         where pr.id = workshop_print_jobs.printer_id
           and pr.user_id = auth.uid()
      )
    )
  );

-- Отменить ошибочно поставленное задание можно, но только своё.
drop policy if exists "workshop_print_jobs_delete_own"
  on public.workshop_print_jobs;
create policy "workshop_print_jobs_delete_own"
  on public.workshop_print_jobs
  for delete to authenticated using (auth.uid() = user_id);

-- Агент ходит с service_role (обходит RLS), политика нужна для явности и для
-- баз, где у служебной роли не включён bypassrls.
drop policy if exists "workshop_print_jobs_update_agent"
  on public.workshop_print_jobs;
create policy "workshop_print_jobs_update_agent"
  on public.workshop_print_jobs
  for update to service_role
  using (true)
  with check (true);

revoke all on public.workshop_print_jobs from anon, authenticated;
grant select, insert, delete on public.workshop_print_jobs to authenticated;
grant all on public.workshop_print_jobs to service_role;

-- 9.4. Найденные принтеры ------------------------------------------------------
-- Политика одна на все команды: список находок читает, дополняет и очищает
-- только владелец. Агент пишет сюда через service_role (POST /api/agent/discover
-- в app/api/agent/discover/route.ts), поэтому отдельных политик для него не
-- нужно: правило «authenticated видит только свои строки» одного `for all`
-- достаточно.
alter table public.workshop_discovered_printers enable row level security;

drop policy if exists "workshop_discovered_printers_own"
  on public.workshop_discovered_printers;
create policy "workshop_discovered_printers_own"
  on public.workshop_discovered_printers
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.workshop_discovered_printers from anon, authenticated;
grant select, insert, update, delete on public.workshop_discovered_printers
  to authenticated;
grant all on public.workshop_discovered_printers to service_role;

-- -----------------------------------------------------------------------------
-- 10. Realtime для Канбана и карточек принтеров
-- -----------------------------------------------------------------------------
-- Подписчиков два:
--   * Канбан заказов (components/workshop/WorkshopOrdersTab.tsx: канал
--     realtime-orders, событие postgres_changes по public.workshop_orders,
--     далее router.refresh());
--   * вкладка «Принтеры» (components/workshop/WorkshopPrintersTab.tsx: канал
--     realtime-printers, события по public.workshop_printers — status, progress,
--     remaining_time, last_seen_at — и по public.workshop_print_jobs — какой
--     заказ печатается на принтере, название берётся через связь с
--     workshop_orders).
-- Realtime отдаёт события только по таблицам, добавленным в публикацию
-- supabase_realtime: без этих строк подписка молча не получает ничего, и данные
-- обновляются лишь после перезагрузки страницы.
--
-- RLS у всех трёх таблиц уже включён (workshop_orders_select_own в
-- supabase/workshop_printers_orders.sql; workshop_printers_select_own и
-- workshop_print_jobs_select_own выше в этом файле), поэтому события приходят
-- только по строкам текущего пользователя — как и при обычном select.
--
-- REPLICA IDENTITY не меняем: по умолчанию это первичный ключ, а обработчикам
-- важно лишь то, что строка изменилась, — сами данные они берут с сервера.
--
-- Блок идемпотентный: на готовой базе он ничего не делает, на чистой — создаёт
-- публикацию, если её нет, и добавляет недостающие таблицы. Иначе
-- `alter publication` упал бы с «publication does not exist» и откатил всю
-- транзакцию файла.

do $$
begin
  if not exists (
    select 1
      from pg_publication
     where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'workshop_orders'
  ) then
    alter publication supabase_realtime add table public.workshop_orders;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'workshop_printers'
  ) then
    alter publication supabase_realtime add table public.workshop_printers;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'workshop_print_jobs'
  ) then
    alter publication supabase_realtime add table public.workshop_print_jobs;
  end if;
end $$;

-- PostgREST кэширует схему: без перечитывания новые таблицы ещё некоторое время
-- отвечают PGRST205, а новые колонки — PGRST204. Строка последняя: ниже схему
-- уже никто не меняет.
notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонки расширенных таблиц:
--      select table_name, column_name, data_type, column_default, is_nullable
--        from information_schema.columns
--       where table_schema = 'public'
--         and table_name in ('workshop_orders', 'workshop_printers',
--                            'workshop_settings', 'workshop_products')
--         and column_name in ('marketplace_order_id', 'total_amount',
--                             'marketplace_commission', 'internal_print_cost',
--                             'protocol_type', 'ip_address', 'api_key', 'status',
--                             'progress', 'remaining_time', 'last_seen_at',
--                             'agent_token', 'scan_requested', 'gcode_url', 'name')
--       order by table_name, column_name;
--
-- 2) Новые таблицы и их ограничения:
--      select tablename, indexname from pg_indexes
--       where schemaname = 'public'
--         and tablename in ('workshop_marketplace_links', 'workshop_order_items',
--                           'workshop_print_jobs',
--                           'workshop_discovered_printers')
--       order by tablename, indexname;
--      select conrelid::regclass, conname, pg_get_constraintdef(oid)
--        from pg_constraint
--       where conrelid in ('public.workshop_marketplace_links'::regclass,
--                          'public.workshop_order_items'::regclass,
--                          'public.workshop_print_jobs'::regclass,
--                          'public.workshop_discovered_printers'::regclass)
--       order by conrelid::regclass::text, conname;
--
-- 3) Политики и гранты:
--      select tablename, policyname, cmd, roles
--        from pg_policies
--       where schemaname = 'public'
--         and tablename in ('workshop_marketplace_links', 'workshop_order_items',
--                           'workshop_print_jobs',
--                           'workshop_discovered_printers')
--       order by tablename, policyname;
--      select table_name, privilege_type
--        from information_schema.role_table_grants
--       where table_schema = 'public'
--         and grantee = 'authenticated'
--         and table_name in ('workshop_marketplace_links', 'workshop_order_items',
--                            'workshop_print_jobs',
--                            'workshop_discovered_printers')
--       order by table_name, privilege_type;
--    Ожидается: у workshop_print_jobs среди прав authenticated нет UPDATE, а у
--    workshop_discovered_printers есть ровно одна политика
--    workshop_discovered_printers_own на все команды.
--
-- 4) Имя товара — алиас title:
--      insert into public.workshop_products (user_id, sku, title)
--      values ('<USER_ID>', '<SKU>', 'Ваза');
--      select title, name from public.workshop_products
--       where user_id = '<USER_ID>' and sku = '<SKU>';
--    Ожидается: title = name = 'Ваза'; вставка в name отклоняется, потому что
--    колонка генерируемая.
--
-- 5) Дубль заказа площадки отклоняется:
--      insert into public.workshop_orders
--        (user_id, title, marketplace_order_id, total_amount)
--      values ('<USER_ID>', '<TITLE>', '<ORDER_ID>', 1000);
--      -- повторить тот же insert
--    Ожидается: duplicate key value violates unique constraint
--    "workshop_orders_user_marketplace_order_uidx".
--
-- 6) Чужой заказ не виден (выполнять под JWT пользователя, не service_role):
--      select id, title from public.workshop_orders;
--    Ожидается: только заказы текущего пользователя.
--
-- 7) Realtime включён для заказов и парка:
--      select schemaname, tablename
--        from pg_publication_tables
--       where pubname = 'supabase_realtime'
--       order by tablename;
--    Ожидается: среди строк есть public | workshop_orders,
--    public | workshop_printers и public | workshop_print_jobs. Если какой-то
--    таблицы нет, Канбан или карточки принтеров обновляются только после
--    перезагрузки страницы — подписки в
--    components/workshop/WorkshopOrdersTab.tsx и
--    components/workshop/WorkshopPrintersTab.tsx работают, но база молчит.
--
-- 8) Найденные принтеры (автообнаружение):
--      insert into public.workshop_discovered_printers
--        (user_id, ip_address, serial_number)
--      values ('<USER_ID>', '192.168.1.50', '01S00C123456789');
--      select ip_address, name, protocol_type, serial_number, status
--        from public.workshop_discovered_printers
--       where user_id = '<USER_ID>';
--    Ожидается: name = 'Неизвестный принтер', protocol_type = 'moonraker',
--    serial_number = '01S00C123456789', status = 'discovered'. serial_number
--    nullable: Moonraker и OctoPrint номера не называют, и вставка без него
--    проходит. Повторный POST /api/agent/discover с тем же адресом
--    не создаёт вторую строку: старые `discovered` удаляются перед вставкой.
--    Политика workshop_discovered_printers_own (for all) не даёт прочитать
--    чужую находку даже при известном id.
--
-- 9) Запрос сканирования сети из интерфейса:
--      update public.workshop_settings set scan_requested = true
--       where user_id = '<USER_ID>';
--      select scan_requested from public.workshop_settings
--       where user_id = '<USER_ID>';
--    Ожидается: true. При следующем опросе агент увидит флаг
--    (GET /api/agent/scan-status с токеном мастерской), обойдёт сеть, пришлёт
--    находки в POST /api/agent/discover и сбросит флаг в false
--    (POST /api/agent/scan-complete). Если флаг остался true — агент не запущен
--    или не может достучаться до CRM: кнопка в мастере подключения просит
--    проверить агент, а не показывает пустой список.
-- =============================================================================
