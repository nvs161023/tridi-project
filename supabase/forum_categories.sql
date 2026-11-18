-- =============================================================================
-- Стартовые категории форума
-- =============================================================================
-- Справочная копия: примените файл вручную в Supabase Dashboard → SQL Editor
-- после `supabase/forum.sql`. Скрипт можно запускать повторно: конфликт по
-- `slug` обновляет название, описание и порядок, но не создаёт дубли.
--
-- Тот же набор лежит в `data/forum-seed-topics.mjs` — `npm run seed:forum`
-- умеет обновить категории через service_role. SQL нужен, когда удобнее
-- наполнить базу без запуска Node или когда service_role недоступен локально.
--
-- Проверка после применения:
--   select slug, title, "order" from public.forum_categories order by "order";
--   select count(*) from public.forum_categories; -- 5, если старые разделы были пусты
-- =============================================================================

-- Старый набор из семнадцати разделов заменяется пятью основными. Удаляем
-- только известные slug и только пустые категории: ON DELETE RESTRICT в
-- forum_threads и проверка not exists не дадут потерять темы, если раздел уже
-- используется. Категории, добавленные вручную позже, не затрагиваются.
delete from public.forum_categories
where slug in (
  'printers-bambu',
  'printers-prusa',
  'printers-creality',
  'printers-anycubic',
  'printers-diy',
  'materials-pla',
  'materials-abs',
  'materials-tpu',
  'materials-pa',
  'materials-pc',
  'problems-adhesion',
  'problems-layers',
  'problems-slicer',
  'problems-mechanics',
  'general-flood'
)
and not exists (
  select 1
  from public.forum_threads
  where forum_threads.category_id = forum_categories.id
);

insert into public.forum_categories (slug, title, description, "order")
values
  (
    'printers',
    'Принтеры',
    'Выбор первого FDM-принтера, сравнение моделей, апгрейды и обслуживание.',
    1
  ),
  (
    'materials',
    'Материалы',
    'PLA, PETG, ABS и TPU: свойства, сушка, хранение и совместимость.',
    2
  ),
  (
    'problems',
    'Проблемы печати',
    'Адгезия, стрингинг, смещение слоёв и другие дефекты: диагностика по шагам.',
    3
  ),
  (
    'general-business',
    'Бизнес и заказы',
    'Себестоимость, маркетплейсы, упаковка и продажи печатных изделий.',
    4
  ),
  (
    'general-modeling',
    'Моделирование',
    'Подготовка моделей к печати, допуски, зазоры и показ готовых работ.',
    5
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  "order" = excluded."order";

-- PostgREST кэширует схему и данные каталога. После ручного SQL обновляем
-- кэш, чтобы новые категории сразу появились в `/forum` и форме темы.
notify pgrst, 'reload schema';

-- Ожидаемый результат:
--   printers | Принтеры | 1
--   materials | Материалы | 2
--   problems | Проблемы печати | 3
--   general-business | Бизнес и заказы | 4
--   general-modeling | Моделирование | 5
