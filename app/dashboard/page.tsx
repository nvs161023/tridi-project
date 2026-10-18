import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { basicLessons } from "@/lib/basic-course";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

const totalLessons = basicLessons.length;

/**
 * Уроки, которые существуют в текущей программе.
 *
 * В lesson_progress могли остаться старые записи: удалённые уроки, дубли или
 * строки продвинутого курса с теми же номерами. Считаем только уникальные
 * lesson_id, которые есть в basicLessons, иначе прогресс переваливает за 100%.
 */
const validLessonIds = new Set(basicLessons.map((lesson) => lesson.id));

export default async function DashboardPage() {
  // Пользователя проверил middleware — одним сетевым getUser() на весь запрос.
  // Здесь только читаем то, что он передал: второй getUser() был бы лишним
  // кругом до Supabase (десятки-сотни миллисекунд на каждом переходе).
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (!identity) {
    // Страховка: сюда попадаем, только если запрос прошёл мимо middleware.
    redirect("/auth/login");
  }

  // Дальше работаем с id: внутри вложенной функции TypeScript уже не помнит, что
  // identity проверен выше.
  const userId = identity.id;

  const supabase = await createClient();

  /**
   * Прогресс по одному курсу.
   *
   * /dashboard показывает базовый курс, поэтому фильтруем по course_type: урок №1
   * есть и в базовом, и в продвинутом, и без фильтра строки двух курсов
   * складывались бы — «пройдено» могло перевалить за число уроков курса.
   */
  async function loadProgress(courseType: string) {
    return supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("course_type", courseType);
  }

  // Профиль и прогресс друг от друга не зависят, поэтому забираем их
  // параллельно: вместо двух кругов до Supabase получается один.
  const [profileResult, progressResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", identity.id).single(),
    loadProgress("basic"),
  ]);

  const profile = (profileResult.data as Profile | null) ?? null;

  // Страховка для баз без колонки course_type (миграция
  // supabase/pro_course_access.sql применяется вручную): запрос к колонке падает,
  // и тогда читаем прогресс как раньше — без фильтра, а не показываем ноль.
  const progress = progressResult.error
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", identity.id)
    : progressResult;

  // Часть данных могла не загрузиться — покажем то, что есть, и предупредим.
  const hasDataError = Boolean(profileResult.error || progress.error);

  const displayName =
    profile?.name?.trim() || identity.name?.trim() || identity.email || "друг";

  // Set отбрасывает дубли, а validLessonIds — записи удалённых уроков и чужих
  // курсов. Так «пройдено» не может быть больше числа уроков программы.
  const completedLessons = new Set(
    (progress.data ?? [])
      .map((row) => Number(row.lesson_id))
      .filter(
        (lessonId) =>
          Number.isFinite(lessonId) && validLessonIds.has(lessonId),
      ),
  ).size;

  // Даже если база вернула больше строк, чем уроков, показываем честные 100%.
  const shownCompletedLessons = Math.min(completedLessons, totalLessons);
  const isCourseCompleted = totalLessons > 0 && completedLessons >= totalLessons;
  const progressPercent =
    totalLessons === 0
      ? 0
      : Math.min(100, Math.round((completedLessons / totalLessons) * 100));

  async function logout() {
    "use server";

    const serverSupabase = await createClient();
    await serverSupabase.auth.signOut();
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Logo lessonsHref="/dashboard" showBadges={false} />

          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>↪</span>
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Личный кабинет
        </h1>
        <p className="mt-4 text-xl font-semibold text-blue-300 sm:text-2xl">
          Привет, {displayName}!
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          Здесь видно, как продвигается курс. Прогресс сохраняется за аккаунтом,
          поэтому можно продолжать с любого устройства.
        </p>

        {hasDataError ? (
          <p className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Часть данных не загрузилась — показываем
            то, что удалось получить.
          </p>
        ) : null}

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Твой прогресс
            </h2>
            <span className="text-sm font-semibold text-blue-300">
              {progressPercent}%
            </span>
          </div>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Ты прошёл {shownCompletedLessons} из {totalLessons} уроков
          </p>

          <div
            role="progressbar"
            aria-label="Прогресс курса"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {isCourseCompleted ? (
            <p className="mt-6 rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-4 text-center text-lg font-bold text-white sm:text-xl">
              <span aria-hidden>🎉</span> Курс пройден!
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {completedLessons === 0
                ? "Пройди первый урок — и полоска начнёт заполняться."
                : "Так держать! Продолжай в своём темпе."}
            </p>
          )}
        </section>

        {/* Два следующих шага: продолжить обучение или открыть Pro-инструменты */}
        <div className="mt-10 grid items-start gap-4 sm:mt-12 sm:grid-cols-2">
          <Link
            href={isCourseCompleted ? "/constructor" : "/course/lesson-1"}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {isCourseCompleted ? "Перейти в конструктор" : "Продолжить курс"}
            <span aria-hidden>→</span>
          </Link>

          <Link
            href="/profiles"
            className="group flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-400/50 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-xl"
              >
                📦
              </span>
              <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-200 uppercase">
                Pro
              </span>
            </div>

            <h2 className="mt-4 text-lg font-bold text-white">
              Библиотека профилей
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Готовые профили принтеров, материалов и настроек для Bambu Studio,
              OrcaSlicer и PrusaSlicer.
            </p>

            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition-colors group-hover:text-blue-200">
              Открыть библиотеку
              <span aria-hidden>→</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
