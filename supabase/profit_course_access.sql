-- Типы записей уровня «Заработок» в lesson_progress.
--
-- Constraint на course_type в живой базе разрешает 'basic', 'pro', 'confident',
-- 'engineer', 'basic-test', 'pro-test', 'confident-test' и 'engineer-test'
-- (см. supabase/engineer_course_access.sql), поэтому уроки «Заработка»
-- ('profit') и его тесты модулей ('profit-test') падали бы с ошибкой 23514:
-- прогресс урока не сохранялся, а несданный тест держал бы Z5 (первый урок
-- модуля 2) закрытым.
--
-- Применяется вручную: Supabase → SQL Editor. Автоматически этот файл не
-- выполняется (как и остальные файлы в supabase/).
--
-- Важно: пока ограничение не расширено, страницы уровня работают (кнопка
-- «Пройти урок» всё равно ведёт дальше), но записи в lesson_progress не
-- появляются — см. components/course/CompleteButton.tsx.
--
-- Проверить, что применилось:
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'lesson_progress_course_type_check';

ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_course_type_check;

ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_course_type_check
  CHECK (
    course_type IN (
      'basic',
      'pro',
      'confident',
      'engineer',
      'profit',
      'basic-test',
      'pro-test',
      'confident-test',
      'engineer-test',
      'profit-test'
    )
  );
