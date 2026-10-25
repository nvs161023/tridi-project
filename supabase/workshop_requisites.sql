-- =============================================================================
-- Мастерская: реквизиты компании
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: после `supabase/workshop_settings.sql` — колонки
-- добавляются в уже существующую таблицу. Повторный запуск безопасен:
-- `add column if not exists` ничего не меняет, а `notify` лишь сбрасывает кэш.
--
-- Зачем колонки:
--   1. мастерская работает от лица компании: на вкладке «Реквизиты»
--      пользователь один раз заполняет тип организации, название, ИНН, ОГРН,
--      юридический адрес, банк и контакты;
--   2. эти данные попадут в документы для клиентов (счета, накладные), поэтому
--      хранятся отдельно от контактов клиентов в `workshop_clients`;
--   3. тип и название обязательны: без них непонятно, от чьего имени выставлен
--      документ. Остальные поля необязательны — у самозанятого может не быть
--      ОГРН и банковского счёта.
--
-- Про not null и default '':
--   `company_name` не может быть null, но у уже сохранённых строк и у строк,
--   созданных формой калькулятора, названия ещё нет. Придумывать его в миграции
--   нельзя, поэтому значением по умолчанию стоит пустая строка — «реквизиты не
--   заполнены». Форма «Реквизиты» требует непустое название, так что пустое
--   значение живёт только до первого сохранения вкладки.
--
-- Пределы повторяют lib/workshop/requisites.ts (REQUISITES_TEXT_LIMITS), чтобы
-- форма и база не расходились: форма не даст ввести текст, который база
-- отклонит, а база не пропустит запрос в обход формы.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_settings'
--      and column_name in ('company_type', 'company_name', 'inn', 'ogrn',
--                          'legal_address', 'bank_details', 'contact_phone',
--                          'contact_email')
--    order by ordinal_position;
-- =============================================================================

alter table public.workshop_settings
  add column if not exists company_type text not null default 'self_employed'
    check (company_type in ('self_employed', 'ip', 'llc')),
  add column if not exists company_name text not null default ''
    check (char_length(company_name) <= 200),
  add column if not exists inn text
    check (inn is null or inn ~ '^[0-9]{10}([0-9]{2})?$'),
  add column if not exists ogrn text
    check (ogrn is null or ogrn ~ '^[0-9]{13}([0-9]{2})?$'),
  add column if not exists legal_address text
    check (legal_address is null or char_length(legal_address) <= 400),
  add column if not exists bank_details text
    check (bank_details is null or char_length(bank_details) <= 600),
  add column if not exists contact_phone text
    check (contact_phone is null or char_length(contact_phone) <= 40),
  add column if not exists contact_email text
    check (contact_email is null or char_length(contact_email) <= 160);

comment on column public.workshop_settings.company_type is
  'Тип организации: self_employed — самозанятый, ip — ИП, llc — ООО.';
comment on column public.workshop_settings.company_name is
  'Название компании или ФИО; пустая строка — реквизиты ещё не заполнены.';
comment on column public.workshop_settings.inn is
  'ИНН: 10 цифр у ООО, 12 — у ИП и самозанятого; null — не указан.';
comment on column public.workshop_settings.ogrn is
  'ОГРН (13 цифр) или ОГРНИП (15 цифр); null — не указан.';
comment on column public.workshop_settings.legal_address is
  'Юридический адрес компании; null — не указан.';
comment on column public.workshop_settings.bank_details is
  'Банковские реквизиты для документов: счёт, банк, БИК, корр. счёт; null — нет.';
comment on column public.workshop_settings.contact_phone is
  'Контактный телефон в свободном виде; null — не указан.';
comment on column public.workshop_settings.contact_email is
  'Контактный email для документов; null — не указан.';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не видит
-- новые колонки и отвечает PGRST204.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонки и значения по умолчанию:
--      select column_name, data_type, is_nullable, column_default
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'workshop_settings'
--         and column_name in ('company_type', 'company_name', 'inn', 'ogrn',
--                             'legal_address', 'bank_details', 'contact_phone',
--                             'contact_email')
--       order by ordinal_position;
--    Ожидается: company_type text not null default 'self_employed',
--    company_name text not null default '', остальные — nullable text.
--
-- 2) Реквизиты пользователя:
--      select company_type, company_name, inn, ogrn, legal_address,
--             bank_details, contact_phone, contact_email, updated_at
--        from public.workshop_settings where user_id = '<USER_ID>';
--
-- 3) Неизвестный тип организации отклоняется ограничением:
--      update public.workshop_settings set company_type = 'other'
--       where user_id = '<USER_ID>';
--    Ожидается ошибка violates check constraint
--    "workshop_settings_company_type_check".
-- =============================================================================
