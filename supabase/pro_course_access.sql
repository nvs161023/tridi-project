-- =============================================================================
-- Доступ к продвинутому курсу: прогресс по двум курсам и проверка подписки
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor (проект wxzwyirrqophfnltsapj). Автоматически не выполняется —
-- это документация того, что нужно поменять в базе.
--
-- Зачем это нужно:
--   1. колонка course_type в lesson_progress — урок №1 есть и в базовом курсе
--      (12 уроков), и в продвинутом (17 уроков), поэтому прогресс надо
--      разделять: /course/lesson-1 и /course/pro/lesson-1 — разные уроки;
--   2. уникальный индекс (user_id, course_type, lesson_id) — на него ссылается
--      upsert в app/actions/complete-lesson.ts
--      (onConflict: "user_id,course_type,lesson_id"). Без индекса Supabase
--      ответит ошибкой 42P10, и прогресс не сохранится;
--   3. таблица subscriptions уже настроена (см. grants_and_policies.sql) —
--      ниже только напоминание о статусах и примеры, как выдать доступ себе.
--
-- Проверить, что применилось:
--   select column_name from information_schema.columns
--    where table_name = 'lesson_progress';
--   select indexname from pg_indexes where tablename = 'lesson_progress';
-- =============================================================================

-- 1. Разделяем прогресс по курсам. У старых записей останется 'basic'.
alter table public.lesson_progress
  add column if not exists course_type text not null default 'basic';

-- 2. Новый уникальный ключ, который ожидает upsert.
create unique index if not exists lesson_progress_user_course_lesson_key
  on public.lesson_progress (user_id, course_type, lesson_id);

-- 3. Старый ключ по (user_id, lesson_id) больше не подходит и мешал бы писать
--    прогресс: урок 1 базового и урок 1 продвинутого — разные записи.
--    Имя ключа по умолчанию — lesson_progress_user_id_lesson_id_key; если у вас
--    оно другое, найдите его так:
--      select conname from pg_constraint
--       where conrelid = 'public.lesson_progress'::regclass and contype = 'u';
alter table public.lesson_progress
  drop constraint if exists lesson_progress_user_id_lesson_id_key;

-- 4. Права и RLS менять не нужно (см. grants_and_policies.sql): authenticated
--    видит и меняет только свои строки, anon доступа не имеет. Новая колонка
--    политик не требует — RLS работает по строкам, а не по колонкам.

-- =============================================================================
-- Как проверить замок на продвинутых уроках
-- =============================================================================
-- а) Заходим на сайт и регистрируемся (или входим). Ищем свой id:
--      select id, email from auth.users order by created_at desc limit 5;
--
-- б) Открываем /course/pro/lesson-1 без подписки — увидим превью (первые два
--    блока) и замок «Доступно в подписке Pro» с кнопкой на /subscription.
--
-- в) Выдаём себе доступ (SQL Editor работает с правами сервисной роли):
--      insert into public.subscriptions (user_id, status, trial_ends_at)
--      values ('<UUID пользователя>', 'trial', now() + interval '7 days');
--    Если строк на пользователя может быть больше одной, сначала удалите старые:
--      delete from public.subscriptions where user_id = '<UUID>';
--
-- г) Обновляем страницу — виден весь урок, появляются «← Предыдущий урок»,
--    «Пройти урок →», а на уроке 17 — блок «🏆 Полный курс пройден!».
--
-- д) Проверяем, что прогресс пишется раздельно по курсам:
--      select course_type, lesson_id, completed_at
--        from public.lesson_progress order by completed_at desc limit 10;
--
-- е) Статусы, которые понимает страница (app/course/pro/[id]/page.tsx):
--      'active' — доступ есть всегда;
--      'trial'  — доступ, пока trial_ends_at в будущем;
--      остальные ('inactive', 'canceled', 'past_due', ...) — доступа нет.
--
-- ж) Выключить доступ обратно:
--      update public.subscriptions
--         set status = 'canceled', trial_ends_at = null, updated_at = now()
--       where user_id = '<UUID>';
-- =============================================================================
