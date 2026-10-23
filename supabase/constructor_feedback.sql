-- =============================================================================
-- Обратная связь по Конструктору 3D после скачивания STL
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. после третьего скачивания STL (дальше — каждый десятый) конструктор
--      спрашивает оценку 1–5 и необязательный комментарий;
--   2. оценка приходит вместе с моделью, поэтому видно, какие генераторы
--      вызывают проблемы;
--   3. выбор пользователь закрывает окно — запись тогда не создаётся вовсе.
--
-- Модель доступа: писать и читать можно только свои строки. Сводку по оценкам
-- владелец смотрит service-role клиентом или в SQL Editor — публичного
-- представления, как у отзывов о курсах, здесь нет: это внутренняя метрика.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'constructor_feedback';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'constructor_feedback';
-- =============================================================================

create table if not exists public.constructor_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_type text not null,
  rating integer not null check (rating between 1 and 5),
  feedback_text text
    check (feedback_text is null or char_length(feedback_text) <= 1000),
  created_at timestamptz not null default now()
);

comment on table public.constructor_feedback is
  'Оценки Конструктора 3D после скачивания STL: 1–5 звёзд и необязательный комментарий.';

-- Сводка «оценки по модели за период» читается всё чаще всего.
create index if not exists constructor_feedback_created_idx
  on public.constructor_feedback (created_at desc);
create index if not exists constructor_feedback_model_created_idx
  on public.constructor_feedback (model_type, created_at desc);

alter table public.constructor_feedback enable row level security;

drop policy if exists "constructor_feedback_select_own"
  on public.constructor_feedback;
create policy "constructor_feedback_select_own"
  on public.constructor_feedback
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "constructor_feedback_insert_own"
  on public.constructor_feedback;
create policy "constructor_feedback_insert_own"
  on public.constructor_feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- Правки и удаление из браузера не нужны: оценка — это событие, а не документ.
revoke all on public.constructor_feedback from anon, authenticated;
grant select, insert on public.constructor_feedback to authenticated;
grant all on public.constructor_feedback to service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Средняя оценка по моделям за месяц:
--      select model_type,
--             round(avg(rating)::numeric, 2) as avg_rating,
--             count(*) as votes
--        from public.constructor_feedback
--       where created_at >= date_trunc('month', now())
--       group by model_type
--       order by avg_rating asc;
--
-- 2) Комментарии с низкой оценкой:
--      select created_at, model_type, rating, feedback_text
--        from public.constructor_feedback
--       where rating <= 3 and feedback_text is not null
--       order by created_at desc
--       limit 50;
-- =============================================================================
