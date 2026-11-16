-- =============================================================================
-- Пожизненный доступ Pro для уже купленных пакетов `pro` (grandfathering)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor (проект wxzwyirrqophfnltsapj). Автоматически не выполняется.
--
-- Зачем таблица:
--   1. пакет `pro` больше не продаётся: новые покупки невозможны, а у тех, кто
--      уже заплатил 9 900 ₽, доступ к инструментам должен остаться навсегда;
--   2. `hasActiveSubscription` читает эту таблицу первой: строка здесь — явный
--      пожизненный грант, а не случайный `active` с пустым `expires_at`;
--   3. без строки покупка `pro` открывает только три курса: Конструктор,
--      Профили, Мастерская и месячные генерации требуют `pro-subscription` или
--      будущий entitlement.
--
-- Кого переносим:
--   всех, у кого есть действующая покупка `pro` (`expires_at is null` или дата
--   в будущем). Возвращённая покупка закрыта датой возврата и сюда не попадает:
--   иначе refund снова открыл бы инструменты через legacy-грант.
--
-- Структура:
--   user_id    uuid        primary key — покупатель
--   granted_at timestamptz not null — когда купил пакет (самая ранняя покупка)
--   reason     text        not null — почему выдан пожизненный доступ
--
-- Проверить после применения:
--   select user_id, granted_at, reason
--     from public.legacy_pro_users
--    order by granted_at;
--   select count(*) from public.legacy_pro_users;
-- =============================================================================

create table if not exists public.legacy_pro_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  reason text not null default 'Пакет «Всё включено» куплен до остановки продаж'
);

-- Свежие гранты первыми: по этому индексу читается отчёт «кто получил legacy».
create index if not exists legacy_pro_users_granted_at_idx
  on public.legacy_pro_users (granted_at desc);

-- Перенос текущих покупателей. distinct по user_id: повторные/подарочные
-- покупки не создают вторую строку. min(created_at) — дата первого пакета.
insert into public.legacy_pro_users (user_id, granted_at, reason)
select
  p.user_id,
  min(p.created_at),
  'Пакет «Всё включено» куплен до остановки продаж'
from public.purchases p
where p.course_id = 'pro'
  and (p.expires_at is null or p.expires_at > now())
group by p.user_id
on conflict (user_id) do nothing;

-- Пользователь читает только свой грант: это не секрет, но и не повод отдавать
-- список всех пожизненных покупателей anon-ключу. Пишет только service_role.
alter table public.legacy_pro_users enable row level security;

drop policy if exists "legacy_pro_users_select_own" on public.legacy_pro_users;

create policy "legacy_pro_users_select_own" on public.legacy_pro_users
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.legacy_pro_users from public, anon, authenticated;
grant select on public.legacy_pro_users to authenticated;
grant all on public.legacy_pro_users to service_role;

-- PostgREST кэширует схему: после создания таблицы просим перечитать её,
-- иначе lib/subscription.ts получит PGRST205 и включит fallback на старую логику.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Кто получил пожизненный доступ (это и есть отчёт по grandfathering):
--      select user_id, granted_at, reason
--        from public.legacy_pro_users
--       order by granted_at;
--
-- 2) У каждого legacy-пользователя есть действующая покупка `pro`:
--      select l.user_id
--        from public.legacy_pro_users l
--        left join public.purchases p
--          on p.user_id = l.user_id
--         and p.course_id = 'pro'
--         and (p.expires_at is null or p.expires_at > now())
--       where p.id is null;
--
-- 3) anon не читает таблицу (должен получить 401/403):
--      curl "<SUPABASE_URL>/rest/v1/legacy_pro_users?select=user_id&limit=1" \
--        -H "apikey: <ANON_KEY>"
--
-- 4) Выдать доступ вручную (например, компенсация):
--      insert into public.legacy_pro_users (user_id, reason)
--      values ('<UUID>', 'Ручная выдача владельца')
--      on conflict (user_id) do nothing;
--
-- 5) Снять доступ вручную:
--      delete from public.legacy_pro_users where user_id = '<UUID>';
-- =============================================================================
