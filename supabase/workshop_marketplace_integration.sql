-- =============================================================================
-- Мастерская: источник заказа и ключи интеграции с Ozon
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения:
--   1. supabase/workshop_printers_orders.sql — таблица workshop_orders;
--   2. supabase/workshop_settings.sql — таблица workshop_settings;
--   3. этот файл.
-- Повторный запуск безопасен: `add column if not exists` ничего не меняет, а
-- `notify` лишь сбрасывает кэш схемы PostgREST.
--
-- Зачем колонки:
--   1. workshop_orders.source хранит, откуда пришёл заказ. Ручные заказы
--      получают `manual`, а будущая синхронизация Ozon/WB/Яндекс Маркета
--      сможет сохранить свой источник и не менять ручные записи;
--   2. workshop_settings.ozon_client_id и ozon_api_key хранят доступы к
--      личному кабинету продавца Ozon. Ключи необязательны: интеграция
--      включается только после того, как пользователь их заполнит;
--   3. workshop_settings.webhook_token — персональный токен адреса вебхука.
--      Ozon может не присылать Client-Id в заголовках, поэтому продавца
--      определяет `?token=<uuid>`. Default `gen_random_uuid()` заполняет и
--      старые строки, а unique не даёт двум мастерским получить один адрес.
--
-- Про not null и default 'manual':
--   у всех заказов, созданных до миграции, источника нет, но они созданы
--   вручную через мастерскую. Default проставляет `manual` существующим
--   строкам и вставкам без явного source, поэтому старые данные остаются
--   валидными без отдельного update.
--
-- Ключи Ozon — секреты: их нельзя показывать в интерфейсе клиентам и нельзя
-- отдавать в браузер. RLS workshop_settings уже разрешает читать строку только
-- её владельцу; серверная синхронизация должна использовать эту же строку.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'workshop_orders'
--      and column_name = 'source';
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.workshop_orders'::regclass
--      and conname = 'workshop_orders_source_check';
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_settings'
--      and column_name in ('ozon_client_id', 'ozon_api_key', 'webhook_token')
--    order by ordinal_position;
--   select indexname from pg_indexes
--    where schemaname = 'public' and tablename = 'workshop_settings'
--      and indexname = 'workshop_settings_webhook_token_key';
-- =============================================================================

alter table public.workshop_orders
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'ozon', 'wb', 'yandex'));

comment on column public.workshop_orders.source is
  'Источник заказа: manual — создан в мастерской, ozon/wb/yandex — импортирован с маркетплейса.';

alter table public.workshop_settings
  add column if not exists ozon_client_id text,
  add column if not exists ozon_api_key text,
  add column if not exists webhook_token uuid not null default gen_random_uuid();

-- Повторный запуск после частичного применения: заполняем пропуски и
-- закрепляем default/not null, чтобы каждая строка получила свой адрес.
update public.workshop_settings
   set webhook_token = gen_random_uuid()
 where webhook_token is null;

alter table public.workshop_settings
  alter column webhook_token set default gen_random_uuid(),
  alter column webhook_token set not null;

-- Токен — ключ поиска продавца в вебхуке. Уникальность обязательна: по одному
-- адресу Ozon не должен попадать в чужую мастерскую.
create unique index if not exists workshop_settings_webhook_token_key
  on public.workshop_settings (webhook_token);

comment on column public.workshop_settings.ozon_client_id is
  'Ozon Seller: Client-Id приложения; null — интеграция не настроена.';
comment on column public.workshop_settings.ozon_api_key is
  'Ozon Seller: Api-Key приложения, только для серверных запросов; null — интеграция не настроена.';
comment on column public.workshop_settings.webhook_token is
  'Персональный UUID адреса вебхука (/api/webhooks/ozon?token=...); по нему Ozon находит продавца.';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не видит
-- новые колонки и отвечает PGRST204.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Существующие заказы стали ручными:
--      select id, title, source
--        from public.workshop_orders
--       where user_id = '<USER_ID>'
--       order by created_at desc;
--    Ожидается: source = 'manual' у всех старых записей.
--
-- 2) Неизвестный источник отклоняется ограничением:
--      update public.workshop_orders set source = 'avito'
--       where id = '<ORDER_ID>' and user_id = '<USER_ID>';
--    Ожидается ошибка violates check constraint
--    "workshop_orders_source_check".
--
-- 3) Ключи Ozon сохранены и пусты по умолчанию, а токен создан:
--      select ozon_client_id, ozon_api_key, webhook_token
--        from public.workshop_settings
--       where user_id = '<USER_ID>';
--    Ожидается: null в ключах, пока интеграция не настроена; webhook_token —
--    непустой uuid, одинаковый при повторных запросах.
-- =============================================================================
