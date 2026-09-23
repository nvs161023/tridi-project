import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CompleteButton } from "@/components/course/CompleteButton";
import {
  LessonBlocks,
  type LessonBlock,
} from "@/components/course/LessonBlocks";
import proLessonsData from "@/data/lessons-pro.json";
import { LESSON_FORMS, formatHours, pluralize } from "@/lib/course-stats";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Урок продвинутого курса: /course/pro/lesson-N.
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
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ProLesson = {
  id: number;
  title: string;
  duration: string;
  module: string;
  blocks: LessonBlock[];
};

/** Из таблицы subscriptions читаем только то, что нужно для решения о доступе. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

const lessons: ProLesson[] = proLessonsData;
const totalLessons = lessons.length;

/** Сколько блоков урока показываем без подписки. */
const PREVIEW_BLOCKS = 2;

type ProLessonPageProps = {
  params: Promise<{ id: string }>;
};

function parseLessonId(rawId: string): number | null {
  const match = rawId.match(/\d+/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}

function lessonHref(id: number): string {
  return `/course/pro/lesson-${id}`;
}

export async function generateMetadata({ params }: ProLessonPageProps) {
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  return {
    title: lesson
      ? `${lesson.title} — продвинутый курс — 3D-печать с нуля`
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


/** Заглушка вместо содержимого: блоки продвинутых уроков ещё наполняются. */
function ComingSoonBlock() {
  return (
    <section className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-7 sm:mt-16 sm:p-9">
      <p className="text-lg font-bold text-white sm:text-xl">
        <span aria-hidden>📝</span> Материал урока готовится
      </p>
      <p className="mt-3 text-base leading-relaxed text-slate-400">
        Скоро здесь появятся разбор, схемы и практическое задание. Программа
        курса уже собрана — уроки открываются по мере публикации.
      </p>
    </section>
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
          программа продвинутого курса из {totalLessons} уроков.
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
        Продвинутый курс входит в тариф Pro. {totalLessons}{" "}
        {pluralize(totalLessons, LESSON_FORMS)}, {formatHours(proLessonsData)},
        все материалы, тонкая калибровка, работа с любыми материалами.
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
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  if (!lesson) {
    return <LessonNotFound />;
  }

  const supabase = await createClient();

  // Кто открыл страницу. Гостя сюда не пустит middleware, но проверку дублируем:
  // страница платная, и лишняя осторожность здесь дешевле открытого содержимого.
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(lessonHref(lesson.id))}`);
  }

  // Главный вопрос страницы: есть ли действующая подписка у ЭТОГО пользователя.
  // От ответа зависит, какие блоки урока вообще попадут в HTML.
  const hasAccess = await hasProSubscription(supabase, userId);

  const progressPercent = Math.round((lesson.id / totalLessons) * 100);
  const isLastLesson = lesson.id === totalLessons;

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
            {hasAccess && lesson.id > 1 ? (
              <Link
                href={lessonHref(lesson.id - 1)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>←</span>
                Предыдущий урок
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 sm:text-sm">
              <span>
                Урок {lesson.id} из {totalLessons}
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
          {lesson.module}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {lesson.title}
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
            Урок {lesson.id} из {totalLessons}
          </span>
        </div>

        {hasAccess ? (
          <>
            <LessonBlocks
              blocks={lesson.blocks}
              courseType="pro"
              lessonId={lesson.id}
            />

            {lesson.blocks.length === 0 ? <ComingSoonBlock /> : null}

            <div className="mt-12 sm:mt-16">
              {isLastLesson ? (
                <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-slate-900/70 to-slate-900/80 p-7 text-center sm:p-9">
                  <p className="text-2xl font-extrabold text-white sm:text-3xl">
                    <span aria-hidden>🏆</span> Полный курс пройден!
                  </p>
                  <p className="mt-4 text-base leading-relaxed text-slate-300">
                    Позади все {totalLessons} уроков продвинутого уровня: физика
                    экструзии, материалы от PLA до PEEK, тонкая калибровка и
                    диагностика. Дальше — практика в конструкторе.
                  </p>
                  <div className="mt-8">
                    <CompleteButton
                      lessonId={lesson.id}
                      courseType="pro"
                      href="/constructor"
                      label="Перейти в конструктор"
                    />
                  </div>
                </div>
              ) : (
                <CompleteButton
                  lessonId={lesson.id}
                  courseType="pro"
                  href={lessonHref(lesson.id + 1)}
                  label="Пройти урок"
                />
              )}
            </div>
          </>
        ) : (
          <>
            {/* Превью: в разметку попадают только первые блоки урока, остальное
                остаётся на сервере — «посмотреть код страницы» не поможет. */}
            <LessonBlocks
              blocks={lesson.blocks.slice(0, PREVIEW_BLOCKS)}
              courseType="pro"
              lessonId={lesson.id}
            />

            <LockedNotice refreshHref={lessonHref(lesson.id)} />
          </>
        )}
      </main>
    </div>
  );
}
