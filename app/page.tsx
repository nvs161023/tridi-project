import type { Metadata } from "next";
import Image from "next/image";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { cx } from "@/components/ui/class-names";
import { VASE_RECIPES, vaseRecipeImagePath } from "@/data/vase-recipes";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import { MODEL_TYPES } from "@/lib/constructor/model-types";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { LEVELS, TOTAL_LESSONS } from "@/lib/course-levels";
import { defects } from "@/lib/defects";
import { SUBSCRIPTION_PLAN } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";

/**
 * Главная собрана из восьми блоков вместо каталога разделов:
 *   1. hero — что делает платформа и с чего начать;
 *   2. полный цикл — изучи → создай → подготовь → напечатай → зарабатывай;
 *   3. инструменты — шесть карточек, генератор и Конструктор выделены;
 *   4. печать без экспериментов — профили и диагностика дефектов;
 *   5. Мастерская — реальные скриншоты и демо без оплаты;
 *   6. обучение — четыре уровня с ценами из каталога курсов;
 *   7. тарифы — только Free и Pro, токены остаются ссылкой на /pricing;
 *   8. финальный CTA — начать бесплатно.
 *
 * Правила страницы:
 *   — один CTA на блок, остальное — карточки и текстовые ссылки;
 *   — в каждом блоке не больше трёх предложений подряд;
 *   — все цифры считаются из lib/* и data/*, а не пишутся руками;
 *   — изображения — реальный продукт: фотография готового изделия,
 *     модели Конструктора и скриншоты Мастерской из public, у каждого есть alt.
 */

/** Формы склонения: 10 моделей, 193 профиля, 6 дефектов. */
const MODEL_FORMS: [string, string, string] = ["модель", "модели", "моделей"];
const PROFILE_FORMS: [string, string, string] = ["профиль", "профиля", "профилей"];
const DEFECT_FORMS: [string, string, string] = ["дефект", "дефекта", "дефектов"];

/** Цена в рублях с разделителями разрядов: 500 → «500», 1 486 → «1 486». */
const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** Сумма подписки Pro: та же, что уходит в Robokassa, без копии цены. */
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

const PAGE_TITLE = "TriDi — 3D-модели для печати из фото и в конструкторе";

const PAGE_DESCRIPTION = `Всё для 3D-печати: генератор по фото, Конструктор, Мастерская и обучение. ${MODEL_TYPES.length} ${pluralize(MODEL_TYPES.length, MODEL_FORMS)} и ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати, первая генерация — бесплатно.`;

export const metadata: Metadata = {
  // Заголовок главной без шаблона: template из корневого layout действует
  // только на вложенные сегменты, поэтому бренд дописываем здесь сами.
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  // Свои openGraph и twitter: иначе в мессенджере развернулась бы карточка
  // генератора, а og:url указывал бы на вложенную страницу.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        ...OG_IMAGE,
        alt: "TriDi: 3D-модели по фото, Конструктор и Мастерская для 3D-печати",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE.url,
        alt: "TriDi: 3D-модели по фото, Конструктор и Мастерская для 3D-печати",
      },
    ],
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
 * CTA главной: белая кнопка с чёрным текстом, стеклянная вторичная и мягкая
 * зелёная для демо. Отдельный компонент не меняет UI-кит внутренних страниц.
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

/** Иконки шагов и инструментов: одна карта путей на всю страницу. */
type FeatureIconName =
  | "photo"
  | "sliders"
  | "download"
  | "printer"
  | "business"
  | "book"
  | "cube"
  | "alert"
  | "chat"
  | "wallet";

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
  book: (
    <>
      <path d="M19 3H6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h13z" />
      <path d="M8 7h6" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 20h18z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  chat: (
    <>
      <path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.2" />
    </>
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
 * Результаты Конструктора рядом с шагами: доказательство вместо отдельной
 * секции галереи. Если рецепт переименуют, карточка просто не отрисуется.
 */
const CYCLE_MODELS = ["twisted-fluted", "moire-illusion", "scales-armor"]
  .map((id) => VASE_RECIPES.find((recipe) => recipe.id === id))
  .filter((recipe): recipe is (typeof VASE_RECIPES)[number] => Boolean(recipe));

type CycleStep = {
  icon: FeatureIconName;
  title: string;
  text: string;
};

/** Пять шагов полного цикла: у каждого — реальный инструмент платформы. */
const CYCLE: CycleStep[] = [
  {
    icon: "book",
    title: "Изучи",
    text: `${TOTAL_LESSONS} ${pluralize(TOTAL_LESSONS, LESSON_FORMS)} курса и справочник дефектов: от первого слоя до настройки профиля. Первый уровень бесплатно.`,
  },
  {
    icon: "cube",
    title: "Создай",
    text: `1–4 фото в генераторе или ${MODEL_TYPES.length} ${pluralize(MODEL_TYPES.length, MODEL_FORMS)} Конструктора: форма, узор и подпись меняются слайдерами.`,
  },
  {
    icon: "sliders",
    title: "Подготовь",
    text: `STL и ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати под принтер и пластик: импорт в Bambu Studio, OrcaSlicer и PrusaSlicer.`,
  },
  {
    icon: "printer",
    title: "Напечатай",
    text: `Печать идёт в вашем слайсере, а ${defects.length} ${pluralize(defects.length, DEFECT_FORMS)} в справочнике объясняют, что делать при браке.`,
  },
  {
    icon: "wallet",
    title: "Зарабатывай",
    text: "Заказы, склад и себестоимость в Мастерской: прибыль видна до запуска печати, а не после.",
  },
];

type ToolCard = {
  href: string;
  title: string;
  text: string;
  badge: string;
  tone: Tone;
  icon: FeatureIconName;
};

type ToolGroup = {
  label: string;
  note: string;
  featured: boolean;
  tools: ToolCard[];
};

/**
 * Шесть инструментов, сгруппированных по смыслу. Первая группа — создание
 * модели, ради неё человек и приходит; вторая — печать и заказы.
 */
const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Создать модель",
    note: "Два способа получить STL без Blender и CAD.",
    featured: true,
    tools: [
      {
        href: "/3d-generator",
        title: "Генератор по фото",
        text: "1–4 снимка — сеть собирает форму, чистит сетку и отдаёт STL размером 120 мм.",
        badge: `${SUBSCRIPTION_PLAN.freeStandardGenerations} бесплатно`,
        tone: "blue",
        icon: "photo",
      },
      {
        href: "/constructor",
        title: "Конструктор 3D",
        text: `${MODEL_TYPES.length} параметрических моделей: вазы, брелоки, вывески, литофаны, кашпо и органайзеры.`,
        badge: `${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL/мес`,
        tone: "emerald",
        icon: "sliders",
      },
    ],
  },
  {
    label: "Печатать и вести заказы",
    note: "Когда модель готова, начинается производство.",
    featured: false,
    tools: [
      {
        href: "/tools/workshop",
        title: "Мастерская",
        text: "Заказы, склад пластика, ферма принтеров и документы.",
        badge: "Pro",
        tone: "amber",
        icon: "business",
      },
      {
        href: "/profiles",
        title: "Профили печати",
        text: `${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} принтеров и материалов для трёх слайсеров.`,
        badge: "Pro",
        tone: "violet",
        icon: "printer",
      },
      {
        href: "/tools/defects",
        title: "Справочник дефектов",
        text: `${defects.length} ${pluralize(defects.length, DEFECT_FORMS)} с причинами и пошаговыми решениями.`,
        badge: "Бесплатно",
        tone: "blue",
        icon: "alert",
      },
      {
        href: "/forum",
        title: "Форум",
        text: "Разборы печати, настройки и ответы по конкретным моделям.",
        badge: "Бесплатно",
        tone: "emerald",
        icon: "chat",
      },
    ],
  },
];

type PrintHelpCard = {
  href: string;
  title: string;
  text: string;
  cta: string;
  tone: Tone;
  icon: FeatureIconName;
};

/** Два инструмента, которые убирают брак до и после печати. */
const PRINT_HELP: PrintHelpCard[] = [
  {
    href: "/profiles",
    title: "Профили печати",
    text: "Готовые настройки для принтеров и пластика. Стабильный результат без проб и ошибок.",
    cta: "Открыть профили",
    tone: "violet",
    icon: "printer",
  },
  {
    href: "/tools/defects",
    title: "Диагностика дефектов",
    text: "База проблем и решений. Узнай, почему деталь отклеилась, и исправь настройки.",
    cta: "Открыть справочник",
    tone: "blue",
    icon: "alert",
  },
];

type WorkshopShot = {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
};

/** Реальные скриншоты Мастерской: 2160×1725, сняты с рабочего интерфейса. */
const WORKSHOP_SHOTS: WorkshopShot[] = [
  {
    src: "/workshop/orders.jpg",
    alt: "Доска заказов в Мастерской TriDi: статусы, сроки, клиенты и суммы",
    caption: "Заказы и доска статусов",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/stock.jpg",
    alt: "Склад пластика в Мастерской TriDi: катушки, остаток в граммах и порог закупки",
    caption: "Склад пластика",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/printers.jpg",
    alt: "Ферма принтеров в Мастерской TriDi: загрузка станков и наработка",
    caption: "Ферма принтеров",
    width: 2160,
    height: 1725,
  },
];

/** Что входит в Pro: вся экосистема одним пакетом. */
const PRO_FEATURES = [
  `Все ${MODEL_TYPES.length} ${pluralize(MODEL_TYPES.length, MODEL_FORMS)} безлимитно`,
  `${SUBSCRIPTION_PLAN.standardPerMonth} Standard + ${SUBSCRIPTION_PLAN.ultraPerMonth} Ultra генерации в месяц`,
  "Профили печати для принтеров и пластика",
  "Мастерская: заказы, склад, принтеры и документы",
];

/** Что входит в Free: попробовать платформу и пройти первый курс. */
const FREE_FEATURES = [
  `Доступ к Конструктору (${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL в месяц)`,
  `${SUBSCRIPTION_PLAN.freeStandardGenerations} бесплатная генерация по фото`,
  "Бесплатный курс",
];

/** Акценты пяти шагов: цвет помогает читать цикл слева направо. */
const STEP_TONES: Tone[] = ["blue", "violet", "emerald", "amber", "blue"];

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#030303] text-white">
      <Header />

      <main>
        {/* 1. Hero: оффер, один CTA и реальная модель вместо абстракции */}
        <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.18),transparent_46%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
            <div className="absolute -left-40 top-20 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[140px]" />
            <div className="absolute -right-40 top-40 h-[26rem] w-[26rem] rounded-full bg-violet-600/10 blur-[140px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:pt-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-white/60 backdrop-blur-xl">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Модели, печать и заказы в одном месте
                </div>

                <h1 className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
                  <span className="block text-white">От идеи до готового изделия.</span>
                  <span className="mt-2 block bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-transparent">
                    Всё для 3D-печати в одном месте
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
                  Создавай 3D-модели с помощью ИИ, проектируй собственные
                  изделия, находи готовые профили печати, учись новому и управляй
                  своей 3D-мастерской.
                </p>

                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <CtaLink
                    href="/3d-generator"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Сделать модель по фото
                    <span aria-hidden>→</span>
                  </CtaLink>
                  <Link
                    href="/constructor"
                    className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
                  >
                    Или соберите в Конструкторе →
                  </Link>
                </div>

                <Link
                  href="/auth/login"
                  className="mt-4 inline-flex text-xs font-semibold text-white/40 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Уже есть аккаунт? Войти
                </Link>

                <p className="mt-4 max-w-xl text-xs leading-5 text-white/40">
                  Первая генерация — бесплатно. Генератор и Конструктор
                  открываются после бесплатной регистрации, без карты.
                </p>
              </div>

              <figure className="relative mx-auto w-full max-w-xl">
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-3">
                  <Image
                    src="/hero-real-vase.png"
                    alt="Готовая 3D-печатная ваза с растением на столе рядом с 3D-принтером"
                    width={1536}
                    height={1024}
                    priority
                    sizes="(max-width: 1024px) 92vw, 560px"
                    className="aspect-[3/2] h-auto w-full rounded-[1.5rem] bg-[#0d0d0d] object-cover"
                  />
                </div>
                <figcaption className="mt-3 text-center text-xs text-white/30">
                  Напечатано на 3D-принтере. Готовый STL можно скачать в
                  Конструкторе
                </figcaption>
              </figure>
            </div>
          </div>
        </section>


        {/* 2. Полный цикл: пять шагов и три реальных результата */}
        <section className="relative border-b border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-violet-300")}>
                Полный цикл
              </p>
              <h2 className={SECTION_TITLE}>
                Изучите, создайте, напечатайте — и заработайте
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
                Пять шагов закрывают путь целиком: обучение, модель, профиль
                печати, печать и заказы. Каждый шаг — отдельный инструмент, а не
                обещание «всё в одном».
              </p>
            </div>

            <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CYCLE.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-2xl border border-white/[0.07] bg-[#080808] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cx(
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        TONE_STYLES[STEP_TONES[index] ?? "blue"].icon,
                      )}
                    >
                      <FeatureIcon name={step.icon} />
                    </span>
                    <span
                      aria-hidden
                      className="font-mono text-2xl font-black text-white/[0.07]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-extrabold tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex flex-col gap-6 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Так выглядит результат
                </p>
                <p className="mt-1 text-xs leading-5 text-white/35">
                  Превью из Конструктора — форму и рельеф можно поменять
                  слайдерами.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  {CYCLE_MODELS.map((model) => (
                    <figure key={model.id}>
                      <Image
                        src={vaseRecipeImagePath(model.id)}
                        alt={`3D-модель вазы ${model.name} из Конструктора TriDi`}
                        width={320}
                        height={400}
                        sizes="(max-width: 640px) 30vw, 140px"
                        className="h-auto w-full rounded-xl border border-white/[0.07] bg-[#0d0d0d] object-cover"
                      />
                      <figcaption className="mt-2 truncate text-[11px] text-white/35">
                        {model.name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
              <Link
                href="/gallery"
                className="shrink-0 text-sm font-semibold text-white transition-colors hover:text-violet-300 lg:self-center"
              >
                Все модели в галерее →
              </Link>
            </div>
          </div>
        </section>


        {/* 3. Инструменты: шесть карточек, создание модели выделено */}
        <section
          id="tools"
          className="relative scroll-mt-24 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-emerald-300")}>
                  Инструменты
                </p>
                <h2 className={SECTION_TITLE}>
                  Шесть инструментов на одном аккаунте
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Создавайте модель, печатайте без брака и ведите заказы.
                Бесплатные инструменты доступны без подписки.
              </p>
            </div>

            <div className="mt-12 space-y-8">
              {TOOL_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="text-[11px] font-semibold tracking-[0.2em] text-white/55 uppercase">
                      {group.label}
                    </h3>
                    <p className="text-xs text-white/35">{group.note}</p>
                  </div>

                  <div
                    className={cx(
                      "mt-4 grid gap-4 sm:grid-cols-2",
                      !group.featured && "lg:grid-cols-4",
                    )}
                  >
                    {group.tools.map((tool) => {
                      const tone = TONE_STYLES[tool.tone];

                      return (
                        <Link
                          key={tool.title}
                          href={tool.href}
                          className={cx(
                            "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-[#080808] transition-colors hover:border-white/20",
                            group.featured
                              ? "border-white/[0.12] bg-gradient-to-br from-white/[0.05] to-[#080808] p-6 sm:p-7"
                              : "border-white/[0.07] p-5",
                          )}
                        >
                          <div
                            aria-hidden
                            className={cx(
                              "absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                              tone.glow,
                            )}
                          />
                          <div className="relative flex items-start justify-between gap-3">
                            <span
                              className={cx(
                                "flex h-10 w-10 items-center justify-center rounded-xl border",
                                tone.icon,
                              )}
                            >
                              <FeatureIcon name={tool.icon} />
                            </span>
                            <span
                              className={cx(
                                "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                                tone.badge,
                              )}
                            >
                              {tool.badge}
                            </span>
                          </div>
                          <h4
                            className={cx(
                              "relative mt-5 font-extrabold tracking-tight text-white",
                              group.featured ? "text-xl" : "text-base",
                            )}
                          >
                            {tool.title}
                          </h4>
                          <p className="relative mt-2 flex-1 text-sm leading-6 text-white/45">
                            {tool.text}
                          </p>
                          <span
                            className={cx(
                              "relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold",
                              tone.text,
                            )}
                          >
                            Открыть
                            <span
                              aria-hidden
                              className="transition-transform duration-200 group-hover:translate-x-0.5"
                            >
                              →
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-start sm:justify-end">
              <CtaLink href="/tools" variant="outline">
                Все инструменты →
              </CtaLink>
            </div>
          </div>
        </section>


        {/* 4. Печать без экспериментов: профили и диагностика дефектов */}
        <section className="relative border-b border-white/[0.06] bg-white/[0.015]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-violet-300")}>
                Печать без лишних экспериментов
              </p>
              <h2 className={SECTION_TITLE}>
                Настрой печать правильно с первого раза
              </h2>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {PRINT_HELP.map((card) => {
                const tone = TONE_STYLES[card.tone];
                return (
                  <article
                    key={card.title}
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0a0a0a] p-6 sm:p-8"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-[90px]",
                        tone.glow,
                      )}
                    />
                    <span
                      className={cx(
                        "relative flex h-12 w-12 items-center justify-center rounded-2xl border",
                        tone.icon,
                      )}
                    >
                      <FeatureIcon name={card.icon} />
                    </span>
                    <h3 className="relative mt-6 text-2xl font-extrabold tracking-tight text-white">
                      {card.title}
                    </h3>
                    <p className="relative mt-3 flex-1 text-sm leading-7 text-white/50">
                      {card.text}
                    </p>
                    <CtaLink
                      href={card.href}
                      variant="outline"
                      className="relative mt-6 self-start"
                    >
                      {card.cta}
                      <span aria-hidden>→</span>
                    </CtaLink>
                  </article>
                );
              })}
            </div>
          </div>
        </section>


        {/* 5. Мастерская: главный Pro-инструмент и демо без оплаты */}
        <section
          id="workshop"
          className="relative scroll-mt-24 overflow-hidden border-b border-white/[0.06] bg-white/[0.015]"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 top-0 h-[28rem] w-[28rem] rounded-full bg-amber-500/[0.07] blur-[140px]" />
            <div className="absolute -left-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-emerald-500/[0.05] blur-[140px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
              <div>
                <p className={cx(SECTION_LABEL, "text-amber-300")}>
                  Главный Pro-инструмент
                </p>
                <h2 className={SECTION_TITLE}>
                  Заказы, пластик и принтеры — в одном окне
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/45">
                  Заказы с Ozon, Wildberries и Яндекс Маркета, остатки пластика,
                  загрузка станков и себестоимость до печати. Не нужно сводить
                  таблицы вручную.
                </p>

                <ul className="mt-6 space-y-3">
                  {[
                    "Одна доска статусов вместо чатов и блокнотов",
                    "Списание пластика при завершении печати",
                    "Себестоимость и прибыль до запуска",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm leading-6 text-white/55"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                        <Check className="h-3 w-3" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="/api/demo/workshop"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/15 sm:w-auto"
                  >
                    Открыть демо без оплаты
                    <span aria-hidden>→</span>
                  </a>
                  <Link
                    href="/tools/workshop"
                    className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
                  >
                    Все разделы Мастерской →
                  </Link>
                </div>
                <p className="mt-3 text-xs text-white/30">
                  Демо открывается без оплаты и работает только на чтение.
                </p>
              </div>

              <div className="grid gap-3">
                <figure>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080808]">
                    <Image
                      src={WORKSHOP_SHOTS[0].src}
                      alt={WORKSHOP_SHOTS[0].alt}
                      width={WORKSHOP_SHOTS[0].width}
                      height={WORKSHOP_SHOTS[0].height}
                      sizes="(max-width: 1024px) 100vw, 620px"
                      className="h-auto w-full"
                    />
                  </div>
                  <figcaption className="mt-2 text-xs text-white/35">
                    {WORKSHOP_SHOTS[0].caption}
                  </figcaption>
                </figure>

                <div className="grid grid-cols-2 gap-3">
                  {WORKSHOP_SHOTS.slice(1).map((shot) => (
                    <figure key={shot.src}>
                      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#080808]">
                        <Image
                          src={shot.src}
                          alt={shot.alt}
                          width={shot.width}
                          height={shot.height}
                          sizes="(max-width: 1024px) 50vw, 300px"
                          className="h-auto w-full"
                        />
                      </div>
                      <figcaption className="mt-2 text-[11px] text-white/35">
                        {shot.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* 6. Обучение: четыре уровня с реальными ценами */}
        <section
          id="training"
          className="relative scroll-mt-24 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-violet-300")}>
                  Обучение
                </p>
                <h2 className={SECTION_TITLE}>
                  Четыре уровня: от первого слоя до заработка
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Первый уровень бесплатный, остальные открываются навсегда и
                покупаются отдельно от Pro. {TOTAL_LESSONS}{" "}
                {pluralize(TOTAL_LESSONS, LESSON_FORMS)} с практикой и
                проверкой.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.map((level) => (
                <Link
                  key={level.key}
                  href={level.href}
                  className={cx(
                    "group flex h-full flex-col rounded-2xl border bg-[#080808] p-5 transition-colors hover:border-white/20",
                    level.isFree
                      ? "border-emerald-400/25"
                      : "border-white/[0.07]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-white/30">
                      {level.code}
                    </span>
                    <span
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        level.isFree
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-white/60",
                      )}
                    >
                      {level.isFree
                        ? "Бесплатно"
                        : `${formatPrice(level.price)} ₽`}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight text-white">
                    {level.shortTitle}
                  </h3>
                  <p className="mt-1 flex-1 text-xs leading-5 text-white/40">
                    {level.audience}
                  </p>
                  <span
                    className={cx(
                      "mt-4 inline-flex items-center gap-1.5 text-xs font-semibold",
                      level.isFree ? "text-emerald-300" : "text-white/60",
                    )}
                  >
                    {level.isFree ? "Начать бесплатно" : "Смотреть программу"}
                    <span
                      aria-hidden
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-xs leading-5 text-white/40">
                Курсы не входят в Pro: доступ к оплаченному уровню остаётся
                навсегда.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <CtaLink href="/start">Начать бесплатно</CtaLink>
                <Link
                  href="/subscription"
                  className="text-sm font-semibold text-white/60 transition-colors hover:text-white"
                >
                  Все курсы и программа →
                </Link>
              </div>
            </div>
          </div>
        </section>


        {/* 7. Тарифы: только Free и Pro, токены остаются ссылкой на /pricing */}
        <section
          id="pricing"
          className="relative scroll-mt-24 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-amber-300")}>Тарифы</p>
              <h2 className={SECTION_TITLE}>
                Старт бесплатно, Pro — {formatPrice(subscriptionPrice)} ₽ за 30
                дней
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
                Free — попробовать инструменты, Pro — вся экосистема: генератор,
                Конструктор, профили печати и Мастерская.
              </p>
            </div>

            <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-2">
              <article className="flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[#080808] p-6 sm:p-8">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-extrabold tracking-tight text-white">
                    Free
                  </h3>
                  <span className="text-xs text-white/35">навсегда</span>
                </div>
                <p className="mt-5 text-4xl font-extrabold tracking-tight text-white">
                  0 ₽
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Попробовать платформу без карты и обязательств.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {FREE_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-6 text-white/55"
                    >
                      <Check className="mt-1 text-emerald-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <CtaLink
                  href="/auth/sign-up"
                  variant="outline"
                  fullWidth
                  className="mt-8"
                >
                  Начать бесплатно
                </CtaLink>
              </article>

              <article className="relative flex h-full flex-col rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-500/[0.08] to-[#080808] p-6 shadow-[0_30px_80px_-40px_rgba(245,158,11,0.35)] sm:p-8">
                <span className="absolute -top-3 left-6 rounded-full border border-amber-400/30 bg-[#1a1405] px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-amber-200 uppercase">
                  Выбор мастерских
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-extrabold tracking-tight text-white">
                    Pro
                  </h3>
                  <span className="text-xs text-white/35">за 30 дней</span>
                </div>
                <p className="mt-5 text-4xl font-extrabold tracking-tight text-white">
                  {formatPrice(subscriptionPrice)} ₽
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Вся экосистема: генератор, Конструктор, профили и Мастерская.
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {PRO_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-6 text-white/55"
                    >
                      <Check className="mt-1 text-amber-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <CtaLink href="/pricing" fullWidth className="mt-8">
                  Выбрать тариф
                </CtaLink>
                <p className="mt-3 text-center text-[11px] text-white/35">
                  Продление ручное, без автосписаний.
                </p>
              </article>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/pricing#pricing-separate-title"
                className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-white/40 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Нужны только токены для генератора? Посмотреть пакеты →
              </Link>
            </div>
          </div>
        </section>


        {/* 8. Финальный CTA: один шаг до первой модели */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[26rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[150px]" />
            <div className="absolute bottom-0 right-0 h-[20rem] w-[24rem] rounded-full bg-violet-600/10 blur-[130px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] px-6 py-14 text-center sm:px-12 sm:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
              />
              <div className="relative">
                <p className={cx(SECTION_LABEL, "text-blue-300")}>
                  Начать можно за пять минут
                </p>
                <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                  Начните бесплатно — модель будет готова сегодня
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-7 text-white/50 sm:text-base sm:leading-8">
                  Загрузите 1–4 фото или соберите модель в Конструкторе. Первая
                  генерация бесплатно, без карты.
                </p>
                <div className="mt-8 flex justify-center">
                  <CtaLink
                    href="/auth/sign-up"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </CtaLink>
                </div>
                <p className="mt-4 text-xs text-white/35">
                  Регистрация нужна только для скачивания STL — демо Мастерской
                  открывается сразу.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
