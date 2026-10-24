/**
 * Ошибки PostgREST «таблицы или колонки ещё нет».
 *
 * Миграции в проекте применяют вручную, поэтому таблица может отсутствовать в
 * живой базе. PostgREST отвечает 42P01 (relation does not exist), PGRST205
 * (таблица не найдена в схеме) или PGRST204 (колонки нет). Это не поломка
 * приложения, а сигнал «миграция ещё не применена»: отчёт и страницы должны
 * честно показать «нет данных», а не упасть с 500.
 *
 * Проверка общая для saved_projects, constructor_feedback, site_visits и
 * constructor_generations.
 */
export function isMissingTableSchema(
  code: string | null | undefined,
  message: string | null | undefined,
): boolean {
  if (code === "42P01" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }

  const text = (message ?? "").toLowerCase();

  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  );
}
