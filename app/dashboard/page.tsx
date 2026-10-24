import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { ProfileEditor } from "@/app/dashboard/ProfileEditor";
import { isAdminEmail } from "@/lib/admin";
import { basicLessons } from "@/lib/basic-course";
import { confidentLessons } from "@/lib/confident-course";
import {
  COURSE_TEST_TYPES,
  getCourseCompletionFromRows,
  type CourseCompletion,
} from "@/lib/course-completion";
import {
  LEVELS,
  type CourseLevel,
  type LevelKey,
} from "@/lib/course-levels";
import { engineerLessons } from "@/lib/engineer-course";
import { splitPersonName } from "@/lib/person-name";
import { profitLessons } from "@/lib/profit-course";
import {
  getActiveSubscription,
  hasPurchasedCourse,
} from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

export const metadata: Metadata = {
  title: "Личный кабинет — TriDi",
  description:
    "Прогресс по четырём уровням курса, сертификаты и доступ к инструментам платформы.",
};

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

/** Строка прогресса: course_type есть только после миграции pro_course_access.sql. */
type ProgressRow = {
  course_type?: string | null;
  lesson_id: number | string | null;
  completed_at?: string | null;
};

/** Урок в том виде, в каком кабинет считает прогресс и строит ссылку. */
type LessonRef = {
  number: number;
  href: string;
  hasContent: boolean;
};

/** Сколько уроков курса пройдено и куда вести по кнопке «Продолжить». */
type CourseProgress = {
  completed: number;
  total: number;
  nextHref: string;
};

const COURSE_TYPES: readonly LevelKey[] = [
  "basic",
  "confident",
  "engineer",
  "profit",
];

/**
 * Что читаем из lesson_progress: уроки и отдельные строки тестов модулей.
 * Типы тестов («basic-test», …) не попадают в счётчик уроков, но без них нельзя
 * понять, можно ли выдавать сертификат.
 */
const PROGRESS_COURSE_TYPES: readonly string[] = [
  ...COURSE_TYPES,
  ...Object.values(COURSE_TEST_TYPES),
];

/**
 * Уроки каждого уровня в едином виде.
 *
 * В lesson_progress.lesson_id лежит сквозной номер урока, поэтому для платных
 * уровней берём lessonNumber, а не строковый код (C1, IN1, Z1). Ссылки
 * собираются по тем же правилам, что и на страницах курсов.
 */
const COURSE_LESSONS: Record<LevelKey, LessonRef[]> = {
  basic: basicLessons.map((lesson) => ({
    number: lesson.id,
    href: `/course/lesson-${lesson.id}`,
    hasContent: lesson.blocks.length > 0,
  })),
  confident: confidentLessons.map((lesson) => ({
    number: lesson.lessonNumber,
    href: `/course/confident/${encodeURIComponent(lesson.moduleId)}/${encodeURIComponent(lesson.lessonId)}`,
    hasContent: lesson.blocks.length > 0,
  })),
  engineer: engineerLessons.map((lesson) => ({
    number: lesson.lessonNumber,
    href: `/course/engineer/${encodeURIComponent(lesson.moduleId)}/${encodeURIComponent(lesson.lessonId)}`,
    hasContent: lesson.blocks.length > 0,
  })),
  profit: profitLessons.map((lesson) => ({
    number: lesson.lessonNumber,
    href: `/course/profit/${encodeURIComponent(lesson.moduleId)}/${encodeURIComponent(lesson.lessonId)}`,
    hasContent: lesson.blocks.length > 0,
  })),
};

/** Иконка и цвета уровня: те же акценты, что на странице тарифов. */
const COURSE_STYLES: Record<
  LevelKey,
  {
    icon: string;
    accent: string;
    border: string;
    iconBox: string;
    button: string;
    bar: string;
  }
> = {
  basic: {
    icon: "🌱",
    accent: "text-blue-300",
    border: "border-blue-400/25",
    iconBox: "border-blue-400/30 bg-blue-500/10",
    button:
      "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 focus-visible:ring-blue-400",
    bar: "bg-blue-500",
  },
  confident: {
    icon: "🎯",
    accent: "text-violet-300",
    border: "border-violet-400/25",
    iconBox: "border-violet-400/30 bg-violet-500/10",
    button:
      "bg-violet-600 text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 focus-visible:ring-violet-400",
    bar: "bg-violet-500",
  },
  engineer: {
    icon: "📐",
    accent: "text-emerald-300",
    border: "border-emerald-400/25",
    iconBox: "border-emerald-400/30 bg-emerald-500/10",
    button:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 focus-visible:ring-emerald-400",
    bar: "bg-emerald-500",
  },
  profit: {
    icon: "💰",
    accent: "text-amber-300",
    border: "border-amber-400/25",
    iconBox: "border-amber-400/30 bg-amber-500/10",
    button:
      "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 focus-visible:ring-amber-300",
    bar: "bg-amber-400",
  },
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** «18 ноября 2026» — дата окончания доступа для верхнего блока. */
function formatDate(isoDate: string | null): string | null {
  if (!isoDate) {
    return null;
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Прогресс курса и следующий урок.
 *
 * Считаем только уроки текущей программы: старые записи и дубли не поднимают
 * счётчик выше общего числа. Кнопка ведёт на первый непройденный урок с
 * материалом; когда всё пройдено — на первый урок, чтобы можно было повторить.
 */
function progressFor(
  lessons: readonly LessonRef[],
  completed: ReadonlySet<number>,
): CourseProgress {
  const completedLessons = lessons.reduce(
    (sum, lesson) => sum + (completed.has(lesson.number) ? 1 : 0),
    0,
  );
  const nextLesson =
    lessons.find(
      (lesson) => lesson.hasContent && !completed.has(lesson.number),
    ) ??
    lessons.find((lesson) => lesson.hasContent) ??
    lessons[0];

  return {
    completed: completedLessons,
    total: lessons.length,
    nextHref: nextLesson?.href ?? "/dashboard",
  };
}

/** Карточка уровня: прогресс для открытого курса, замок и цена для закрытого. */
function CourseCard({
  level,
  isOpen,
  progress,
  completion,
}: {
  level: CourseLevel;
  isOpen: boolean;
  progress: CourseProgress;
  completion: CourseCompletion;
}) {
  const style = COURSE_STYLES[level.key];
  const percent =
    progress.total === 0
      ? 0
      : Math.min(
          100,
          Math.round((progress.completed / progress.total) * 100),
        );

  return (
    <article
      className={`flex h-full flex-col rounded-3xl border bg-white/5 p-6 ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl ${style.iconBox}`}
        >
          {style.icon}
        </span>

        {isOpen ? (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-200 uppercase">
            {level.isFree ? "Бесплатно" : "Доступ открыт"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-300 uppercase">
            <LockIcon className="h-3 w-3" />
            Закрыт
          </span>
        )}
      </div>

      <p
        className={`mt-5 text-xs font-semibold tracking-[0.16em] uppercase ${style.accent}`}
      >
        {level.code}
      </p>
      <h3 className="mt-2 text-xl font-extrabold tracking-tight text-white">
        {level.shortTitle}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        {level.subtitle}
      </p>

      <div className="mt-auto pt-6">
        {isOpen ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-300">Пройдено</span>
              <span className="text-sm font-semibold text-white">
                {progress.completed} из {progress.total} уроков
              </span>
            </div>

            <div
              role="progressbar"
              aria-label={`Прогресс курса «${level.shortTitle}»`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${style.bar}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {completion.totalTests > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                Тесты модулей:{" "}
                <span className="font-semibold text-slate-200">
                  {completion.passedTests} из {completion.totalTests}
                </span>
              </p>
            ) : null}

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {completion.isComplete
                ? "Курс завершён: уроки и тесты пройдены. Сертификат готов."
                : percent === 100 && completion.totalTests > 0
                  ? `Уроки пройдены. Осталось сдать тесты модулей: ${completion.passedTests} из ${completion.totalTests}.`
                  : percent === 100
                    ? "Все уроки пройдены."
                    : "Прогресс сохраняется за аккаунтом на любом устройстве."}
            </p>

            <Link
              href={progress.nextHref}
              className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${style.button}`}
            >
              Продолжить
              <span aria-hidden>→</span>
            </Link>

            {completion.isComplete ? (
              <Link
                href={`/certificate/${level.key}`}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>🏅</span>
                Сертификат
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-slate-200">
                <LockIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">Курс не куплен</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Купите навсегда за {formatPrice(level.price)} ₽ — доступ к
                урокам откроется сразу после оплаты.
              </p>
            </div>

            <Link
              href="/subscription"
              className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${style.button}`}
            >
              Купить курс
              <span aria-hidden>→</span>
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

/** Замок для закрытых курсов и инструментов Pro. */
function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <rect
        height="7"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.3"
        width="10"
        x="3"
        y="7"
      />
      <path
        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Билет-промокод для баннера активации в начале кабинета. */
function TicketIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 20 20"
    >
      <rect
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        width="14"
        x="3"
        y="4"
      />
      <path
        d="M7.5 4v12"
        stroke="currentColor"
        strokeDasharray="1.6 1.6"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

type ProTool = {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  bullets: string[];
};

const PRO_TOOLS: ProTool[] = [
  {
    icon: "📦",
    title: "Библиотека профилей",
    description:
      "Проверенные профили принтеров, материалов и настроек для Bambu Studio, OrcaSlicer и PrusaSlicer.",
    href: "/profiles",
    cta: "Открыть библиотеку",
    bullets: [
      "Bambu Lab X1 Carbon, Prusa MK3S+, Voron 2.4",
      "Материалы Polymaker и базовые настройки",
      "Импорт в слайсер за пару минут",
    ],
  },
];

export default async function DashboardPage() {
  // Пользователя проверил middleware — одним сетевым getUser() на весь запрос.
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (!identity) {
    // Страховка: сюда попадаем, только если запрос прошёл мимо middleware.
    redirect("/auth/login");
  }

  const userId = identity.id;
  const isAdmin = isAdminEmail(identity.email);
  const supabase = await createClient();

  // Профиль, прогресс по четырём курсам и доступ к платным уровням друг от
  // друга не зависят — запускаем запросы параллельно.
  const [
    profileResult,
    progressResult,
    confidentAccess,
    engineerAccess,
    profitAccess,
    subscription,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("lesson_progress")
      .select("course_type, lesson_id, completed_at")
      .eq("user_id", userId)
      .in("course_type", PROGRESS_COURSE_TYPES),
    hasPurchasedCourse(supabase, userId, "confident"),
    hasPurchasedCourse(supabase, userId, "engineer"),
    hasPurchasedCourse(supabase, userId, "profit"),
    getActiveSubscription(supabase, userId),
  ]);

  let progressRows = (progressResult.data as ProgressRow[] | null) ?? [];
  let progressError = progressResult.error;

  // Страховка для баз без колонки course_type (миграция
  // supabase/pro_course_access.sql применяется вручную): запрос к колонке
  // падает, и тогда читаем прогресс как раньше — без фильтра, а не показываем
  // ноль. Старые записи принадлежат базовому курсу.
  if (progressError) {
    const fallbackResult = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed_at")
      .eq("user_id", userId);

    progressRows = (fallbackResult.data as ProgressRow[] | null) ?? [];
    progressError = fallbackResult.error;
  }

  const profile = (profileResult.data as Profile | null) ?? null;
  // Приветствие — по имени, а не по email. У старых аккаунтов отдельного имени
  // нет, поэтому разбираем сохранённое полное имя: фамилия в кабинете не нужна.
  const savedFullName = profile?.name?.trim() || identity.name?.trim() || "";
  const savedNameParts = splitPersonName(savedFullName);
  const firstName = identity.firstName || savedNameParts.firstName;
  const lastName = identity.lastName || savedNameParts.lastName;
  const displayName = firstName || identity.email || "друг";

  // Прогресс раскладываем по курсам. Set отбрасывает дубли, а progressFor
  // считает только уроки текущей программы — старые записи не дают больше 100%.
  const completedByCourse: Record<LevelKey, Set<number>> = {
    basic: new Set<number>(),
    confident: new Set<number>(),
    engineer: new Set<number>(),
    profit: new Set<number>(),
  };

  for (const row of progressRows) {
    const courseType = (row.course_type ?? "basic") as LevelKey;

    if (!COURSE_TYPES.includes(courseType)) {
      continue;
    }

    const lessonId = Number(row.lesson_id);

    if (Number.isFinite(lessonId)) {
      completedByCourse[courseType].add(lessonId);
    }
  }

  const progressByCourse = Object.fromEntries(
    COURSE_TYPES.map((courseType) => [
      courseType,
      progressFor(COURSE_LESSONS[courseType], completedByCourse[courseType]),
    ]),
  ) as Record<LevelKey, CourseProgress>;

  // Сертификат выдаём только после уроков и тестов. Расчёт общий со страницей
  // сертификата — lib/course-completion.ts, поэтому условия не разойдутся.
  const completionByCourse = Object.fromEntries(
    COURSE_TYPES.map((courseType) => [
      courseType,
      getCourseCompletionFromRows(courseType, progressRows),
    ]),
  ) as Record<LevelKey, CourseCompletion>;

  const accessByCourse: Record<LevelKey, boolean> = {
    basic: true,
    confident: confidentAccess,
    engineer: engineerAccess,
    profit: profitAccess,
  };

  // Часть данных могла не загрузиться — покажем то, что есть, и предупредим.
  const hasDataError = Boolean(profileResult.error || progressError);
  const hasPro = subscription.active;
  const subscriptionDate = formatDate(subscription.expiresAt);
  const hasBundle = hasPro && subscription.source === "bundle";
  const subscriptionTitle = hasPro
    ? hasBundle
      ? "Пакет «Всё включено» активен навсегда"
      : subscriptionDate
        ? `Доступ к инструментам открыт до ${subscriptionDate}`
        : "Доступ к инструментам открыт"
    : "Бесплатный аккаунт";
  const openCourses = COURSE_TYPES.filter(
    (courseType) => accessByCourse[courseType],
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
          Аккаунт
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Личный кабинет
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xl font-semibold text-blue-300 sm:text-2xl">
            Привет, {displayName}!
          </p>
          <ProfileEditor
            email={identity.email}
            firstName={firstName}
            lastName={lastName}
          />
        </div>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Здесь собрано всё для обучения: прогресс по четырём уровням,
          сертификаты и доступ к инструментам платформы. Прогресс сохраняется за
          аккаунтом, поэтому можно продолжать с любого устройства.
        </p>

        <section
          aria-labelledby="promo-activation-title"
          className="mt-6 flex flex-col gap-4 rounded-3xl border border-blue-400/30 bg-gradient-to-r from-blue-600/15 via-slate-900/80 to-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-blue-200"
            >
              <TicketIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="promo-activation-title"
                className="text-base font-bold tracking-tight text-white sm:text-lg"
              >
                У вас есть промокод из Ozon или от партнёра?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Активируйте его здесь — доступ к курсу откроется сразу.
              </p>
            </div>
          </div>

          <Link
            href="/activate"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Активировать код
            <span aria-hidden>→</span>
          </Link>
        </section>

        {hasDataError ? (
          <p className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Часть данных не загрузилась — показываем
            то, что удалось получить.
          </p>
        ) : null}

        <section
          aria-labelledby="subscription-status-title"
          className={`mt-10 overflow-hidden rounded-3xl border p-7 sm:p-9 ${
            hasPro
              ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-900/60"
              : "border-blue-400/25 bg-gradient-to-br from-blue-600/10 via-slate-900/80 to-slate-900/60"
          }`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-300 uppercase">
                Доступ к инструментам
              </p>
              <h2
                id="subscription-status-title"
                className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                {subscriptionTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                {hasPro
                  ? hasBundle
                    ? "Все три платных курса и инструменты платформы открыты навсегда. Это разовая покупка пакета — продлевать ничего не нужно."
                    : "Библиотека профилей открыта. Доступ действует на инструменты платформы, курсы остаются доступны навсегда после покупки."
                  : "Курсы можно купить навсегда, а библиотеку профилей открывает пакет «Всё включено». Начните с бесплатного уровня — карта не нужна."}
              </p>
            </div>

            <div className="shrink-0">
              {hasPro ? (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-6 text-sm font-bold tracking-wide text-emerald-200 uppercase">
                  <span aria-hidden>✓</span>
                  {hasBundle ? "Пакет активен" : "Доступ открыт"}
                </span>
              ) : (
                <Link
                  href="/courses/pro"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-7 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Открыть пакет
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="courses-title" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                Обучение
              </p>
              <h2
                id="courses-title"
                className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Мои курсы
              </h2>
            </div>
            <p className="text-sm text-slate-300">
              Открыто {openCourses} из {COURSE_TYPES.length} уровней
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {LEVELS.map((level) => (
              <CourseCard
                key={level.key}
                level={level}
                isOpen={accessByCourse[level.key]}
                progress={progressByCourse[level.key]}
                completion={completionByCourse[level.key]}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="forum-title" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                Сообщество
              </p>
              <h2
                id="forum-title"
                className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Форум
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              Вопросы по принтерам, материалам и настройкам. Читать может каждый,
              писать — после входа.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-2xl">
                <h3 className="text-lg font-bold text-white">
                  Форум сообщества TriDi
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Задайте вопрос или помогите другому. Новые темы проходят
                  проверку, а ответы публикуются сразу.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/forum"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Открыть форум
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/forum/new"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Создать тему
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="tools-access-title" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                Инструменты платформы
              </p>
              <h2
                id="tools-access-title"
                className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Библиотека профилей
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              {hasPro
                ? "Доступ открыт — профили можно скачивать."
                : "Доступ открывается пакетом «Всё включено». Без него карточка остаётся размытой."}
            </p>
          </div>

          <div className="mt-6 grid gap-5">
            {PRO_TOOLS.map((tool) => (
              <ProToolCard key={tool.title} tool={tool} isPro={hasPro} />
            ))}
          </div>
        </section>

        {isAdmin ? (
          <section aria-labelledby="admin-title" className="mt-12">
            <div>
              <p className="text-sm font-semibold tracking-widest text-violet-300 uppercase">
                Только для администраторов
              </p>
              <h2
                id="admin-title"
                className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Администрирование
              </h2>
            </div>

            <article className="mt-6 overflow-hidden rounded-3xl border border-violet-400/30 bg-violet-500/10 p-7 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-2xl"
                  >
                    🛡️
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-extrabold tracking-tight text-white">
                        Панель модератора
                      </h3>
                      <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-violet-200 uppercase">
                        Admin
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                      Управление темами форума, баны и модерация
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/forum"
                  className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:w-auto"
                >
                  Открыть админку
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          </section>
        ) : null}

      </main>
    </div>
  );
}

/**
 * Карточка инструмента платформы.
 *
 * Без доступа содержимое размывается, а поверх него остаётся понятный замок:
 * человек видит, что именно откроется, но не может перейти в раздел. Ссылка в
 * размытом слое не рендерится вовсе — иначе она оставалась бы в фокусе
 * клавиатуры под aria-hidden.
 */
function ProToolCard({ tool, isPro }: { tool: ProTool; isPro: boolean }) {
  return (
    <article className="relative min-h-[19rem] overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div
        aria-hidden={!isPro || undefined}
        className={
          isPro
            ? "p-7 sm:p-8"
            : "pointer-events-none p-7 opacity-40 blur-[3px] select-none sm:p-8"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-xl"
          >
            {tool.icon}
          </span>
          <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-blue-200 uppercase">
            В пакете
          </span>
        </div>

        <h3 className="mt-5 text-xl font-extrabold tracking-tight text-white">
          {tool.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {tool.description}
        </p>

        <ul className="mt-4 space-y-2">
          {tool.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 text-sm text-slate-300"
            >
              <span aria-hidden className="mt-0.5 text-blue-300">
                ✓
              </span>
              {bullet}
            </li>
          ))}
        </ul>

        {isPro ? (
          <Link
            href={tool.href}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {tool.cta}
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white">
            {tool.cta}
          </span>
        )}
      </div>

      {!isPro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/65 p-6 text-center backdrop-blur-[1px]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-200">
            <LockIcon className="h-5 w-5" />
          </span>
          <h3 className="text-xl font-extrabold tracking-tight text-white">
            {tool.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            Доступно в пакете «Всё включено»
          </p>
          <Link
            href="/courses/pro"
            className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Открыть пакет
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}
    </article>
  );
}
