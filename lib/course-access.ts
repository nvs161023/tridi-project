import { resolveUserId } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Правила доступа к платным уровням.
 *
 * Здесь два правила, которые нужны сразу нескольким страницам:
 *
 * 1. Первые PREVIEW_LESSONS урока уровня открыты без покупки — это превью, по
 *    которому человек решает, нужен ли ему уровень. Остальные уроки закрыты:
 *    видно только первые PREVIEW_BLOCKS блока и карточку с тарифами.
 * 2. Тест модуля открывается только после того, как прочитаны все уроки модуля,
 *    кроме последнего: тест стоит в конце модуля и сам закрывает последний урок.
 *
 * Порядок уроков хранится в lesson_progress (по строке на пройденный урок), а
 * номера уроков — сквозные для уровня, поэтому SET номеров и сравнивается с
 * lessonNumber уроков модуля.
 */

/** Сколько первых уроков уровня открыто без покупки. */
export const PREVIEW_LESSONS = 2;

/** Сколько блоков закрытого урока показываем как превью. */
export const PREVIEW_BLOCKS = 2;

/** Урок модуля в том виде, в каком он нужен проверке «все ли прочитаны». */
export type ModuleLessonRef = {
  /** Код урока: C1…C12 у «Уверенного», E1… у «Инженера», P1… у «Заработка». */
  lessonId: string;
  /** Сквозной номер урока — он же lesson_id в lesson_progress. */
  lessonNumber: number;
  title: string;
};

/**
 * Номера прочитанных уроков уровня.
 *
 * В lesson_progress попадает строка только после отметки «Пройти урок» (см.
 * app/actions/complete-lesson.ts), поэтому наличие номера = урок прочитан.
 *
 * courseType — тип курса в базе: "basic", "confident", "engineer" или "profit".
 * Тесты модулей лежат с другими типами ("basic-test", "confident-test"…), так
 * что в этот набор не попадают.
 *
 * null означает «прочитать не удалось» (нет пользователя, нет сети, нет
 * таблицы). Вызывающий код в этом случае тест не запирает: сбой чтения не
 * должен превращаться в «сначала прочитай уроки».
 */
export async function loadCompletedLessonNumbers(
  courseType: string,
): Promise<Set<number> | null> {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("course_type", courseType);

  if (error) {
    console.warn("Не удалось прочитать прогресс уроков:", error.message);
    return null;
  }

  return new Set((data ?? []).map((row) => Number(row.lesson_id)));
}

/**
 * Уроки модуля, которые ещё не отмечены пройденными.
 *
 * На вход приходят уроки модуля без последнего: тест стоит в конце модуля, и
 * последний урок отмечается уже вместе с переходом после теста (см.
 * components/course/ModuleTestGate.tsx). Иначе тест запирал бы сам себя.
 *
 * completed === null — прогресс прочитать не удалось, поэтому ничего не
 * запираем и возвращаем пустой список.
 */
export function unreadModuleLessons(
  moduleLessons: readonly ModuleLessonRef[],
  completed: Set<number> | null,
): ModuleLessonRef[] {
  if (completed === null) {
    return [];
  }

  return moduleLessons.filter((lesson) => !completed.has(lesson.lessonNumber));
}
