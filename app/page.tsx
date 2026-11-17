import type { Metadata } from "next";
import Image from "next/image";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { cx } from "@/components/ui/class-names";
import { VASE_RECIPES, vaseRecipeImagePath } from "@/data/vase-recipes";
import { MODEL_TYPES, MODEL_TYPE_LABELS } from "@/lib/constructor/model-types";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { LEVELS, TOTAL_LESSONS } from "@/lib/course-levels";
import { defects } from "@/lib/defects";
import { SUBSCRIPTION_PLAN } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";

/**
 * Формы склонения для чисел на странице: 10 моделей, 193 профиля, 6 дефектов.
 * Без них «193 профилей» выглядит как ошибка. Объявлены до metadata: описание
 * страницы тоже считает числа из каталога.
 */
const MODEL_FORMS: [string, string, string] = ["модель", "модели", "моделей"];
const PROFILE_FORMS: [string, string, string] = ["профиль", "профиля", "профилей"];
const DEFECT_FORMS: [string, string, string] = ["дефект", "дефекта", "дефектов"];
const LEVEL_FORMS: [string, string, string] = ["уровень", "уровня", "уровней"];

/**
 * Главная продаёт платформу, а не один инструмент.
 *
 * Первый экран отвечает на вопрос «что я получу, если у меня есть принтер»:
 * мастерская снимает рутину с заказов, склада и принтеров, конструктор и
 * генератор дают модели, профили и справочник дефектов убирают настройку
 * вслепую. Курсы идут отдельным блоком: они учат печатать, но не входят в
 * подписку и не занимают первый экран.
 *
 * Числа не дублируются руками: список моделей берётся из `MODEL_TYPES`, цена
 * подписки — из того же источника, что у Robokassa (`getPaymentAmount`),
 * количество профилей и дефектов — из библиотек. Превью галереи — реальные PNG
 * Конструктора из `public/constructor/recipes`, поэтому блок демонстрации не
 * обещает моделей, которых нет. Пакетов токенов здесь нет: разовая докупка
 * живёт на странице генератора, где виден баланс.
 */
export const metadata: Metadata = {
  // Заголовок главной без шаблона: template из корневого layout действует
  // только на вложенные сегменты, поэтому бренд дописываем здесь сами.
  title: "TriDi — мастерская и инструменты для 3D-печати",
  description: `Мастерская для заказов с маркетплейсов, склада и принтеров, конструктор с ${MODEL_TYPES.length} моделями, генератор по фото, ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати и справочник дефектов. Курсы — от распаковки до заработка.`,
  alternates: { canonical: "/" },
  // Свои openGraph и twitter: иначе в мессенджере развернулась бы карточка
  // генератора, а og:url указывал бы на вложенную страницу.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/",
    title: "TriDi — мастерская и инструменты для 3D-печати",
    description: `Мастерская, конструктор и генератор 3D: заказы с маркетплейсов, склад пластика, ${MODEL_TYPES.length} ${pluralize(MODEL_TYPES.length, MODEL_FORMS)} и ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати.`,
    images: [
      {
        ...OG_IMAGE,
        alt: "TriDi: мастерская, конструктор и генератор для 3D-печати",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TriDi — мастерская и инструменты для 3D-печати",
    description:
      "Мастерская для заказов из маркетплейсов, конструктор 3D и генератор по фото. Курсы — от распаковки принтера до заработка.",
    images: [
      {
        url: OG_IMAGE.url,
        alt: "TriDi: мастерская, конструктор и генератор для 3D-печати",
      },
    ],
  },
};

/** Цена в рублях с разделителями разрядов: 500 → «500», 1 486 → «1 486». */
const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** Сумма подписки Pro: та же, что уходит в Robokassa, без копии цены в разметке. */
const subscriptionPrice = getPaymentAmount(SUBSCRIPTION_PLAN.courseId);

const SECTION_LABEL =
  "text-[11px] font-semibold tracking-[0.24em] uppercase";

const SECTION_TITLE =
  "mt-4 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl";

/** Акценты карточек: иконка, подпись и мягкое пятно в углу. */
type Tone = "blue" | "violet" | "emerald" | "amber";

const TONE_STYLES: Record<
  Tone,
  { icon: string; text: string; badge: string; glow: string }
> = {
  blue: {
    icon: "border-blue-400/20 bg-blue-500/10 text-blue-300",
    text: "text-blue-300",
    badge: "border-blue-400/20 bg-blue-500/10 text-blue-200",
    glow: "bg-blue-500/15",
  },
  violet: {
    icon: "border-violet-400/20 bg-violet-500/10 text-violet-300",
    text: "text-violet-300",
    badge: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    glow: "bg-violet-500/15",
  },
  emerald: {
    icon: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    text: "text-emerald-300",
    badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    glow: "bg-emerald-500/15",
  },
  amber: {
    icon: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    text: "text-amber-300",
    badge: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    glow: "bg-amber-500/15",
  },
};


type CtaVariant = "light" | "outline" | "ghost" | "success";

type CtaLinkProps = Omit<LinkProps, "className" | "children"> & {
  variant?: CtaVariant;
  size?: "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * CTA главной в стиле Vercel: белая кнопка с чёрным текстом и стеклянная
 * вторичная. Отдельный компонент не меняет UI-кит внутренних страниц.
 */
function CtaLink({
  variant = "light",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: CtaLinkProps) {
  const variants: Record<CtaVariant, string> = {
    light:
      "bg-white text-black shadow-[0_10px_40px_-12px_rgba(255,255,255,0.55)] hover:scale-105 hover:bg-zinc-100 hover:shadow-[0_18px_60px_-12px_rgba(255,255,255,0.7)] active:scale-[0.99]",
    outline:
      "border border-white/12 bg-white/[0.035] text-white backdrop-blur-xl hover:border-white/25 hover:bg-white/[0.07] hover:scale-[1.02] active:scale-[0.99]",
    ghost: "text-white/60 hover:bg-white/[0.04] hover:text-white",
    success:
      "border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/40 hover:bg-emerald-400/15",
  };

  const sizes = {
    md: "min-h-12 px-6 py-3 text-sm",
    lg: "min-h-14 px-7 py-4 text-base",
  };

  return (
    <Link
      className={cx(
        "inline-flex items-center justify-center gap-2.5 rounded-full font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]",
        sizes[size],
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-4 w-4 shrink-0", className)}
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

/** Иконки шагов и аудиторий: одна карта путей на всю страницу. */
type FeatureIconName =
  | "photo"
  | "sliders"
  | "download"
  | "printer"
  | "business"
  | "hobby";

const FEATURE_ICON_PATHS: Record<FeatureIconName, ReactNode> = {
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.5-4.5 3 3L16 12l3 3" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 4v6M5 14v6M12 4v3M12 11v9M19 4v9M19 17v3" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="9" r="2" />
      <circle cx="19" cy="15" r="2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 18h14" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M5 8h14a2 2 0 0 1 2 2v7h-4v3H7v-3H3v-7a2 2 0 0 1 2-2z" />
      <path d="M7 14h10" />
    </>
  ),
  business: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </>
  ),
  hobby: (
    <path d="m12 3 1.9 4.6L19 9.5l-3.8 3.2 1.1 4.8L12 15l-4.3 2.5 1.1-4.8L5 9.5l5.1-1.9z" />
  ),
};

function FeatureIcon({
  name,
  className,
}: {
  name: FeatureIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-5 w-5 sm:h-6 sm:w-6", className)}
    >
      {FEATURE_ICON_PATHS[name]}
    </svg>
  );
}

/**
 * Три шага: что делает пользователь, а не что умеет платформа.
 * Формулировки — из ТЗ, пояснение под каждым шагом снимает страх «это сложно».
 */
const STEPS: {
  number: string;
  title: string;
  text: string;
  icon: FeatureIconName;
  tone: Tone;
}[] = [
  {
    number: "01",
    title: "Загрузите фото или выберите модель",
    text: "Генератор примет JPG или PNG. В Конструкторе уже готовы вазы, брелоки, литофаны и вывески.",
    icon: "photo",
    tone: "blue",
  },
  {
    number: "02",
    title: "Настройте параметры (размер, узор, текст)",
    text: "Высота, диаметр, толщина стенки, узор и подпись — слайдерами, без CAD и Blender.",
    icon: "sliders",
    tone: "violet",
  },
  {
    number: "03",
    title: "Скачайте STL и отправьте на печать",
    text: "Файл открывается в Cura, PrusaSlicer и Orca: проверьте модель в 3D и сохраните.",
    icon: "download",
    tone: "amber",
  },
];

/** Шесть превью из галереи Конструктора: реальные PNG, а не заглушки. */
const DEMO_MODELS = VASE_RECIPES.slice(0, 6);

/** Три аудитории: печатник, бизнес и хобби. */
const AUDIENCE: {
  title: string;
  text: string;
  icon: FeatureIconName;
  tone: Tone;
}[] = [
  {
    title: "Для 3D-печатников",
    text: "Модели к печати без часов на сетку и мастерская для заказов: склад, принтеры и документы в одном окне.",
    icon: "printer",
    tone: "blue",
  },
  {
    title: "Для бизнеса",
    text: "Логотипы, брелоки и сувениры: один проект превращается в партию персонализированных изделий.",
    icon: "business",
    tone: "emerald",
  },
  {
    title: "Для хобби",
    text: "Литофаны по фото, декор и игрушки: подарок, который можно напечатать в тот же вечер.",
    icon: "hobby",
    tone: "violet",
  },
];

/**
 * Возможности подписки Pro: сначала инструменты, которые снимают рутину, потом
 * модели. Лимиты генератора берутся из тарифа, а не из текста.
 */
const PRO_FEATURES = [
  "Мастерская: заказы, склад пластика, принтеры и документы",
  "Справочник дефектов и форум — бесплатно всем, без подписки",
  `Все ${MODEL_TYPES.length} моделей Конструктора и безлимитный STL`,
  `Библиотека профилей печати и ${SUBSCRIPTION_PLAN.standardPerMonth} + ${SUBSCRIPTION_PLAN.ultraPerMonth} генерации в месяц`,
];

/**
 * Экосистема TriDi: шесть инструментов, которые получает печатник.
 *
 * Порядок не случайный: мастерская первой, потому что она снимает рутину, а
 * конструктор, генератор и профили — то, чем эту мастерскую наполняют. Два
 * бесплатных инструмента стоят последними: они не продают подписку, но
 * показывают, что платформа полезна и без неё.
 */
const ECO_CARDS: {
  href: string;
  title: string;
  text: string;
  badge: string;
  tone: Tone;
}[] = [
  {
    href: "/dashboard/workshop",
    title: "Мастерская",
    text: "Заказы с Ozon, Wildberries и Яндекс Маркета, склад пластика, принтеры и документы.",
    badge: "Pro",
    tone: "amber",
  },
  {
    href: "/constructor",
    title: "Конструктор 3D",
    text: `${MODEL_TYPES.length} ${pluralize(MODEL_TYPES.length, MODEL_FORMS)} с параметрами: вазы, брелоки, вывески, литофаны и органайзеры.`,
    badge: "Pro",
    tone: "emerald",
  },
  {
    href: "/3d-generator",
    title: "Генератор по фото",
    text: "Модель из 1–4 снимков: сеть соберёт форму, чистка сетки и 120 мм — уже внутри.",
    badge: "Pro",
    tone: "blue",
  },
  {
    href: "/profiles",
    title: "Профили печати",
    text: `${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} принтеров и материалов для Bambu Studio, OrcaSlicer и PrusaSlicer.`,
    badge: "Pro",
    tone: "violet",
  },
  {
    href: "/tools/defects",
    title: "Дефекты печати",
    text: `${defects.length} ${pluralize(defects.length, DEFECT_FORMS)} с причинами и решениями — от отрыва от стола до пропусков экструзии.`,
    badge: "Бесплатно",
    tone: "amber",
  },
  {
    href: "/forum",
    title: "Форум",
    text: "Разборы печати, настройки от участников и ответы на вопросы по конкретной модели.",
    badge: "Бесплатно",
    tone: "blue",
  },
];

/**
 * Что внутри мастерской: по строке на раздел, который реально есть в CRM.
 * Ничего «на будущее» — только вкладки `/dashboard/workshop`.
 */
const WORKSHOP_FEATURES: {
  title: string;
  text: string;
  tone: Tone;
}[] = [
  {
    title: "Заказы и доска статусов",
    text: "Заказы с маркетплейсов в одной доске: новый, в печати, готов, отправлен. Сроки подсвечиваются сами.",
    tone: "blue",
  },
  {
    title: "Склад пластика",
    text: "Катушки, остатки в граммах и списание материала на заказ: видно, хватит ли пластика до конца печати.",
    tone: "violet",
  },
  {
    title: "Принтеры и обслуживание",
    text: "Наработка в часах и регламенты ТО. Агент фермы распределяет задания по свободным принтерам.",
    tone: "emerald",
  },
  {
    title: "Себестоимость до печати",
    text: "Материал, электричество, амортизация и работа: калькулятор показывает цену и прибыль заказа.",
    tone: "amber",
  },
  {
    title: "Документы заказа",
    text: "Спецификация и накладная собираются из данных заказа, реквизиты компании хранятся рядом.",
    tone: "blue",
  },
  {
    title: "Клиенты и товары",
    text: "База контактов, каталог изделий и связи SKU маркетплейсов с товарами каталога.",
    tone: "violet",
  },
];

/**
 * Главная отдаётся на каждый запрос: Header читает cookies, чтобы показать
 * имя пользователя. force-dynamic также убирает зависимость сборки от
 * NEXT_PUBLIC_SUPABASE_* на этапе статической генерации.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="relative min-h-screen text-white">
      <Header />

      <main>
        {/* Hero: что получит пользователь, два входа в продукты и микро-факты. */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="hero-grid absolute inset-0 opacity-80" />
            <div className="absolute top-[-26rem] left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[150px]" />
            <div className="absolute top-24 right-[-14rem] h-[32rem] w-[32rem] rounded-full bg-violet-600/15 blur-[130px]" />
            <div className="absolute top-1/2 left-[-14rem] h-[28rem] w-[28rem] rounded-full bg-blue-700/10 blur-[120px]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100svh_-_5rem)] max-w-7xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8 sm:py-20 lg:py-24">
            <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:px-4 sm:text-xs">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              </span>
              <span className="text-center">
                Мастерская · Конструктор · Генератор · Курсы
              </span>
            </div>

            <h1 className="mx-auto mt-7 max-w-5xl text-balance text-5xl leading-[0.95] font-extrabold tracking-[-0.05em] sm:text-6xl md:text-7xl xl:text-[5.5rem]">
              <span className="block bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
                Всё для 3D-печати
              </span>{" "}
              <span className="mt-1 block bg-gradient-to-r from-blue-200 via-violet-200 to-white bg-clip-text pb-2 text-transparent">
                от модели до заказа
              </span>{" "}
              <span className="block text-white/35">в одном окне</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-white/55 sm:mt-7 sm:text-lg sm:leading-8">
              Мастерская ведёт заказы с маркетплейсов, склад и принтеры.
              Конструктор и генератор по фото делают модели, а профили и
              справочник дефектов помогают печатать с первого раза.
            </p>

            <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <CtaLink href="/dashboard/workshop" size="lg" className="group">
                Открыть мастерскую
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </CtaLink>
              <CtaLink href="/3d-generator" variant="outline" size="lg">
                Сделать 3D-модель
              </CtaLink>
            </div>

            <Link
              className="mt-4 text-xs font-semibold text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/80"
              href="/tools"
            >
              Все инструменты TriDi
            </Link>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
              {[
                "Первая генерация бесплатно",
                "STL для 3D-печати",
                "Профили и диагностика",
                "Курсы отдельно, навсегда",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400/80" />
                  {item}
                </li>
              ))}
            </ul>

            <dl className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] sm:mt-14 sm:grid-cols-4">
              {[
                { value: `${MODEL_TYPES.length}`, label: `${pluralize(MODEL_TYPES.length, MODEL_FORMS)} в Конструкторе` },
                { value: `${profileCount}`, label: `${pluralize(profileCount, PROFILE_FORMS)} печати` },
                { value: `${defects.length}`, label: `${pluralize(defects.length, DEFECT_FORMS)} с решениями` },
                { value: `${TOTAL_LESSONS}`, label: `${pluralize(TOTAL_LESSONS, LESSON_FORMS)} в курсах` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#070707]/95 px-3 py-4 backdrop-blur-xl sm:px-4 sm:py-5"
                >
                  <dt className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[10px] tracking-[0.14em] text-white/35 uppercase sm:text-[11px]">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Экосистема: все инструменты платформы, а не только генератор. */}
        <section
          id="ecosystem"
          className="relative scroll-mt-24 border-t border-white/[0.06] bg-white/[0.012]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-amber-300/80")}>
                  Экосистема
                </p>
                <h2 className={SECTION_TITLE}>
                  Один аккаунт —{" "}
                  <span className="text-white/35">вся мастерская.</span>
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                  Модели, настройки, заказы и склад живут рядом: не нужно
                  переключать пять сервисов, чтобы напечатать одну деталь.
                </p>
              </div>
              <CtaLink href="/tools" variant="outline">
                Центр инструментов
                <span aria-hidden>→</span>
              </CtaLink>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
              {ECO_CARDS.map((card) => {
                const tone = TONE_STYLES[card.tone];

                return (
                  <Link
                    key={card.href}
                    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 hover:border-white/25 sm:p-7"
                    href={card.href}
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute -top-20 -right-16 h-40 w-40 rounded-full opacity-60 blur-3xl",
                        tone.glow,
                      )}
                    />
                    <span
                      className={cx(
                        "relative inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase",
                        tone.badge,
                      )}
                    >
                      {card.badge}
                    </span>
                    <h3 className="relative mt-4 text-xl font-extrabold tracking-tight text-white">
                      {card.title}
                    </h3>
                    <p className="relative mt-2 flex-1 text-sm leading-6 text-white/45">
                      {card.text}
                    </p>
                    <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 transition-colors group-hover:text-white">
                      Перейти
                      <span
                        aria-hidden
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Мастерская: главный Pro-инструмент, поэтому у неё своя секция. */}
        <section
          id="workshop"
          className="relative scroll-mt-24 overflow-hidden border-y border-white/[0.06]"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute top-[-10rem] left-1/2 h-[30rem] w-[40rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[130px]" />
            <div className="absolute right-[-10rem] bottom-[-10rem] h-72 w-72 rounded-full bg-blue-600/10 blur-[110px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-amber-300/80")}>
                  Мастерская
                </p>
                <h2 className={SECTION_TITLE}>
                  Рутина печатника —{" "}
                  <span className="text-white/35">в одном окне.</span>
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                  Заказы с Ozon, Wildberries и Яндекс Маркета, склад пластика,
                  принтеры и документы. Не таблицы в блокноте — рабочий процесс,
                  который напоминает о сроке и списывает материал.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <CtaLink href="/dashboard/workshop" size="lg">
                  Открыть мастерскую
                  <span aria-hidden>→</span>
                </CtaLink>
                <CtaLink href="/pricing" variant="ghost">
                  Подписка Pro
                </CtaLink>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
              {WORKSHOP_FEATURES.map((feature, index) => {
                const tone = TONE_STYLES[feature.tone];

                return (
                  <article
                    key={feature.title}
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-7"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute -top-20 -right-16 h-40 w-40 rounded-full opacity-60 blur-3xl",
                        tone.glow,
                      )}
                    />
                    <span className="relative font-mono text-xs font-semibold tracking-[0.2em] text-white/25 uppercase">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="relative mt-4 text-lg font-extrabold tracking-tight text-white">
                      {feature.title}
                    </h3>
                    <p className="relative mt-2 text-sm leading-6 text-white/45">
                      {feature.text}
                    </p>
                  </article>
                );
              })}
            </div>

            <p className="mt-8 max-w-3xl text-sm leading-6 text-white/35">
              Мастерская входит в подписку Pro вместе с конструктором, профилями
              и лимитами генератора. Курсы покупаются отдельно.
            </p>
          </div>
        </section>

        {/* Что можно собрать: названия моделей вместо абстрактных обещаний. */}
        <div className="border-y border-white/[0.06] bg-white/[0.01]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-5 py-4 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase sm:px-8">
            {MODEL_TYPES.map((type) => (
              <span key={type}>{MODEL_TYPE_LABELS[type]}</span>
            ))}
          </div>
        </div>

        {/* Как это работает: три видимых шага с крупными номерами. */}
        <section
          id="how"
          className="relative scroll-mt-24 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                Как это работает
              </p>
              <h2 className={SECTION_TITLE}>
                Три шага от фото до печати.{" "}
                <span className="text-white/35">Без моделирования вручную.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Оба инструмента дают один результат — STL. Разница только в
                том, откуда берётся форма: из фотографии или из параметров.
              </p>
            </div>

            <ol className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3 lg:mt-16">
              {STEPS.map((step) => {
                const tone = TONE_STYLES[step.tone];

                return (
                  <li
                    key={step.number}
                    className="group relative overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_-36px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-white/20 sm:p-8"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full opacity-70 blur-3xl",
                        tone.glow,
                      )}
                    />
                    <div className="relative flex items-start justify-between gap-4">
                      <span className="font-mono text-5xl leading-none font-extrabold tracking-tight text-white/10 sm:text-6xl">
                        {step.number}
                      </span>
                      <span
                        className={cx(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12",
                          tone.icon,
                        )}
                      >
                        <FeatureIcon name={step.icon} />
                      </span>
                    </div>
                    <h3 className="relative mt-6 text-xl font-extrabold tracking-tight text-white">
                      {step.title}
                    </h3>
                    <p className="relative mt-3 text-sm leading-6 text-white/45">
                      {step.text}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Демонстрация: реальные модели Конструктора и ссылка в галерею. */}
        <section
          id="demo"
          className="relative scroll-mt-24 border-b border-white/[0.06] bg-white/[0.012]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-violet-300/80")}>
                  Демонстрация
                </p>
                <h2 className={SECTION_TITLE}>
                  Модели, которые уже печатают.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                  {MODEL_TYPES.length}{" "}
                  {pluralize(MODEL_TYPES.length, MODEL_FORMS)} Конструктора с
                  параметрами и генератор по фото. Каждая карточка — реальная
                  модель TriDi, которую можно открыть и скачать как STL.
                </p>
              </div>
              <CtaLink href="/gallery" variant="outline">
                Смотреть всю галерею
                <span aria-hidden>→</span>
              </CtaLink>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:mt-16">
              {DEMO_MODELS.map((model) => (
                <figure
                  key={model.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 hover:border-white/20"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#0d0d0e]">
                    <Image
                      alt={`Модель «${model.name}» из Конструктора TriDi`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      height={400}
                      src={vaseRecipeImagePath(model.id)}
                      unoptimized
                      width={320}
                    />
                    <span className="absolute top-3 left-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase backdrop-blur">
                      Конструктор
                    </span>
                  </div>
                  <figcaption className="border-t border-white/[0.06] p-4">
                    <p className="text-sm font-semibold text-white">
                      {model.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">
                      {model.description}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>


        {/* Подписка Pro: одна карточка, полная витрина инструментов — на /pricing. */}
        <section id="pricing" className="relative scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-emerald-300/80")}>
                Подписка Pro
              </p>
              <h2 className={SECTION_TITLE}>
                Инструменты —{" "}
                <span className="text-white/35">по одной подписке.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Мастерская, конструктор, профили и лимиты генератора входят в
                один платёж. Курсы покупаются отдельно, токены — в генераторе.
              </p>
            </div>

            <article className="relative mt-12 overflow-hidden rounded-3xl border border-amber-300/25 border-t-amber-200/40 bg-[#0a0a0a] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-9">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-16 h-52 w-52 rounded-full bg-amber-500/15 blur-3xl"
              />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
                <div className="flex flex-col">
                  <span className={cx("w-fit rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase", TONE_STYLES.amber.badge)}>
                    Подписка Pro
                  </span>

                  <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {SUBSCRIPTION_PLAN.title}
                  </h3>
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                      {formatPrice(subscriptionPrice)} ₽
                    </span>
                    <span className="text-sm text-white/40">за 30 дней</span>
                  </p>

                  <p className="mt-4 text-sm leading-6 text-white/45">
                    Один платёж на 30 дней, продление ручное: каждый следующий
                    добавляет ещё 30. Курсы сюда не входят.
                  </p>

                  <div className="mt-6">
                    <CtaLink href="/pricing" fullWidth size="lg">
                      Выбрать тариф
                      <span aria-hidden>→</span>
                    </CtaLink>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.24em] text-white/35 uppercase">
                    Что входит
                  </p>
                  <ul className="mt-4 grid gap-2.5 text-sm leading-6 text-white/55 sm:grid-cols-2">
                    {PRO_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-5 text-white/30">
                    Токены докупаются в генераторе по фото, курсы — на странице
                    обучения.
                  </p>
                </div>
              </div>
            </article>

            <p className="mt-6 text-sm leading-6 text-white/35">
              Первая генерация Standard — бесплатно после регистрации. Полный
              список лимитов и условий — на странице{" "}
              <Link
                className="font-semibold text-white/70 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
                href="/pricing"
              >
                подписки Pro
              </Link>
              , цены уровней обучения — на странице{" "}
              <Link
                className="font-semibold text-white/70 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
                href="/subscription"
              >
                курсов
              </Link>
              .
            </p>
          </div>
        </section>


        {/* Для кого: самоидентификация до финального CTA. */}
        <section
          id="audience"
          className="relative scroll-mt-24 border-y border-white/[0.06] bg-white/[0.012]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                Для кого
              </p>
              <h2 className={SECTION_TITLE}>
                Печатникам, бизнесу{" "}
                <span className="text-white/35">и хобби.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Модель нужна трём разным людям с одной проблемой: без CAD её не
                сделать за вечер.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3 lg:mt-16">
              {AUDIENCE.map((item) => {
                const tone = TONE_STYLES[item.tone];

                return (
                  <article
                    key={item.title}
                    className="group relative overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 hover:border-white/20 sm:p-8"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full opacity-70 blur-3xl",
                        tone.glow,
                      )}
                    />
                    <span
                      className={cx(
                        "relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12",
                        tone.icon,
                      )}
                    >
                      <FeatureIcon name={item.icon} />
                    </span>
                    <h3 className="relative mt-6 text-xl font-extrabold tracking-tight text-white">
                      {item.title}
                    </h3>
                    <p className="relative mt-3 text-sm leading-6 text-white/45">
                      {item.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Обучение: курсы идут отдельным блоком — они не входят в подписку. */}
        <section className="relative" id="courses">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-violet-300/80")}>
                  Обучение
                </p>
                <h2 className={SECTION_TITLE}>
                  От распаковки принтера{" "}
                  <span className="text-white/35">до первых заказов.</span>
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                  {LEVELS.length} {pluralize(LEVELS.length, LEVEL_FORMS)},{" "}
                  {TOTAL_LESSONS} {pluralize(TOTAL_LESSONS, LESSON_FORMS)}, тесты и
                  сертификат. Первый уровень бесплатный, платные покупаются
                  навсегда и не входят в подписку Pro.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <CtaLink href="/start" variant="outline">
                  Начать бесплатно
                  <span aria-hidden>→</span>
                </CtaLink>
                <CtaLink href="/subscription" variant="ghost">
                  Курсы и цены
                </CtaLink>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
              {LEVELS.map((level) => (
                <Link
                  key={level.key}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 hover:border-white/25"
                  href={level.href}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold tracking-[0.2em] text-white/25 uppercase">
                      {level.code}
                    </span>
                    <span
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
                        level.isFree
                          ? TONE_STYLES.emerald.badge
                          : TONE_STYLES.violet.badge,
                      )}
                    >
                      {level.isFree ? "Бесплатно" : `${formatPrice(level.price)} ₽`}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight text-white">
                    {level.shortTitle}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-white/45">
                    {level.audience}
                  </p>
                  <p className="mt-4 text-xs leading-5 text-white/30">
                    {level.lessons} {pluralize(level.lessons, LESSON_FORMS)} ·{" "}
                    {level.hours}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 transition-colors group-hover:text-white">
                    Перейти
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>


        {/* Финальный CTA: тёмная панель со свечением и крупным заголовком. */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 pt-8 pb-20 sm:px-8 sm:pt-10 sm:pb-24 lg:pb-28">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#080808] px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_40px_120px_-60px_rgba(0,0,0,1)] sm:px-12 sm:py-20 lg:py-24">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-50 [mask-image:radial-gradient(ellipse_70%_85%_at_50%_50%,#000_10%,transparent_82%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute top-[-12rem] left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[120px]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute right-[-8rem] bottom-[-10rem] h-72 w-72 rounded-full bg-violet-500/15 blur-[110px]"
              />

              <div className="relative">
                <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                  Старт
                </p>
                <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-5xl md:text-6xl">
                  <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
                    Начните с модели или с заказа.
                  </span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                  Подключите Pro и откройте мастерскую — или сделайте первую
                  модель по фото: генерация Standard бесплатна.
                </p>

                <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <CtaLink href="/pricing" size="lg" className="group">
                    Подключить Pro
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </CtaLink>
                  <CtaLink href="/3d-generator" variant="outline" size="lg">
                    Сделать 3D-модель
                  </CtaLink>
                </div>

                <p className="mt-6 text-[11px] leading-5 text-white/30">
                  Мастерская · Конструктор · Профили · Генератор · Курсы отдельно
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

