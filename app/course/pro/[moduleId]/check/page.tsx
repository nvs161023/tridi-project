import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleTest } from "@/components/course/ModuleTest";
import courseData from "@/data/course-pro.json";
import { resolveUserId } from "@/lib/current-user";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { createClient } from "@/lib/supabase/server";
import type { ProCourse, ProModule } from "@/lib/types";

/**
 * Страница «Проверь себя» продвинутого курса: тест по модулю —
 * /course/pro/<модуль>/check, например /course/pro/A/check.
 *
 * Тесты модулей живут здесь, а не в уроках: урок остаётся уроком, а проверка
 * знаний по модулю — отдельным шагом на 10 вопросов (вопросы пришли из мини-чеков
 * уроков плюс вопросы теста модуля). Доступ тот же, что и к урокам pro: нужен вход
 * и действующая подписка, поэтому страница повторяет проверки урока — middleware
 * гостя не пустит, но про подписку middleware не знает, её спрашиваем у базы.
 *
 * Тест обязателен: сданный результат сохраняется на сервере (см.
 * app/actions/complete-module-test.ts) отдельным типом курса "pro-test", и по нему
 * страница урока открывает следующий модуль. Проваленная попытка ничего не
 * сохраняет, поэтому закрытый модуль остаётся закрытым.
 *
 * Адрес /course/pro/<модуль>/check не конфликтует с уроком: статический сегмент
 * "check" выигрывает у динамического [lessonId], поэтому тест нельзя перепутать с
 * уроком с кодом "check".
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Из таблицы subscriptions читаем только то, что нужно для решения о доступе. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

const course: ProCourse = courseData;

/** Модули по module_order: навигация не должна зависеть от порядка в JSON. */
const modules: ProModule[] = [...course.modules].sort(
  (a, b) => a.module_order - b.module_order,
);

type ProCheckPageProps = {
  params: Promise<{ moduleId: string }>;
};

/**
 * Код модуля из адреса.
 *
 * Коды бывают с кириллицей (A-без, E-хим, T-тизер), поэтому раскодируем сегмент
 * сами — для обычных кодов это ничего не меняет.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Адрес страницы теста: код модуля кодируем, кириллица в адресе — процентная. */
function checkHref(moduleId: string): string {
  return `/course/pro/${encodeURIComponent(moduleId)}/check`;
}

/** Адрес урока продвинутого курса. */
function lessonHref(moduleId: string, lessonId: string): string {
  return `/course/pro/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`;
}

/**
 * Есть ли у пользователя доступ к продвинутому курсу.
 *
 * Доступ даёт либо активная подписка, либо незакончившийся пробный период.
 * Любая ошибка (строки нет, таблицы нет, сеть отвалилась) означает «доступа нет»:
 * сбой проверки не должен открывать платный контент.
 */
async function hasProSubscription(
  supabase: Supabase,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    console.warn("Не удалось проверить подписку:", error.message);
    return false;
  }

  if (!data) {
    return false;
  }

  if (data.status === "active") {
    return true;
  }

  return (
    data.status === "trial" &&
    data.trial_ends_at !== null &&
    new Date(data.trial_ends_at) > new Date()
  );
}

export async function generateMetadata({ params }: ProCheckPageProps) {
  const { moduleId } = await params;
  const courseModule = modules.find(
    (item) => item.module_id === normalizeSegment(moduleId),
  );

  return {
    title: courseModule
      ? `Проверь себя: ${courseModule.module_title} — продвинутый курс`
      : "Тест не найден — 3D-печать с нуля",
  };
}

function ModuleNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
          Ошибка 404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Тест не найден
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          Такого модуля нет или ссылка устарела. Вернитесь на главную — там
          программа продвинутого курса.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Вернуться на главную
          <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}

/**
 * Замок вместо теста: у пользователя нет действующей подписки.
 *
 * Тест модуля — часть платного курса, поэтому без доступа в HTML не попадает ни
 * один вопрос: браузер получает уже готовую разметку без теста.
 */
function LockedNotice({ refreshHref }: { refreshHref: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-violet-500/10 to-slate-900/80 p-7 text-center sm:p-10">
      <span aria-hidden className="relative text-4xl sm:text-5xl">
        🔒
      </span>

      <h2 className="relative mt-4 text-2xl font-extrabold text-white sm:text-3xl">
        Доступно в подписке Pro
      </h2>

      <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
        Тесты модулей входят в тариф Pro: {modules.length} тестов по 10 вопросов,
        и к каждому ответу — пояснение, почему он верен или не подходит.
      </p>

      <div className="relative mt-8">
        <Link
          href="/subscription"
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Открыть доступ — 1490 ₽/мес
          <span aria-hidden>→</span>
        </Link>
      </div>

      <p className="relative mt-6 text-sm text-slate-400">
        Уже есть подписка?{" "}
        {/* Обычная ссылка, а не <Link>: нужна полная перезагрузка, чтобы сервер
            заново сходил в базу и проверил подписку. Работает и без JavaScript. */}
        <a
          href={refreshHref}
          className="font-semibold text-amber-200 underline-offset-4 transition-colors hover:text-amber-100 hover:underline"
        >
          Обнови страницу
        </a>
      </p>
    </section>
  );
}

export default async function ProModuleCheckPage({ params }: ProCheckPageProps) {
  const { moduleId } = await params;
  const normalized = normalizeSegment(moduleId);
  const moduleIndex = modules.findIndex((item) => item.module_id === normalized);

  if (moduleIndex === -1) {
    return <ModuleNotFound />;
  }

  const courseModule = modules[moduleIndex];
  const currentHref = checkHref(courseModule.module_id);

  const supabase = await createClient();

  // Кто открыл страницу. Гостя сюда не пустит middleware, но проверку дублируем:
  // страница платная, и лишняя осторожность здесь дешевле открытого теста.
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(currentHref)}`);
  }

  // Главный вопрос страницы: есть ли действующая подписка у ЭТОГО пользователя.
  // Без неё в разметку не попадёт ни один вопрос теста.
  const hasAccess = await hasProSubscription(supabase, userId);

  const firstLesson = courseModule.lessons[0];
  const lessonsHref = firstLesson
    ? lessonHref(courseModule.module_id, firstLesson.lesson_id)
    : "/";

  // Сдал тест — открывается следующий модуль: ведём на его первый урок. У
  // последнего модуля следующего нет, поэтому там путь в конструктор.
  const nextModule = modules[moduleIndex + 1];
  const nextModuleLesson = nextModule?.lessons[0];
  const nextLessonHref = nextModuleLesson
    ? lessonHref(nextModule.module_id, nextModuleLesson.lesson_id)
    : "/constructor";

  const questions = courseModule.module_test?.questions ?? [];
  const lessonCount = courseModule.lessons.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href={lessonsHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            К урокам модуля
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Назад к курсу
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
          Проверь себя · модуль {courseModule.module_order}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {courseModule.module_title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          {courseModule.module_description} {questions.length} вопросов по{" "}
          {lessonCount} {pluralize(lessonCount, LESSON_FORMS)} модуля: отвечай по
          одному, правильность видно сразу. Тест обязателен — он открывает
          следующий модуль.
        </p>

        <div className="mt-10 sm:mt-12">
          {hasAccess ? (
            <ModuleTest
              courseType="pro"
              moduleNumber={courseModule.module_order}
              moduleLabel={courseModule.module_title}
              lessonsHref={lessonsHref}
              nextLessonHref={nextLessonHref}
              questions={questions}
            />
          ) : (
            <LockedNotice refreshHref={currentHref} />
          )}
        </div>
      </main>
    </div>
  );
}
