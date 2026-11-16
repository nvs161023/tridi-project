import type { Metadata } from "next";
import Image from "next/image";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { cx } from "@/components/ui/class-names";
import { VASE_RECIPES, vaseRecipeImagePath } from "@/data/vase-recipes";
import { MODEL_TYPES, MODEL_TYPE_LABELS } from "@/lib/constructor/model-types";
import { LEVELS, TOTAL_LESSONS } from "@/lib/course-levels";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";

/**
 * Главная продаёт инструменты, а не курсы.
 *
 * Первый экран отвечает на вопрос «что я получу»: 3D-модель из фото или из
 * параметров и готовый STL для печати. Курсы остались одной строкой-мостиком в
 * конце — они не потеряны, но больше не занимают первый экран.
 *
 * Числа не дублируются руками: список моделей берётся из `MODEL_TYPES`, цена
 * подписки — из того же источника, что у Robokassa (`getPaymentAmount`), пакет
 * токенов — из `TOKEN_PACKS`. Превью галереи — реальные PNG Конструктора из
 * `public/constructor/recipes`, поэтому блок демонстрации не обещает модели,
 * которых нет.
 */
export const metadata: Metadata = {
  // Заголовок главной без шаблона: template из корневого layout действует
  // только на вложенные сегменты, поэтому бренд дописываем здесь сами.
  title: "TriDi — генератор 3D-моделей из фото и Конструктор",
  description: `Создайте 3D-модель из фотографии или настройте параметры в Конструкторе TriDi: ${MODEL_TYPES.length} моделей, готовый STL для 3D-печати и первая генерация бесплатно.`,
  alternates: { canonical: "/" },
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
    text: "Быстрая подготовка моделей к печати: без часов на построение сетки и без платных CAD-подписок.",
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

/** Возможности подписки Pro: лимиты берутся из тарифа, а не из текста. */
const PRO_FEATURES = [
  `Все ${MODEL_TYPES.length} моделей Конструктора`,
  `${SUBSCRIPTION_PLAN.standardPerMonth} генерации Standard и ${SUBSCRIPTION_PLAN.ultraPerMonth} Ultra каждый месяц`,
  "Безлимитный STL и библиотека профилей печати",
  "Отмена в любой момент, курсы не продлеваются",
];

/** Возможности пакета токенов: разовая покупка без срока действия. */
const PACK_FEATURES = [
  `${TOKEN_PACKS.standard.quantity} генераций Standard`,
  "Без подписки и без срока действия",
  "Подходит для генератора по фото",
  "Можно докупать сколько угодно",
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
                Конструктор 3D и генератор по фото
              </span>
            </div>

            <h1 className="mx-auto mt-7 max-w-5xl text-balance text-5xl leading-[0.95] font-extrabold tracking-[-0.05em] sm:text-6xl md:text-7xl xl:text-[5.5rem]">
              <span className="block bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
                Создайте 3D-модель
              </span>{" "}
              <span className="mt-1 block bg-gradient-to-r from-blue-200 via-violet-200 to-white bg-clip-text pb-2 text-transparent">
                из фото или параметров
              </span>{" "}
              <span className="block text-white/35">за 2 минуты</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-white/55 sm:mt-7 sm:text-lg sm:leading-8">
              Загрузите фото, получите готовый STL для 3D-печати. Или настройте
              вазу, брелок или литофан в нашем Конструкторе.
            </p>

            <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <CtaLink href="/3d-generator" size="lg" className="group">
                Попробовать генератор
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </CtaLink>
              <CtaLink href="/constructor" variant="outline" size="lg">
                Открыть Конструктор
              </CtaLink>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
              {[
                "Первая генерация бесплатно",
                "STL для 3D-печати",
                "Без CAD и Blender",
                "Карта не нужна",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400/80" />
                  {item}
                </li>
              ))}
            </ul>

            <dl className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] sm:mt-14 sm:grid-cols-4">
              {[
                { value: `${MODEL_TYPES.length}`, label: "моделей в Конструкторе" },
                { value: "AI", label: "генерация по фото" },
                { value: "STL", label: "формат для печати" },
                { value: "2 мин", label: "до первой модели" },
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
                  Более 10 параметрических моделей и безлимитные AI-генерации.
                  Каждая карточка — готовый STL из Конструктора.
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


        {/* Тарифы: подписка Pro и пакет токенов, полная витрина — на /pricing. */}
        <section id="pricing" className="relative scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-emerald-300/80")}>
                Тарифы
              </p>
              <h2 className={SECTION_TITLE}>
                Подписка на месяц{" "}
                <span className="text-white/35">или пакет генераций.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Подписка открывает оба инструмента и обновляет лимиты каждый
                месяц. Пакет покупается один раз и не сгорает.
              </p>
            </div>

            <div className="mt-12 grid items-stretch gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="relative flex flex-col overflow-hidden rounded-3xl border border-amber-300/25 border-t-amber-200/40 bg-[#0a0a0a] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-9">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -right-16 h-52 w-52 rounded-full bg-amber-500/15 blur-3xl"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <span className={cx("rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase", TONE_STYLES.amber.badge)}>
                    Подписка
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-white/30 uppercase">
                    оба инструмента
                  </span>
                </div>

                <h3 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {SUBSCRIPTION_PLAN.title}
                </h3>
                <p className="relative mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                    {formatPrice(subscriptionPrice)} ₽
                  </span>
                  <span className="text-sm text-white/40">за 30 дней</span>
                </p>

                <ul className="relative mt-6 space-y-2.5 text-sm leading-6 text-white/55">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 text-amber-300" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto pt-8">
                  <CtaLink href="/pricing" fullWidth size="lg">
                    Выбрать тариф
                    <span aria-hidden>→</span>
                  </CtaLink>
                </div>
              </article>

              <article className="relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-9">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -left-16 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <span className={cx("rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase", TONE_STYLES.blue.badge)}>
                    {TOKEN_PACKS.standard.title}
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-white/30 uppercase">
                    разовая покупка
                  </span>
                </div>

                <h3 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Пакет токенов
                </h3>
                <p className="relative mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                    {formatPrice(TOKEN_PACKS.standard.price)} ₽
                  </span>
                  <span className="text-sm text-white/40">
                    за {TOKEN_PACKS.standard.quantity} генераций
                  </span>
                </p>

                <ul className="relative mt-6 space-y-2.5 text-sm leading-6 text-white/55">
                  {PACK_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 text-blue-300" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="relative mt-auto pt-8">
                  <CtaLink href="/pricing" variant="outline" fullWidth size="lg">
                    Выбрать тариф
                  </CtaLink>
                </div>
              </article>
            </div>

            <p className="mt-6 text-sm leading-6 text-white/35">
              Первая генерация Standard — бесплатно после регистрации. Полный
              список возможностей, лимитов и пакетов — на странице{" "}
              <Link
                className="font-semibold text-white/70 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
                href="/pricing"
              >
                тарифов
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

        {/* Мостик к курсам: они не потеряны, но больше не занимают первый экран. */}
        <section className="relative">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-14">
            <div className="max-w-2xl">
              <p className={cx(SECTION_LABEL, "text-white/35")}>Обучение</p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Хотите не только генерировать, но и печатать осознанно?
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/45">
                Курсы по 3D-печати — отдельно и навсегда: {LEVELS.length} уровня,{" "}
                {TOTAL_LESSONS} уроков и сертификат после тестов.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <CtaLink href="/start" variant="outline">
                Перейти к обучению
                <span aria-hidden>→</span>
              </CtaLink>
              <CtaLink href="/subscription" variant="ghost">
                Тарифы курсов
              </CtaLink>
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
                    Первый STL — за две минуты.
                  </span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                  Загрузите фото или откройте Конструктор. Первая генерация
                  бесплатно, карта не нужна.
                </p>

                <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <CtaLink href="/3d-generator" size="lg" className="group">
                    Попробовать генератор
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </CtaLink>
                  <CtaLink href="/constructor" variant="outline" size="lg">
                    Открыть Конструктор
                  </CtaLink>
                </div>

                <p className="mt-6 text-[11px] leading-5 text-white/30">
                  Первая генерация бесплатно · STL для печати · Без CAD и
                  Blender
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

