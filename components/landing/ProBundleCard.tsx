import { PlanButton } from "@/app/subscription/PlanButton";
import { ButtonLink, Card } from "@/components/ui";
import coursesData from "@/data/courses.json";
import {
  PAID_LESSONS,
  PAID_LEVELS,
  PAID_TESTS,
  PAID_VISUALS,
} from "@/lib/course-levels";
import {
  FILE_FORMS,
  LESSON_FORMS,
  TEST_FORMS,
  VISUAL_FORMS,
  pluralize,
} from "@/lib/course-stats";
import { profileCount } from "@/lib/profiles";

const { pro: proCourse } = coursesData;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** Скидка пакета не рисуется процентами: выгода показывается в рублях. */
const BUNDLE_SAVING = formatPrice(
  PAID_LEVELS.reduce((sum, level) => sum + level.price, 0) - proCourse.price,
);

/** Названия платных уровней в описании пакета не дублируем вручную. */
const BUNDLE_COURSES = PAID_LEVELS.map((level) => level.shortTitle).join(", ");

/** Файлы к урокам всех платных уровней: те же ссылки, что на карточках. */
const BUNDLE_ARTIFACTS = new Set(
  PAID_LEVELS.flatMap((level) =>
    level.artifacts.map((artifact) => artifact.href),
  ),
).size;

const BUNDLE_DESCRIPTION = `Все ${PAID_LEVELS.length} платных курса (${BUNDLE_COURSES}) и библиотека профилей печати — навсегда`;

const BUNDLE_FEATURES = [
  ...PAID_LEVELS.map(
    (level) =>
      `${level.shortTitle} — ${level.lessons} ${pluralize(level.lessons, LESSON_FORMS)}`,
  ),
  "Коммерческая лицензия (можно продавать напечатанное)",
  "Доступ навсегда",
];

/**
 * Главные фишки пакета — отдельными зелёными строками.
 *
 * Состав курсов остаётся в BUNDLE_FEATURES, а сертификат и профили
 * вынесены наверх: именно они отличают пакет от покупки отдельных уроков.
 * Число профилей берётся из каталога, а не вписано руками.
 */
const BUNDLE_HIGHLIGHTS = [
  "Именной сертификат",
  `Доступ к ${profileCount} профилям печати`,
  ...(BUNDLE_ARTIFACTS > 0
    ? [
        `${BUNDLE_ARTIFACTS} ${pluralize(BUNDLE_ARTIFACTS, FILE_FORMS)} к урокам`,
      ]
    : []),
];

type ProBundleCardProps = {
  /** Куплен ли именно пакет `pro`; отдельные уровни здесь не считаются. */
  hasBundle: boolean;
  /** Дополнительные классы сетки: на витринах пакет занимает две колонки. */
  className?: string;
};

/**
 * Карточка пакета «Всё включено» для главной и страницы тарифов.
 *
 * Один компонент на две витрины нужен, чтобы цена, состав, статистика и кнопки
 * не разошлись. Цифры берутся из данных уровней, цена и бейдж — из
 * data/courses.json, а оплата идёт через тот же PlanButton, что у отдельных
 * курсов: сумма и доступ проверяются на сервере.
 */
export function ProBundleCard({
  hasBundle,
  className = "",
}: ProBundleCardProps) {
  return (
    <Card
      as="article"
      padding="none"
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-violet-500/15 via-slate-900 to-amber-500/10 p-6 ring-1 ring-amber-300/20 transition-colors hover:border-amber-300/80 sm:p-7 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-12 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl"
      />

      <div className="relative flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.16em] text-violet-300 uppercase">
          Пакет «{proCourse.bundleTitle}»
        </span>
        <span className="rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-3 py-1 text-[10px] font-extrabold tracking-wide text-slate-950 uppercase shadow-lg shadow-amber-500/25">
          {proCourse.badge}
        </span>
      </div>

      <div className="relative mt-4 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {proCourse.bundleTitle}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
            {BUNDLE_DESCRIPTION}
          </p>

          <ul className="mt-3 space-y-1.5">
            {BUNDLE_HIGHLIGHTS.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-emerald-300"
              >
                <span aria-hidden className="mt-px">
                  ✅
                </span>
                {highlight}
              </li>
            ))}
          </ul>

          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-extrabold text-white">
              {formatPrice(proCourse.price)} ₽
            </span>
            <span className="text-xs text-slate-300">навсегда</span>
          </p>

          <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
            <span className="font-semibold text-emerald-200">
              Выгода {BUNDLE_SAVING} ₽
            </span>
            <span>против покупки трёх курсов по отдельности</span>
          </p>

          <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-white/10 py-4 text-center">
            <div>
              <dt className="text-lg font-bold text-white">{PAID_LESSONS}</dt>
              <dd className="text-[11px] text-slate-300">
                {pluralize(PAID_LESSONS, LESSON_FORMS)}
              </dd>
            </div>
            <div>
              <dt className="text-lg font-bold text-white">{PAID_VISUALS}</dt>
              <dd className="text-[11px] text-slate-300">
                {pluralize(PAID_VISUALS, VISUAL_FORMS)}
              </dd>
            </div>
            <div>
              <dt className="text-lg font-bold text-white">{PAID_TESTS}</dt>
              <dd className="text-[11px] text-slate-300">
                {pluralize(PAID_TESTS, TEST_FORMS)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-col rounded-2xl border border-amber-300/20 bg-slate-950/40 p-5">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-amber-200 uppercase">
            В пакете
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
            {BUNDLE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-amber-300">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-5">
            {hasBundle ? (
              <>
                <p className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                  <span aria-hidden>✓</span>
                  Доступ открыт
                </p>
                <ButtonLink
                  href="/dashboard"
                  variant="success"
                  fullWidth
                  className="mt-3"
                >
                  Перейти в кабинет
                  <span aria-hidden>→</span>
                </ButtonLink>
              </>
            ) : (
              <PlanButton
                label="Купить пакет"
                courseId="pro"
                variant="gold"
                size="compact"
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
