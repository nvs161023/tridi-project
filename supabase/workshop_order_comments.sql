-- =============================================================================
-- Мастерская: комментарии к заказам
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: сначала supabase/workshop_printers_orders.sql — этот файл
-- ссылается на workshop_orders. Если её ещё нет, create table упадёт с ошибкой
-- 42P01, это ожидаемо.
--
-- Зачем таблица:
--   Комментарии — переписка мастера по заказу: «клиент просит синий пластик»,
--   «позвонил, забирает в субботу». Они живут отдельными строками, а не в
--   notes заказа: notes — описание работы, а комментарии копятся с датами и
--   читаются лентой в карточке заказа.
--
-- Почему on delete cascade у order_id:
--   Удалили заказ — пропала и его переписка. Отдельно чистить комментарии не
--   нужно, а «сирот» с несуществующим заказом в базе не остаётся.
--
-- Предел текста 1000 символов повторяет ORDER_COMMENT_TEXT_LIMIT из
-- lib/workshop/orders.ts: окно не даст ввести больше, а база не пропустит
-- запрос в обход окна. btrim не даёт сохранить комментарий из одних пробелов.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'workshop_order_comments'
--    order by ordinal_position;
--   select policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and tablename = 'workshop_order_comments'
--    order by policyname;
-- =============================================================================

create table if not exists public.workshop_order_comments (
  id uuid primary key default gen_random_uuid(),
  -- Заказ, к которому относится сообщение. Удаление заказа удаляет переписку.
  order_id uuid not null
    references public.workshop_orders (id) on delete cascade,
  -- Автор комментария: RLS показывает строку только её владельцу.
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null
    check (char_length(btrim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Лента заказа: RLS добавляет условие user_id, сортировка идёт по created_at.
create index if not exists workshop_order_comments_order_created_idx
  on public.workshop_order_comments (user_id, order_id, created_at);

alter table public.workshop_order_comments enable row level security;

drop policy if exists "workshop_order_comments_select_own"
  on public.workshop_order_comments;
create policy "workshop_order_comments_select_own"
  on public.workshop_order_comments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_order_comments_insert_own"
  on public.workshop_order_comments;
create policy "workshop_order_comments_insert_own"
  on public.workshop_order_comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_order_comments_update_own"
  on public.workshop_order_comments;
create policy "workshop_order_comments_update_own"
  on public.workshop_order_comments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workshop_order_comments_delete_own"
  on public.workshop_order_comments;
create policy "workshop_order_comments_delete_own"
  on public.workshop_order_comments
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты такие же, как у заказов: select/insert/update/delete своих строк.
-- Чужой order_id RLS не отсекает (проверяется только user_id), поэтому
-- принадлежность заказа проверяет Server Action перед вставкой.
revoke all on public.workshop_order_comments from anon, authenticated;
grant select, insert, update, delete
  on public.workshop_order_comments to authenticated;
grant all on public.workshop_order_comments to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Комментарии видны только владельцу и идут от старых к новым:
--      select id, order_id, text, created_at
--        from public.workshop_order_comments
--       where order_id = '<ORDER_ID>'
--         and user_id = '<USER_ID>'
--       order by created_at asc;
--
-- 2) Пустой комментарий база не принимает:
--      insert into public.workshop_order_comments (order_id, user_id, text)
--      values ('<ORDER_ID>', '<USER_ID>', '   ');
--    Ответ: ошибка check-ограничения.
--
-- 3) Удаление заказа удаляет его комментарии:
--      delete from public.workshop_orders where id = '<ORDER_ID>';
--      select count(*) from public.workshop_order_comments
--       where order_id = '<ORDER_ID>';  -- 0
-- =============================================================================
