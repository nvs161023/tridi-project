import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleTest } from "@/components/course/ModuleTest";
import { basicLessons, findBasicModule } from "@/lib/basic-course";
import { resolveUserId } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Страница «Проверь себя»: тест по модулю базового курса — /course/check/1…6.
 *
 * Тесты модулей живут здесь, а не в уроках: урок остаётся уроком, а проверка
 * знаний по модулю — отдельным шагом на 10 вопросов. Доступ такой же, как к
 * урокам: middleware не пускает гостя, и страница дополнительно проверяет
 * пользователя, если запрос прошёл мимо middleware.
 *
 * Тест обязателен: сданный результат сохраняется на сервере (см.
 * app/actions/complete-module-test.ts), и по нему страница урока открывает
 * следующий модуль. Проваленная попытка ничего не сохраняет.
 */

type CheckPageProps = {
  params: Promise<{ moduleId: string }>;
};

/**
 * Код модуля из адреса.
 *
 * Next.js отдаёт сегмент уже раскодированным, но коды бывают с кириллицей —
 * раскодируем сами, чтобы разные коды обрабатывались одинаково.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: CheckPageProps) {
  const { moduleId } = await params;
  const courseModule = findBasicModule(normalizeSegment(moduleId));

  return {
    title: courseModule
      ? `Проверь себя: ${courseModule.label} — 3D-печать с нуля`
      : "Модуль не найден — 3D-печать с нуля",
  };
}

function ModuleNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Ошибка 404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Тест не найден
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          Такого модуля нет или ссылка устарела. Вернитесь на главную — там
          программа базового курса.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Вернуться на главную
          <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}

export default async function ModuleCheckPage({ params }: CheckPageProps) {
  const { moduleId } = await params;
  const courseModule = findBasicModule(normalizeSegment(moduleId));

  if (!courseModule) {
    return <ModuleNotFound />;
  }

  const supabase = await createClient();

  // Гостя сюда не пустит middleware, но проверку дублируем: так страница не
  // откроется, даже если запрос каким-то образом прошёл мимо прослойки.
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/course/check/${moduleId}`)}`,
    );
  }

  const firstLessonHref = `/course/lesson-${courseModule.lessonIds[0]}`;

  // Сдал тест — открывается следующий урок курса (у последнего модуля его нет).
  const lastLessonId = courseModule.lessonIds[courseModule.lessonIds.length - 1];
  const nextLesson = basicLessons.find((lesson) => lesson.id === lastLessonId + 1);
  const nextLessonHref = nextLesson ? `/course/lesson-${nextLesson.id}` : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href={firstLessonHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            К урокам модуля
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Назад к курсу
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Проверь себя
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {courseModule.label}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          {courseModule.description} {courseModule.questions.length} вопросов по
          урокам модуля: отвечай по одному, правильность видно сразу. Тест
          обязателен — он открывает следующий модуль.
        </p>

        <div className="mt-10 sm:mt-12">
          <ModuleTest
            courseType="basic"
            moduleNumber={Number(courseModule.moduleId)}
            moduleLabel={courseModule.label}
            lessonsHref={firstLessonHref}
            nextLessonHref={nextLessonHref}
            questions={courseModule.questions}
          />
        </div>
      </main>
    </div>
  );
}
