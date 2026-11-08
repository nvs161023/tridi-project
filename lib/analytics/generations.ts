/**
 * Журнал успешных генераций STL для ежедневного отчёта.
 *
 * Пишется после сборки файла, но до ответа: serverless-функцию могут заморозить
 * сразу после отправки ответа, и `void promise` потерялся бы. Ошибка записи не
 * мешает экспорту — в отличие от constructor_downloads, это аналитика, а не
 * лимит, поэтому файл всё равно уходит пользователю.
 *
 * Подробности (`details`) необязательны: их присылают только те модели, у
 * которых есть что записать. Колонка добавлена отдельным SQL, поэтому старую
 * базу без неё запись не ломает — строка повторяется без подробностей.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingColumnSchema,
  isMissingTableSchema,
} from "@/lib/supabase/schema-errors";

/**
 * Значение одного поля подробностей.
 *
 * Скаляры и — как единственное исключение — массив скаляров: композиция узора
 * приходит списком слоёв. Вложенные объекты запрещены так же, как раньше:
 * `Record<string, unknown>` превратил бы колонку в дерево, которое в SQL не
 * сгруппировать. Массив читается тем же `->` (JSON), а не `->>`.
 */
export type ConstructorGenerationDetailValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[];

/**
 * Подробности генерации: плоский набор нормализованных параметров модели.
 *
 * Вложенность запрещена намеренно — такие значения группируются в SQL одним
 * `->>` и читаются глазами в дашборде. Массив слоёв узора — единственное
 * исключение: там каждый элемент сам по себе строка, и раскладывать её по
 * отдельным ключам (`patterns0`, `patterns1`) значило бы зашить число слоёв в
 * схему.
 */
export type ConstructorGenerationDetails = Record<
  string,
  ConstructorGenerationDetailValue
>;

/** Записывает тип сгенерированной модели; никогда не бросает исключение. */
export async function recordConstructorGeneration(
  userId: string,
  modelType: string,
  details?: ConstructorGenerationDetails,
): Promise<void> {
  const row = { user_id: userId, model_type: modelType.slice(0, 64) };
  const payload: Record<string, unknown> = details
    ? { ...row, details }
    : row;

  try {
    const admin = createAdminClient();
    const first = await admin
      .from("constructor_generations")
      .insert(payload);

    if (!first.error) {
      return;
    }

    // Колонку details добавляют вручную, поэтому живая база может быть на
    // schema-шаге назад. Журнал должен пополняться и без подробностей: терять
    // всю строку из-за необязательного поля нельзя.
    if (
      details &&
      isMissingColumnSchema(first.error.code, first.error.message, "details")
    ) {
      const retry = await admin
        .from("constructor_generations")
        .insert(row);

      if (
        retry.error &&
        !isMissingTableSchema(retry.error.code, retry.error.message)
      ) {
        console.error(
          "[generations] Не удалось записать генерацию:",
          retry.error.message,
        );
      }

      return;
    }

    if (!isMissingTableSchema(first.error.code, first.error.message)) {
      console.error(
        "[generations] Не удалось записать генерацию:",
        first.error.message,
      );
    }
  } catch (error) {
    console.error(
      "[generations] Не удалось записать генерацию:",
      error instanceof Error ? error.message : error,
    );
  }
}
