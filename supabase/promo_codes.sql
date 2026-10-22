-- =============================================================================
-- Промокоды на курсы (партии для Ozon)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. партия кодов выпускается в /admin/promo и выгружается в CSV для Ozon;
--   2. покупатель открывает https://tridi-print.ru/activate?code=...;
--   3. активация ставит used_at и used_by, после чего доступ к курсу даёт
--      lib/subscription.ts → hasPromoAccess (отдельная ветка рядом с purchases).
--
-- Почему доступ не пишется в purchases:
--   это не платёж, а подарок по промокоду. purchases используется для денег и
--   inv_id Robokassa; смешивать туда нулевые суммы нельзя. Поэтому активация
--   живёт в promo_codes, а hasCourseAccess проверяет её отдельным запросом.
--
-- Модель доступа:
--   1. Коды видны и создаются только через service_role (админка и CSV-роут).
--   2. Пользователь видит только свои активации: RLS-политика
--      used_by = auth.uid(). Неактивированные коды ему недоступны — перебрать
--      чужие коды через API нельзя.
--   3. anon не получает ни одной строки: гость видит только форму входа.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'promo_codes';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'promo_codes';
-- =============================================================================

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  -- Код в каноническом виде TRIDI-ABCD-1234: ровно так его печатает админка.
  code text not null unique,
  -- Только платные уровни: пакет pro и подписка сюда не входят.
  course_id text not null check (course_id in ('confident', 'engineer', 'profit')),
  -- Партия: «ozon-2026-10» и т.п. Нужна, чтобы отделять выгрузки друг от друга.
  batch text,
  note text,
  created_at timestamptz not null default now(),
  -- Срок действия кода; null — бессрочный.
  expires_at timestamptz,
  -- Момент активации; null — код ещё свободен.
  used_at timestamptz,
  -- Кто активировал. on delete set null: удаление аккаунта не должно ломать
  -- историю партии, а использованный код не должен снова стать доступным.
  used_by uuid references auth.users (id) on delete set null
);

-- Свободные коды одного курса — самый частый запрос (CSV и счётчики).
create index if not exists promo_codes_course_used_idx
  on public.promo_codes (course_id, used_at);

-- Проверка доступа: «есть ли у пользователя активация этого курса».
create index if not exists promo_codes_used_by_idx
  on public.promo_codes (used_by)
  where used_by is not null;

alter table public.promo_codes enable row level security;

-- Пользователь читает только собственные активации.
drop policy if exists "promo_codes_select_own" on public.promo_codes;
create policy "promo_codes_select_own" on public.promo_codes
  for select to authenticated using (used_by = auth.uid());

-- Политик insert/update/delete нет: коды выпускает и гасит только service_role.
-- Supabase выдаёт гранты новым таблицам автоматически, но явные grant/revoke
-- делают миграцию самодостаточной и закрывают anon.
revoke all on public.promo_codes from anon, authenticated;
grant select on public.promo_codes to authenticated;
grant all on public.promo_codes to service_role;

-- PostgREST кэширует схему: после создания таблицы просим перечитать её,
-- иначе API ещё некоторое время будет отвечать PGRST205.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Гость не видит кодов (0 строк или пустой массив):
--      curl "<SUPABASE_URL>/rest/v1/promo_codes?select=code" \
--        -H "apikey: <ANON_KEY>"
--
-- 2) Вошедший видит только свои активации:
--      curl "<SUPABASE_URL>/rest/v1/promo_codes?select=code,course_id" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <USER_JWT>"
--
-- 3) Выпустить тестовый код вручную:
--      insert into public.promo_codes (code, course_id, batch)
--      values ('TRIDI-TEST-0001', 'confident', 'manual');
-- =============================================================================
