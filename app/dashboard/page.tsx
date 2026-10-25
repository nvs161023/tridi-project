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

/**
 * Поверхность карточек кабинета — тот же рецепт, что у карточек Мастерской:
 * тёмный `#0a0a0a`, тонкая рамка `white/5`, мягкая тень и подсветка рамки при
 * наведении. Один набор классов, чтобы кабинет и Мастерская читались как одна
 * CRM, а не как два разных продукта.
 */
const CARD_SURFACE =
  "rounded-2xl border border-white/5 bg-[#0a0a0a] shadow-xl transition-all hover:border-white/20";

/** Главное действие — белая кнопка с чёрным текстом, как в Мастерской. */
const PRIMARY_ACTION =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-black shadow-[0_16px_40px_-16px_rgba(255,255,255,0.45)] transition-all duration-300 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

/** Второстепенное действие — тёмная кнопка с обводкой. */
const SECONDARY_ACTION =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

/** Подпись над заголовком секции. */
const SECTION_EYEBROW =
  "text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase";

/** Заголовок секции кабинета. */
const SECTION_TITLE = "mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl";

/**
 * Иконка и акцент уровня: те же цвета, что на странице тарифов.
 *
 * Рамка карточки и кнопки общие для всех уровней — их задают `CARD_SURFACE` и
 * `PRIMARY_ACTION`, поэтому в стилях уровня остались только оттенки.
 */
const COURSE_STYLES: Record<
  LevelKey,
  {
    icon: string;
    accent: string;
    iconBox: string;
    bar: string;
  }
> = {
  basic: {
    icon: "🌱",
    accent: "text-blue-300",
    iconBox: "border-blue-400/20 bg-blue-500/10",
    bar: "bg-blue-500",
  },
  confident: {
    icon: "🎯",
    accent: "text-violet-300",
    iconBox: "border-violet-400/20 bg-violet-500/10",
    bar: "bg-violet-500",
  },
  engineer: {
    icon: "📐",
    accent: "text-emerald-300",
    iconBox: "border-emerald-400/20 bg-emerald-500/10",
    bar: "bg-emerald-500",
  },
  profit: {
    icon: "💰",
    accent: "text-amber-300",
    iconBox: "border-amber-400/20 bg-amber-500/10",
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
    <article className={`flex h-full flex-col p-6 ${CARD_SURFACE}`}>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${style.iconBox}`}
        >
          {style.icon}
        </span>

        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-200">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
            />
            {level.isFree ? "Бесплатно" : "Доступ открыт"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-zinc-400">
            <LockIcon className="h-3 w-3" />
            Закрыт
          </span>
        )}
      </div>

      <p
        className={`mt-5 text-[11px] font-semibold tracking-[0.16em] uppercase ${style.accent}`}
      >
        {level.code}
      </p>
      <h3 className="mt-2 text-lg font-bold tracking-tight text-white">
        {level.shortTitle}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {level.subtitle}
      </p>

      <div className="mt-auto pt-6">
        {isOpen ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-sm text-zinc-400">
                Пройдено{" "}
                <span className="font-semibold text-white tabular-nums">
                  {progress.completed} из {progress.total} уроков
                </span>
              </span>
              <span className="text-xs font-semibold text-zinc-500 tabular-nums">
                {percent}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-label={`Прогресс курса «${level.shortTitle}»`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${style.bar}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {completion.totalTests > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                Тесты модулей:{" "}
                <span className="font-semibold text-zinc-300">
                  {completion.passedTests} из {completion.totalTests}
                </span>
              </p>
            ) : null}

            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
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
              className={`mt-5 min-h-12 w-full ${PRIMARY_ACTION}`}
            >
              Продолжить
              <span aria-hidden>→</span>
            </Link>

            {completion.isComplete ? (
              <Link
                href={`/certificate/${level.key}`}
                className={`mt-2.5 min-h-11 w-full ${SECONDARY_ACTION}`}
              >
                <span aria-hidden>🏅</span>
                Сертификат
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-zinc-200">
                <LockIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">Курс не куплен</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Купите навсегда за {formatPrice(level.price)} ₽ — доступ к
                урокам откроется сразу после оплаты.
              </p>
            </div>

            <Link
              href="/subscription"
              className={`mt-3 min-h-12 w-full ${PRIMARY_ACTION}`}
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
  {
    icon: "🧰",
    title: "Мастерская",
    description:
      "Рабочее место для 3D-печати: себестоимость заказа, склад пластика, принтеры с обслуживанием и заказы клиентов.",
    href: "/dashboard/workshop",
    cta: "Открыть мастерскую",
    bullets: [
      "Калькулятор: материал, электричество, износ и работа",
      "Склад катушек и загрузка G-code из слайсера",
      "Наработка сопла и смазки, заказы со статусами",
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
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section
          aria-labelledby="dashboard-title"
          className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a] px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] sm:px-8 sm:py-9 lg:px-10 lg:py-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
                  Личный кабинет
                </span>
                {hasPro ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                    />
                    {hasBundle
                      ? "Пакет «Всё включено»"
                      : "Доступ к инструментам открыт"}
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-400">
                    Бесплатный аккаунт
                  </span>
                )}
              </div>

              <h1
                id="dashboard-title"
                className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Привет, {displayName}!
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
                Здесь собрано всё для обучения: прогресс по четырём уровням,
                сертификаты и доступ к инструментам платформы. Прогресс
                сохраняется за аккаунтом, поэтому можно продолжать с любого
                устройства.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              <ProfileEditor
                email={identity.email}
                firstName={firstName}
                lastName={lastName}
              />
              <p className="max-w-56 text-center text-[11px] leading-relaxed text-zinc-500 sm:text-left lg:text-right">
                Имя из профиля подставляется в сертификаты.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="promo-activation-title"
          className={`mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${CARD_SURFACE}`}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200"
            >
              <TicketIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="promo-activation-title"
                className="text-base font-semibold tracking-tight text-white"
              >
                У вас есть промокод из Ozon или от партнёра?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Активируйте его здесь — доступ к курсу откроется сразу.
              </p>
            </div>
          </div>

          <Link
            href="/activate"
            className={`min-h-11 shrink-0 ${PRIMARY_ACTION}`}
          >
            Активировать код
            <span aria-hidden>→</span>
          </Link>
        </section>

        {hasDataError ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Часть данных не загрузилась — показываем
            то, что удалось получить.
          </p>
        ) : null}

        <section
          aria-labelledby="subscription-status-title"
          className={`mt-4 p-6 sm:p-8 ${CARD_SURFACE}`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className={SECTION_EYEBROW}>Доступ к инструментам</p>
              <h2 id="subscription-status-title" className={SECTION_TITLE}>
                {subscriptionTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                {hasPro
                  ? hasBundle
                    ? "Все три платных курса и инструменты платформы открыты навсегда. Это разовая покупка пакета — продлевать ничего не нужно."
                    : "Библиотека профилей открыта. Доступ действует на инструменты платформы, курсы остаются доступны навсегда после покупки."
                  : "Курсы можно купить навсегда, а библиотеку профилей открывает пакет «Всё включено». Начните с бесплатного уровня — карта не нужна."}
              </p>
            </div>

            <div className="shrink-0">
              {hasPro ? (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-6 text-sm font-semibold text-emerald-200">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  />
                  {hasBundle ? "Пакет активен" : "Доступ открыт"}
                </span>
              ) : (
                <Link
                  href="/courses/pro"
                  className={`min-h-12 px-7 text-base ${PRIMARY_ACTION}`}
                >
                  Открыть пакет
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="courses-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={SECTION_EYEBROW}>Обучение</p>
              <h2 id="courses-title" className={SECTION_TITLE}>
                Мои курсы
              </h2>
            </div>
            <p className="text-sm text-zinc-400">
              Открыто {openCourses} из {COURSE_TYPES.length} уровней
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
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

        <section aria-labelledby="forum-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={SECTION_EYEBROW}>Сообщество</p>
              <h2 id="forum-title" className={SECTION_TITLE}>
                Форум
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              Вопросы по принтерам, материалам и настройкам. Читать может каждый,
              писать — после входа.
            </p>
          </div>

          <div className={`mt-5 p-6 sm:p-7 ${CARD_SURFACE}`}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-2xl">
                <h3 className="text-lg font-bold tracking-tight text-white">
                  Форум сообщества TriDi
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Задайте вопрос или помогите другому. Новые темы проходят
                  проверку, а ответы публикуются сразу.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/forum" className={`min-h-11 ${PRIMARY_ACTION}`}>
                  Открыть форум
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/forum/new"
                  className={`min-h-11 ${SECONDARY_ACTION}`}
                >
                  Создать тему
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="tools-access-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={SECTION_EYEBROW}>Инструменты платформы</p>
              <h2 id="tools-access-title" className={SECTION_TITLE}>
                Инструменты Pro
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              {hasPro
                ? "Доступ открыт — профили можно скачивать, мастерская считает себестоимость."
                : "Доступ открывается пакетом «Всё включено». Без него карточки остаются размытыми."}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
            {PRO_TOOLS.map((tool) => (
              <ProToolCard key={tool.title} tool={tool} isPro={hasPro} />
            ))}
          </div>
        </section>

        {isAdmin ? (
          <section aria-labelledby="admin-title" className="mt-10">
            <div>
              <p className={SECTION_EYEBROW}>Только для администраторов</p>
              <h2 id="admin-title" className={SECTION_TITLE}>
                Администрирование
              </h2>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <AdminCard
                icon="🛡️"
                title="Панель модератора"
                description="Управление темами форума, баны и модерация"
                href="/admin/forum"
                action="Открыть админку"
              />
              <AdminCard
                icon="🧾"
                title="Управление покупками"
                description="Просмотр покупок и оформление возвратов"
                href="/admin/purchases"
                action="Открыть"
              />
            </div>
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
    <article className={`relative min-h-[19rem] overflow-hidden ${CARD_SURFACE}`}>
      <div
        aria-hidden={!isPro || undefined}
        className={
          isPro
            ? "p-6"
            : "pointer-events-none p-6 opacity-40 blur-[3px] select-none"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-xl"
          >
            {tool.icon}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-zinc-300">
            В пакете
          </span>
        </div>

        <h3 className="mt-5 text-lg font-bold tracking-tight text-white">
          {tool.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {tool.description}
        </p>

        <ul className="mt-4 space-y-2">
          {tool.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 text-sm text-zinc-400"
            >
              <span aria-hidden className="mt-0.5 text-blue-300">
                ✓
              </span>
              {bullet}
            </li>
          ))}
        </ul>

        {isPro ? (
          <Link href={tool.href} className={`mt-6 min-h-12 w-full ${PRIMARY_ACTION}`}>
            {tool.cta}
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <span
            className={`mt-6 min-h-12 w-full cursor-default ${SECONDARY_ACTION}`}
          >
            {tool.cta}
          </span>
        )}
      </div>

      {!isPro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/85 p-6 text-center backdrop-blur-[2px]">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
            <LockIcon className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-white">
            {tool.title}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-400">
            Доступно в пакете «Всё включено»
          </p>
          <Link
            href="/courses/pro"
            className={`mt-1 min-h-11 px-6 ${PRIMARY_ACTION}`}
          >
            Открыть пакет
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/** Карточка админ-секции: она рендерится только для email из ADMIN_EMAIL. */
type AdminCardProps = {
  icon: string;
  title: string;
  description: string;
  href: string;
  action: string;
};

/**
 * Ссылка на админку в кабинете.
 *
 * Карточка вертикальная: в сетке `md:grid-cols-2` она занимает половину
 * ширины, и кнопка под текстом не сжимается. `mt-auto` прижимает её к низу,
 * поэтому в одной строке кнопки обеих карточек стоят на одном уровне.
 */
function AdminCard({ icon, title, description, href, action }: AdminCardProps) {
  return (
    <article className={`flex flex-col overflow-hidden p-6 ${CARD_SURFACE}`}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-xl"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold tracking-tight text-white">
              {title}
            </h3>
            <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-violet-200 uppercase">
              Admin
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <Link
          href={href}
          className={`min-h-12 w-full sm:w-auto sm:px-6 ${PRIMARY_ACTION}`}
        >
          {action}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

