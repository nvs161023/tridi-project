-- =============================================================================
-- Кредиты генераций 3D-моделей (Gen API / Trellis 2)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. одна строка на пользователя хранит остаток кредитов;
--   2. кредит списывает сервер (`lib/credits.ts`, service_role) только после
--      успешной генерации — неудачная попытка баланс не меняет;
--   3. клиентским ролям запись запрещена: иначе баланс можно пополнить из
--      браузера.
--
-- Новому пользователю строку создаёт покупка пакета генераций (или админ):
--   insert into public.user_credits (user_id, credits)
--   values ('<UUID>', 10)
--   on conflict (user_id) do update set credits = user_credits.credits + 10;
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_credits';
--   select user_id, credits, updated_at from public.user_credits;
-- =============================================================================

create table if not exists public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

-- Row Level Security: пользователь видит только свой остаток. Записывать его
-- может только service_role из API, поэтому политик insert/update/delete для
-- authenticated намеренно нет.
alter table public.user_credits enable row level security;

drop policy if exists "user_credits_select_own" on public.user_credits;

create policy "user_credits_select_own"
  on public.user_credits
  for select to authenticated using (auth.uid() = user_id);

-- Явно убираем права на запись у клиентских ролей: даже при будущей политике
-- INSERT баланс не должен пополняться из браузера.
revoke all on public.user_credits from anon, authenticated;
grant select on public.user_credits to authenticated;
grant all on public.user_credits to service_role;
-- =============================================================================
