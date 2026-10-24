/**
 * Журнал успешных генераций STL для ежедневного отчёта.
 *
 * Пишется после сборки файла, но до ответа: serverless-функцию могут заморозить
 * сразу после отправки ответа, и `void promise` потерялся бы. Ошибка записи не
 * мешает экспорту — в отличие от constructor_downloads, это аналитика, а не
 * лимит, поэтому файл всё равно уходит пользователю.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/** Записывает тип сгенерированной модели; никогда не бросает исключение. */
export async function recordConstructorGeneration(
  userId: string,
  modelType: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("constructor_generations").insert({
      user_id: userId,
      model_type: modelType.slice(0, 64),
    });

    if (error && !isMissingTableSchema(error.code, error.message)) {
      console.error(
        "[generations] Не удалось записать генерацию:",
        error.message,
      );
    }
  } catch (error) {
    console.error(
      "[generations] Не удалось записать генерацию:",
      error instanceof Error ? error.message : error,
    );
  }
}
