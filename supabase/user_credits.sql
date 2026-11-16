-- =============================================================================
-- Лимиты и токены генераций 3D-моделей
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Бизнес-модель:
--   1. зарегистрированный получает одну бесплатную генерацию Standard навсегда
--      (`free_standard_used`, лимит 1);
--   2. подписка Pro даёт 3 Standard и 1 Ultra в месяц (`monthly_*_used`,
--      сбрасываются при смене календарного месяца);
--   3. пакеты токенов покупаются отдельно и не сгорают (`standard_tokens`,
--      `ultra_tokens`).
--
-- Списывает и возвращает только сервер (`lib/credits.ts`, service_role):
-- лимит уменьшается до платного запроса и возвращается, если провайдер отказал.
-- Клиентским ролям запись запрещена, иначе баланс можно начислить из браузера.
--
-- Порядок списания задаёт `lib/generator/generation-credits.ts`:
--   Standard: месячный лимит подписки → бесплатная → токен;
--   Ultra:    месячный лимит подписки → токен (бесплатных Ultra нет).
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_credits'
--    order by ordinal_position;
--   select user_id, free_standard_used, monthly_standard_used,
--          monthly_ultra_used, last_monthly_reset, standard_tokens, ultra_tokens
--     from public.user_credits;
-- =============================================================================

create table if not exists public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  free_standard_used integer not null default 0 check (free_standard_used >= 0),
  monthly_standard_used integer not null default 0
    check (monthly_standard_used >= 0),
  monthly_ultra_used integer not null default 0
    check (monthly_ultra_used >= 0),
  last_monthly_reset timestamptz not null default now(),
  standard_tokens integer not null default 0 check (standard_tokens >= 0),
  ultra_tokens integer not null default 0 check (ultra_tokens >= 0),
  -- Легаси-колонка старой модели «один кредит на генерацию». Нужна только для
  -- переноса остатка ниже; новый код её не читает и не пишет.
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

-- Если таблица уже была создана старой версией, `create table if not exists` её
-- не изменит: новые колонки добавляем отдельно. `default now()` у
-- `last_monthly_reset` считает текущий месяц началом отсчёта — у старых строк
-- месячные счётчики всё равно нулевые.
alter table public.user_credits
  add column if not exists free_standard_used integer not null default 0
    check (free_standard_used >= 0),
  add column if not exists monthly_standard_used integer not null default 0
    check (monthly_standard_used >= 0),
  add column if not exists monthly_ultra_used integer not null default 0
    check (monthly_ultra_used >= 0),
  add column if not exists last_monthly_reset timestamptz not null default now(),
  add column if not exists standard_tokens integer not null default 0
    check (standard_tokens >= 0),
  add column if not exists ultra_tokens integer not null default 0
    check (ultra_tokens >= 0);

-- Перенос старого остатка: кредит работал как одна Standard-генерация, поэтому
-- становится Standard-токеном. `credits` обнуляем, чтобы повторный запуск файла
-- не начислил остаток дважды.
update public.user_credits
   set standard_tokens = standard_tokens + credits
 where credits > 0;

update public.user_credits
   set credits = 0
 where credits > 0;

-- Row Level Security: пользователь видит только свой баланс. Записывать его
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
-- История покупок пакетов токенов
-- =============================================================================
-- Нужна функции `credit_token_purchase` для идемпотентности: `inv_id` —
-- уникальный номер заказа Robokassa, поэтому повторное уведомление не начислит
-- пакет второй раз. Заодно это история покупок для поддержки.
-- =============================================================================

create table if not exists public.token_purchases (
  inv_id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('standard', 'ultra')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists token_purchases_user_idx
  on public.token_purchases (user_id, created_at desc);

alter table public.token_purchases enable row level security;

drop policy if exists "token_purchases_select_own" on public.token_purchases;

create policy "token_purchases_select_own"
  on public.token_purchases
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.token_purchases from anon, authenticated;
grant select on public.token_purchases to authenticated;
grant all on public.token_purchases to service_role;

-- =============================================================================
-- Начисление пакета токенов из вебхука Robokassa
-- =============================================================================
-- Функция вызывается только service_role (`/api/payments/robokassa/result`).
-- Возвращает true, если пакет начислен сейчас, и false, если этот InvId уже
-- обработан. Ошибку начисления вызывающий код превращает в 500: Robokassa
-- повторит уведомление, а покупка в `purchases` уже записана.
-- =============================================================================

create or replace function public.credit_token_purchase(
  p_inv_id bigint,
  p_user_id uuid,
  p_kind text,
  p_quantity integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean;
begin
  if p_kind not in ('standard', 'ultra') or p_quantity <= 0 then
    raise exception 'invalid token pack: kind=%, quantity=%', p_kind, p_quantity;
  end if;

  insert into public.token_purchases (inv_id, user_id, kind, quantity)
  values (p_inv_id, p_user_id, p_kind, p_quantity)
  on conflict (inv_id) do nothing
  returning true into v_inserted;

  -- Повторное уведомление: токены уже начислены.
  if v_inserted is not true then
    return false;
  end if;

  insert into public.user_credits (user_id, standard_tokens, ultra_tokens)
  values (
    p_user_id,
    case when p_kind = 'standard' then p_quantity else 0 end,
    case when p_kind = 'ultra' then p_quantity else 0 end
  )
  on conflict (user_id) do update
    set standard_tokens = public.user_credits.standard_tokens
          + case when p_kind = 'standard' then p_quantity else 0 end,
        ultra_tokens = public.user_credits.ultra_tokens
          + case when p_kind = 'ultra' then p_quantity else 0 end,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_token_purchase(bigint, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.credit_token_purchase(bigint, uuid, text, integer)
  to service_role;

-- PostgREST кэширует схему: после создания функции `admin.rpc(...)` должен
-- увидеть её без перезапуска проекта.
notify pgrst, 'reload schema';
