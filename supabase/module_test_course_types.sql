-- Модульные тесты пишут course_type = 'basic-test' / 'pro-test'.
-- Constraint в живой базе этого не разрешал (принимались только 'basic' и 'pro'),
-- поэтому результат теста падал с ошибкой 23514, строка в lesson_progress не
-- появлялась, и следующий модуль оставался закрытым: «Сначала пройди тест модуля».
-- Файл фиксирует корректное определение для новых окружений.
--
-- В supabase/grants_and_policies.sql и supabase/pro_course_access.sql этого
-- ограничения нет — оно осталось в живой базе с тех пор, когда course_type
-- принимал только два значения.
--
-- Проверить, что применилось:
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'lesson_progress_course_type_check';

ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_course_type_check;

ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_course_type_check
  CHECK (course_type IN ('basic', 'pro', 'basic-test', 'pro-test'));
