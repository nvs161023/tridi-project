import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CompleteButton } from "@/components/course/CompleteButton";
import { LessonBlocks } from "@/components/course/LessonBlocks";
import courseData from "@/data/course-pro.json";
import { LESSON_FORMS, formatHours, pluralize } from "@/lib/course-stats";
import type { ProCourse, ProLesson, ProModule } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Урок продвинутого курса: /course/pro/<модуль>/<урок> — например
 * /course/pro/A/A1, /course/pro/B/B1, /course/pro/T/T14.
 *
 * Чем эта страница отличается от базовой: доступ к содержимому решает ПОДПИСКА,
 * а не вход. Гостя сюда не пускает middleware (см. lib/supabase/middleware.ts) —
 * он уходит на вход и возвращается уже авторизованным. Авторизованному без
 * подписки страница показывает превью: заголовок, длительность и первые два
 * блока, а дальше — замок с предложением оформить Pro.
 *
 * Проверка подписки выполняется здесь, на сервере, под сессией пользователя:
 *   • подделать URL бесполезно — страница всё равно спрашивает базу про подписку
 *     именно этого пользователя;
 *   • RLS (см. supabase/grants_and_policies.sql) отдаёт только свою строку, так
 *     что ни подставить чужую подписку, ни подсмотреть её нельзя;
 *   • браузер о доступе ничего не решает: он получает уже готовую разметку, в
 *     которой платных блоков просто нет.
 *
 * Почему не middleware: middleware не знает, что за страница за ним стоит, и,
 * закрыв доступ по подписке, заодно закрыл бы и бесплатный курс. Плюс подписка
 * меняется прямо во время сессии (оформили, отменили, кончился триал) — её нужно
 * проверять на каждый запрос рядом с данными, а не один раз на входе.
 *
 * Прогресс. В lesson_progress.lesson_id — число, а у уроков нового курса коды
 * (A1, C1-1, T14). Поэтому в базу уходит СКВОЗНОЙ номер урока в курсе (1…N):
 * схему таблицы менять не нужно, а старые записи с course_type='pro' остаются
 * как есть. Этот же номер показывается в шапке: «Урок X из N».
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Из таблицы subscriptions читаем только то, что нужно для решения о доступе. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

const course: ProCourse = courseData;

/**
 * Модули по module_order, уроки внутри — по lesson_order: в файле курса порядок
 * уже такой, но сортировка делает навигацию «предыдущий/следующий» независимой
 * от того, как модули разложены в JSON.
 */
const modules: ProModule[] = [...course.modules]
  .sort((a, b) => a.module_order - b.module_order)
  .map((module) => ({
    ...module,
    lessons: [...module.lessons].sort((a, b) => a.lesson_order - b.lesson_order),
  }));

/** Урок вместе с модулем, в котором он лежит. */
type LessonPosition = {
  module: ProModule;
  lesson: ProLesson;
};

/** Все уроки курса по порядку — по этому списку идут «предыдущий/следующий». */
const positions: LessonPosition[] = modules.flatMap((module) =>
  module.lessons.map((lesson) => ({ module, lesson })),
);

const totalLessons = positions.length;
const totalHours = formatHours(positions.map((position) => position.lesson));

/** Сколько блоков урока показываем без подписки. */
const PREVIEW_BLOCKS = 2;

type ProLessonPageProps = {
  params: Promise<{ moduleId: string; lessonId: string }>;
};

/**
 * Код модуля или урока из адреса.
 *
 * Next.js отдаёт сегменты уже раскодированными, но коды курса бывают с
 * кириллицей (A-без, E-хим, T-тизер): лишний decodeURIComponent для обычных кодов
 * ничего не меняет, а урок с непривычным кодом не потеряется.
 */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Адрес урока. Коды кодируются: кириллица в адресе должна быть процентной. */
function lessonHref(moduleId: string, lessonId: string): string {
  return `/course/pro/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`;
}

/** Номер урока в списке курса или -1, если такого урока нет. */
function findPositionIndex(moduleId: string, lessonId: string): number {
  return positions.findIndex(
    (position) =>
      position.module.module_id === moduleId &&
      position.lesson.lesson_id === lessonId,
  );
}

export async function generateMetadata({ params }: ProLessonPageProps) {
  const { moduleId, lessonId } = await params;
  const index = findPositionIndex(
    normalizeSegment(moduleId),
    normalizeSegment(lessonId),
  );
  const lesson = index === -1 ? null : positions[index].lesson;

  return {
    title: lesson
      ? `${lesson.lesson_title} — продвинутый курс — 3D-печать с нуля`
      : "Урок не найден — 3D-печать с нуля",
  };
}

/**
 * Кто открыл страницу.
 *
 * middleware уже проверил сессию и передал пользователя заголовком, поэтому
 * берём готовое значение и НЕ вызываем getUser() второй раз — это экономит круг
 * до Supabase на каждом уроке (см. lib/supabase/user-headers.ts).
 *
 * Страховка: если заголовка нет (запрос прошёл мимо middleware), проверяем сессию
 * сами. Без этого страница могла бы открыться без проверки пользователя.
 */
async function resolveUserId(supabase: Supabase): Promise<string | null> {
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (identity) {
    return identity.id;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

/**
 * Есть ли у пользователя доступ к продвинутому курсу.
 *
 * Доступ даёт либо активная подписка, либо незакончившийся пробный период.
 * Любая ошибка (строки нет, таблицы нет, сеть отвалилась) означает «доступа
 * нет»: сбой проверки не должен открывать платный контент.
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

function LessonNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
          Ошибка 404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Урок не найден
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          Такого урока нет или ссылка устарела. Вернитесь на главную — там
          программа продвинутого курса из {totalLessons}{" "}
          {pluralize(totalLessons, LESSON_FORMS)}.
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

/**
 * Замок вместо продолжения урока.
 *
 * Показываем его, когда подписки нет: дальше превью ничего не рендерится — в HTML
 * платного содержимого нет, поэтому «посмотреть исходник страницы» ничего не даёт.
 */
function LockedNotice({ refreshHref }: { refreshHref: string }) {
  return (
    <section className="relative mt-12 overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-violet-500/10 to-slate-900/80 p-7 text-center sm:mt-16 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
      />

      <span aria-hidden className="relative text-4xl sm:text-5xl">
        🔒
      </span>

      <h2 className="relative mt-4 text-2xl font-extrabold text-white sm:text-3xl">
        Доступно в подписке Pro
      </h2>

      <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
        Продвинутый курс входит в тариф Pro: {totalLessons}{" "}
        {pluralize(totalLessons, LESSON_FORMS)}, {totalHours}, визуализации к
        каждому блоку и практика после урока.
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

export default async function ProLessonPage({ params }: ProLessonPageProps) {
  const { moduleId, lessonId } = await params;

  const index = findPositionIndex(
    normalizeSegment(moduleId),
    normalizeSegment(lessonId),
  );

  if (index === -1) {
    return <LessonNotFound />;
  }

  const { module: currentModule, lesson } = positions[index];

  // Сквозной номер урока: он же lesson_id в lesson_progress и «Урок X из N».
  const lessonNumber = index + 1;
  const previous = index > 0 ? positions[index - 1] : null;
  const next = index + 1 < totalLessons ? positions[index + 1] : null;
  const isLastLesson = next === null;
  const nextHref = next
    ? lessonHref(next.module.module_id, next.lesson.lesson_id)
    : "/constructor";
  const progressPercent = Math.round((lessonNumber / totalLessons) * 100);
  const currentHref = lessonHref(currentModule.module_id, lesson.lesson_id);

  const supabase = await createClient();

  // Кто открыл страницу. Гостя сюда не пустит middleware, но проверку дублируем:
  // страница платная, и лишняя осторожность здесь дешевле открытого содержимого.
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(currentHref)}`);
  }

  // Главный вопрос страницы: есть ли действующая подписка у ЭТОГО пользователя.
  // От ответа зависит, какие блоки урока вообще попадут в HTML.
  const hasAccess = await hasProSubscription(supabase, userId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>←</span>
              {hasAccess ? "Назад к курсу" : "Назад на главную"}
            </Link>
            {hasAccess && previous ? (
              <Link
                href={lessonHref(
                  previous.module.module_id,
                  previous.lesson.lesson_id,
                )}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>←</span>
                Предыдущий
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 sm:text-sm">
              <span>
                Урок {lessonNumber} из {totalLessons}
              </span>
              {hasAccess ? (
                <span className="text-amber-300">{progressPercent}%</span>
              ) : null}
            </div>
            {/* Без подписки полоска остаётся серой и пустой: прогресс по закрытому
                курсу не показываем, чтобы не намекать на недоступное. */}
            <div
              role="progressbar"
              aria-label="Прогресс продвинутого курса"
              aria-valuenow={hasAccess ? progressPercent : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  hasAccess
                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : "bg-white/20"
                }`}
                style={{ width: hasAccess ? `${progressPercent}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
          Модуль {currentModule.module_id} · {currentModule.module_title}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {lesson.lesson_title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-4 py-1.5 text-xs font-semibold text-amber-200 sm:text-sm">
            <span aria-hidden>⭐</span>
            Продвинутый курс
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {lesson.duration}
          </span>
          <span className="text-sm text-slate-400">
            Урок {lessonNumber} из {totalLessons}
          </span>
        </div>

        {/* Без подписки в разметку попадают только первые блоки урока, остальное
            остаётся на сервере — «посмотреть код страницы» не поможет. */}
        <LessonBlocks
          blocks={
            hasAccess ? lesson.blocks : lesson.blocks.slice(0, PREVIEW_BLOCKS)
          }
          courseType="pro"
          moduleId={currentModule.module_id}
          lessonId={lesson.lesson_id}
        />

        {hasAccess ? (
          <div className="mt-12 sm:mt-16">
            {isLastLesson ? (
              <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-slate-900/70 to-slate-900/80 p-7 text-center sm:p-9">
                <p className="text-2xl font-extrabold text-white sm:text-3xl">
                  <span aria-hidden>🏆</span> Полный курс пройден!
                </p>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Позади все {totalLessons}{" "}
                  {pluralize(totalLessons, LESSON_FORMS)} продвинутого уровня:
                  безопасность, устройство принтера, материалы, слайсеры, ремонт,
                  инженерные расчёты и заработок на печати. Дальше — практика в
                  конструкторе.
                </p>
                <div className="mt-8">
                  <CompleteButton
                    lessonId={lessonNumber}
                    courseType="pro"
                    href="/constructor"
                    label="Перейти в конструктор"
                  />
                </div>
              </div>
            ) : (
              <CompleteButton
                lessonId={lessonNumber}
                courseType="pro"
                href={nextHref}
                label="Пройти урок"
              />
            )}
          </div>
        ) : (
          <LockedNotice refreshHref={currentHref} />
        )}
      </main>
    </div>
  );
}
