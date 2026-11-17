import type { Metadata } from "next";
import Image from "next/image";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import { cx } from "@/components/ui/class-names";
import { VASE_RECIPES, vaseRecipeImagePath } from "@/data/vase-recipes";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import { MODEL_TYPES, MODEL_TYPE_LABELS } from "@/lib/constructor/model-types";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import { LEVELS, TOTAL_LESSONS } from "@/lib/course-levels";
import { defects } from "@/lib/defects";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-url";

/**
 * Главная объясняет платформу в том порядке, в котором человек принимает
 * решение: какая у него боль, чем мы её снимаем, что именно есть на сайте,
 * сколько это стоит и что будет после регистрации.
 *
 * Блоки идут лесенкой:
 *   1. герой — что можно сделать прямо сейчас;
 *   2. «Что решаем» — шесть типовых болей печатника и конкретный инструмент;
 *   3. «Инструменты» — полный каталог платформы, а не только генератор;
 *   4. «Как это работает» — три шага от идеи до STL;
 *   5. «Мастерская» — главный Pro-инструмент, разобранный по разделам;
 *   6. галерея — реальные модели вместо обещаний;
 *   7. «Для кого» — самоидентификация;
 *   8. тарифы — бесплатный старт, Pro и токены без скрытых условий;
 *   9. FAQ — возражения до оплаты;
 *  10. курсы — отдельный продукт, а не часть подписки;
 *  11. финальный CTA.
 *
 * Числа и цены не дублируются руками: модели — из `MODEL_TYPES`, профили — из
 * `lib/profiles`, дефекты — из `lib/defects`, лимиты — из правил списания,
 * цена Pro — из того же каталога, что у Robokassa (`getPaymentAmount`).
 * Превью галереи — реальные PNG Конструктора из `public/constructor/recipes`.
 */

/** Формы склонения: 10 моделей, 193 профиля, 6 дефектов, 4 уровня. */
const MODEL_FORMS: [string, string, string] = ["модель", "модели", "моделей"];
const PROFILE_FORMS: [string, string, string] = ["профиль", "профиля", "профилей"];
const DEFECT_FORMS: [string, string, string] = ["дефект", "дефекта", "дефектов"];
const LEVEL_FORMS: [string, string, string] = ["уровень", "уровня", "уровней"];

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

const PAGE_TITLE = "TriDi — 3D-модели для печати из фото и в конструкторе";

const PAGE_DESCRIPTION = `Создайте 3D-модель по 1–4 фото или в Конструкторе, скачайте STL и ведите заказы в Мастерской. ${MODEL_TYPES.length} моделей, ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати и справочник дефектов. Первая генерация — бесплатно.`;

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

/** Три шага от идеи до файла: одинаковые для фото и Конструктора. */
const STEPS: { icon: FeatureIconName; title: string; text: string }[] = [
  {
    icon: "photo",
    title: "Загрузите фото или выберите модель",
    text: "Генератор принимает JPEG, PNG и WebP с 1–4 ракурсами. В Конструкторе готовы вазы, брелоки, литофаны, вывески, кашпо и органайзеры: форму задают параметры, а не навык моделирования.",
  },
  {
    icon: "sliders",
    title: "Настройте размер и детали",
    text: "Покрутите модель в 3D, поменяйте высоту, узор, толщину стенки или подпись. Всё меняется слайдерами, поэтому не нужно открывать Blender и разбираться в CAD.",
  },
  {
    icon: "download",
    title: "Скачайте STL и печатайте",
    text: "Готовый файл открывается в Bambu Studio, OrcaSlicer, PrusaSlicer и Cura. Профиль печати под принтер и пластик можно взять в библиотеке, а расчёт веса — в карточке модели.",
  },
];

/**
 * Витрина показывает реальные PNG Конструктора: они лежат в
 * `public/constructor/recipes` и обновляются вместе с рецептами. Если рецепт
 * переименуют, карточка просто не отрисуется, а не сломает сборку.
 */
const DEMO_MODELS = [
  "japandi-ribs",
  "twisted-fluted",
  "moire-illusion",
  "scales-armor",
]
  .map((id) => VASE_RECIPES.find((recipe) => recipe.id === id))
  .filter((recipe): recipe is (typeof VASE_RECIPES)[number] => Boolean(recipe));

/** Кому какой сценарий ближе: блок помогает узнать себя до чтения тарифов. */
const AUDIENCE: { icon: FeatureIconName; title: string; text: string }[] = [
  {
    icon: "business",
    title: "Мастерская и ферма",
    text: "Заказы, склад и принтеры в одном окне. Видно, что печатается, что ждёт пластика и сколько стоит каждый заказ.",
  },
  {
    icon: "hobby",
    title: "Домашняя печать",
    text: "Модель по фото или параметрам — без CAD. Полезно, когда нужно быстро закрыть бытовую задачу и не учить Blender.",
  },
  {
    icon: "printer",
    title: "Продажи на маркетплейсах",
    text: "Заказы с Ozon, Wildberries и Яндекс Маркета, сроки и документы под рукой. Себестоимость считается до печати.",
  },
  {
    icon: "photo",
    title: "Только купили принтер",
    text: "Бесплатный первый уровень курса, справочник дефектов и форум. Понятный маршрут вместо случайных роликов.",
  },
];

type PainCard = {
  pain: string;
  title: string;
  text: string;
  href: string;
  linkLabel: string;
  tone: Tone;
};

/**
 * Шесть болей, с которыми приходят на TriDi: от «не умею моделировать» до
 * «не понимаю, сколько стоит заказ». У каждой — конкретный инструмент, а не
 * общее обещание «всё в одном».
 */
const PAINS: PainCard[] = [
  {
    pain: "Нет навыков 3D-моделирования",
    title: "Модель без Blender и CAD",
    text: "Генератор собирает форму по 1–4 фотографиям, Конструктор — по слайдерам. На выходе готовый STL, а не учебный проект.",
    href: "/3d-generator",
    linkLabel: "Генератор по фото",
    tone: "blue",
  },
  {
    pain: "Заказы живут в таблицах и переписках",
    title: "Одна доска вместо блокнота",
    text: "Заказы с Ozon, Wildberries и Яндекс Маркета приходят в Мастерскую: статусы, сроки, клиенты и документы рядом.",
    href: "/tools/workshop",
    linkLabel: "Мастерская",
    tone: "amber",
  },
  {
    pain: "Цена заказа считается «на глаз»",
    title: "Себестоимость до печати",
    text: "Калькулятор складывает пластик, электричество, амортизацию и работу. Прибыль видна до запуска, а не после.",
    href: "/tools/workshop",
    linkLabel: "Калькулятор в Мастерской",
    tone: "emerald",
  },
  {
    pain: "Пластик заканчивается в середине печати",
    title: "Склад предупреждает заранее",
    text: "Катушки, остаток в граммах и списание на заказ. Строка «пора докупить» появляется до простоя, а не после.",
    href: "/tools/workshop",
    linkLabel: "Склад и принтеры",
    tone: "violet",
  },
  {
    pain: "Печать идёт с браком, причины ищутся наугад",
    title: "Профили и разбор дефектов",
    text: "Готовые настройки под принтер и материал плюс справочник причин: от отрыва от стола до пропусков экструзии.",
    href: "/tools/defects",
    linkLabel: "Разобрать дефект",
    tone: "blue",
  },
  {
    pain: "Непонятно, с чего начать и у кого спросить",
    title: "Маршрут вместо поиска вслепую",
    text: "Бесплатный первый уровень курса, форум с разборами и галерея реальных моделей. Дальше — по шагам, без угадывания.",
    href: "/start",
    linkLabel: "Начать бесплатно",
    tone: "violet",
  },
];

type ToolCard = {
  href: string;
  category: string;
  title: string;
  text: string;
  meta: string;
  badge: string;
  tone: Tone;
};

/**
 * Каталог инструментов: не только генератор, а вся платформа. Порядок отражает
 * путь пользователя — создать модель, вести производство, печатать без брака,
 * спросить совета.
 */
const TOOLS: ToolCard[] = [
  {
    href: "/3d-generator",
    category: "Создать модель",
    title: "Генератор по фото",
    text: "1–4 снимка — сеть собирает 3D-модель, чистит сетку и приводит размер к 120 мм. Без ручной ретуши и платных плагинов.",
    meta: "На выходе: STL для слайсера",
    badge: "1 бесплатно",
    tone: "blue",
  },
  {
    href: "/constructor",
    category: "Создать модель",
    title: "Конструктор 3D",
    text: `${MODEL_TYPES.length} параметрических моделей: вазы, брелоки, вывески, литофаны, кашпо, органайзеры и термопринт.`,
    meta: "На выходе: STL, превью и расчёт веса",
    badge: `${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL/мес`,
    tone: "emerald",
  },
  {
    href: "/tools/workshop",
    category: "Вести производство",
    title: "Мастерская",
    text: "Заказы с маркетплейсов, склад пластика, ферма принтеров, клиенты и документы в одном окне.",
    meta: "Для регулярной работы",
    badge: "Pro",
    tone: "amber",
  },
  {
    href: "/profiles",
    category: "Печатать без брака",
    title: "Профили печати",
    text: `${profileCount} проверенных настроек принтеров и материалов для Bambu Studio, OrcaSlicer и PrusaSlicer.`,
    meta: "Скачивание в Pro · импорт в слайсер",
    badge: "Pro",
    tone: "violet",
  },
  {
    href: "/tools/defects",
    category: "Печатать без брака",
    title: "Справочник дефектов",
    text: `${defects.length} ${pluralize(defects.length, DEFECT_FORMS)} печати с причинами и пошаговыми решениями — от отрыва от стола до пропусков экструзии.`,
    meta: "Бесплатно и без входа",
    badge: "Бесплатно",
    tone: "blue",
  },
  {
    href: "/forum",
    category: "Спросить и обсудить",
    title: "Форум",
    text: "Разборы печати, настройки от участников и ответы на вопросы по конкретной модели. Можно спросить до покупки.",
    meta: "Бесплатно",
    badge: "Бесплатно",
    tone: "emerald",
  },
];

/**
 * Разделы Мастерской повторяют публичную витрину `/tools/workshop` и подсказки
 * `TAB_HELP`: главная не обещает вкладку, которой нет в продукте.
 */
const WORKSHOP_FEATURES: { title: string; text: string }[] = [
  {
    title: "Заказы и доска статусов",
    text: "Заказы с маркетплейсов и ручные в одной доске. Карточка переезжает: новый, в печати, готов, выдан.",
  },
  {
    title: "Склад пластика",
    text: "Катушки, остаток в граммах и порог «пора купить». Списание материала идёт при завершении печати.",
  },
  {
    title: "Ферма принтеров",
    text: "Станки с наработкой и регламентами ТО. Кнопка «Распределить» раздаёт задачи свободным принтерам.",
  },
  {
    title: "Себестоимость до печати",
    text: "Материал, электричество, амортизация и работа. Цена и прибыль видны до запуска, а не после.",
  },
  {
    title: "Документы заказа",
    text: "Спецификация и накладная собираются из заказа. Реквизиты вводятся один раз и подставляются сами.",
  },
  {
    title: "Клиенты и товары",
    text: "База клиентов с историей заказов. SKU маркетплейсов в карточке товара привязывают заказы сами.",
  },
];

/** Быстрый переход по длинной главной: восемь якорей вместо прокрутки наугад. */
const ANCHORS = [
  { href: "#problems", label: "Что решаем" },
  { href: "#tools", label: "Инструменты" },
  { href: "#how", label: "Как это работает" },
  { href: "#workshop", label: "Мастерская" },
  { href: "#gallery", label: "Галерея" },
  { href: "#pricing", label: "Цены" },
  { href: "#faq", label: "Вопросы" },
  { href: "#courses", label: "Курсы" },
];

type FaqItem = { question: string; answer: string };

/**
 * FAQ закрывает возражения, которые обычно всплывают уже на странице оплаты:
 * «это нейросеть или конструктор», «нужен ли CAD», «что бесплатно» и «чем Pro
 * отличается от курсов». Ответы не расходятся с лимитами и тарифами: числа
 * берутся из тех же констант, что у генератора и подписки.
 */
const FAQ: FaqItem[] = [
  {
    question: "TriDi — это нейросеть или конструктор?",
    answer:
      "И то, и другое. Генератор по фото собирает 3D-модель по 1–4 снимкам. Конструктор работает без нейросети: вы задаёте размеры, форму, узор и подпись, а модель строится по параметрам.",
  },
  {
    question: "Нужно ли уметь моделировать в Blender или CAD?",
    answer:
      "Нет. В Конструкторе все параметры меняются слайдерами, а генератору достаточно фотографий. На выходе — готовый STL для слайсера, а не проект, который ещё нужно дорабатывать.",
  },
  {
    question: "Сколько фотографий нужно генератору?",
    answer:
      "От одной до четырёх. Один снимок подойдёт для простой формы, несколько ракурсов дают более точную модель. Фото загружаются в JPEG, PNG или WebP.",
  },
  {
    question: "Что я получу на выходе?",
    answer:
      "STL-файл: очищенная сетка, размер приведён к 120 мм. Файл открывается в Bambu Studio, OrcaSlicer, PrusaSlicer и Cura — дальше печать идёт по вашим настройкам.",
  },
  {
    question: "Что можно попробовать бесплатно?",
    answer: `Первая генерация Standard по фото — бесплатно, в Конструкторе — ${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL в месяц. Справочник дефектов, форум и первый уровень курса тоже открыты без оплаты.`,
  },
  {
    question: "Чем подписка Pro отличается от курсов?",
    answer: `Pro открывает инструменты: Мастерскую, все ${MODEL_TYPES.length} моделей Конструктора, ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати и ${SUBSCRIPTION_PLAN.standardPerMonth} Standard + ${SUBSCRIPTION_PLAN.ultraPerMonth} Ultra в месяц. Курсы — отдельные программы с доступом навсегда, в подписку не входят.`,
  },
  {
    question: "Можно ли продавать изделия, напечатанные по моделям TriDi?",
    answer:
      "Да. В Pro лицензия включает печать и продажу изделий по своим моделям. Условия — в публичной оферте; для разовых задач можно купить пакет токенов без подписки.",
  },
  {
    question: "Нужен ли специальный принтер?",
    answer:
      "Подойдёт любой FDM-принтер, который печатает по STL. TriDi не заменяет слайсер: модель открывается в вашей программе, там же выбираются профиль, поддержки и температура.",
  },
  {
    question: "Где посмотреть Мастерскую до оплаты?",
    answer:
      "На странице Мастерской есть разбор всех разделов и демо-режим только для чтения. Демо открывается без оплаты и показывает заказы, склад и принтеры на тестовых данных.",
  },
  {
    question: "Как оплатить и получить чек?",
    answer:
      "Оплата картой через Robokassa. Исполнитель работает как плательщик НПД: чек формируется в приложении «Мой налог» и приходит на email. У Pro нет автосписаний: каждый следующий платёж добавляет 30 дней.",
  },
];

/** FAQPage для поиска: вопросы и ответы повторяют видимый блок, а не живут отдельно. */
function buildFaqJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "TriDi: частые вопросы о 3D-моделях, печати и оплате",
    url: `${siteUrl}/`,
    inLanguage: "ru",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** Тарифы на главной: коротко, с одной ссылкой на полную страницу оплаты. */
const PRICING_PLANS: {
  title: string;
  price: string;
  note: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  tone: Tone;
  featured?: boolean;
}[] = [
  {
    title: "Старт",
    price: "0 ₽",
    note: "без карты",
    description: "Попробовать инструменты и понять, подходит ли платформа.",
    features: [
      "1 бесплатная генерация Standard по фото",
      `${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL в Конструкторе в месяц`,
      "Справочник дефектов и форум",
      "История моделей в личном кабинете",
    ],
    cta: "Создать аккаунт",
    href: "/auth/sign-up",
    tone: "emerald",
  },
  {
    title: "Pro",
    price: `${formatPrice(subscriptionPrice)} ₽`,
    note: "за 30 дней",
    description: "Для регулярной печати и заказов: все инструменты и лимиты.",
    features: [
      "Мастерская: заказы, склад, принтеры, документы",
      `Все ${MODEL_TYPES.length} моделей и STL без лимита`,
      `Профили печати: ${profileCount} ${pluralize(profileCount, PROFILE_FORMS)}`,
      `${SUBSCRIPTION_PLAN.standardPerMonth} Standard + ${SUBSCRIPTION_PLAN.ultraPerMonth} Ultra в месяц`,
      "Печать и продажа изделий по своим моделям",
    ],
    cta: "Подключить Pro",
    href: "/pricing",
    tone: "amber",
    featured: true,
  },
  {
    title: "Токены",
    price: `от ${formatPrice(TOKEN_PACKS.standard.price)} ₽`,
    note: "разово",
    description: "Когда подписка не нужна: докупить генерации под задачу.",
    features: [
      `${TOKEN_PACKS.standard.quantity} Standard — ${formatPrice(TOKEN_PACKS.standard.price)} ₽`,
      `${TOKEN_PACKS.ultra.quantity} Ultra — ${formatPrice(TOKEN_PACKS.ultra.price)} ₽`,
      "Пакет не сгорает и не зависит от подписки",
      "Покупка в генераторе, без автосписаний",
    ],
    cta: "Открыть генератор",
    href: "/3d-generator",
    tone: "blue",
  },
];

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const siteUrl = await resolveSiteUrl();
  const faqJsonLd = buildFaqJsonLd(siteUrl);

  return (
    <div className="relative min-h-screen bg-[#030303] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      <main>
        {/* 1. Герой: что можно сделать прямо сейчас и с чего начать */}
        <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.18),transparent_46%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
            <div className="absolute -left-40 top-20 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[140px]" />
            <div className="absolute -right-40 top-40 h-[26rem] w-[26rem] rounded-full bg-violet-600/10 blur-[140px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-16 sm:px-8 sm:pb-16 sm:pt-20 lg:pt-24">
            <div className="mx-auto max-w-5xl text-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-white/60 backdrop-blur-xl">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Платформа для 3D-печати
                <span className="text-white/20">·</span>
                модели, мастерская и обучение
              </div>

              <h1 className="mt-7 text-balance text-[2.75rem] font-extrabold leading-[0.95] tracking-[-0.06em] sm:text-6xl lg:text-[5.5rem]">
                <span className="block text-white">3D-модель для печати</span>
                <span className="mt-2 block bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-transparent">
                  из фото или в конструкторе
                </span>
                <span className="mt-3 block text-2xl font-semibold tracking-[-0.03em] text-white/35 sm:text-3xl lg:text-4xl">
                  за вечер, без Blender и CAD
                </span>
              </h1>

              <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
                Загрузите 1–4 снимка — генератор соберёт форму и отдаст STL.
                Или соберите модель в Конструкторе из готовых форм:{" "}
                {MODEL_TYPE_LABELS.vase.toLowerCase()},{" "}
                {MODEL_TYPE_LABELS.keychain.toLowerCase()},{" "}
                {MODEL_TYPE_LABELS.lithophane.toLowerCase()},{" "}
                {MODEL_TYPE_LABELS.sign.toLowerCase()} и ещё{" "}
                {MODEL_TYPES.length - 4} моделей. Первая генерация — бесплатно.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <CtaLink
                  href="/3d-generator"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Сделать модель по фото
                  <span aria-hidden>→</span>
                </CtaLink>
                <CtaLink
                  href="/constructor"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Открыть конструктор
                </CtaLink>
              </div>

              {/*
                Честный шаг между кнопкой и продуктом: генератор и конструктор
                открываются только вошедшему. Без этой строки гость нажимает
                «бесплатно» и попадает на форму входа, не понимая, зачем она.
              */}
              <p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-white/45">
                Генератор и Конструктор открываются после бесплатной
                регистрации — без карты и оплаты. Демо Мастерской доступно
                сразу.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/40">
                <Link
                  href="/tools/workshop"
                  className="transition-colors hover:text-white"
                >
                  Мастерская для заказов
                </Link>
                <span aria-hidden className="text-white/15">
                  ·
                </span>
                <Link
                  href="/gallery"
                  className="transition-colors hover:text-white"
                >
                  Галерея моделей
                </Link>
                <span aria-hidden className="text-white/15">
                  ·
                </span>
                <Link
                  href="/tools"
                  className="transition-colors hover:text-white"
                >
                  Все инструменты →
                </Link>
              </div>

              <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-white/40">
                {[
                  "Без карты на старте",
                  `${MODEL_TYPES.length} моделей в Конструкторе`,
                  `${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} печати`,
                  "STL для любого слайсера",
                ].map((fact) => (
                  <li key={fact} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400/80" />
                    {fact}
                  </li>
                ))}
              </ul>

              <dl
                aria-label="TriDi в цифрах"
                className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-4"
              >
                {[
                  {
                    value: MODEL_TYPES.length,
                    label: `${pluralize(MODEL_TYPES.length, MODEL_FORMS)} в Конструкторе`,
                  },
                  {
                    value: profileCount,
                    label: `${pluralize(profileCount, PROFILE_FORMS)} печати`,
                  },
                  {
                    value: defects.length,
                    label: `${pluralize(defects.length, DEFECT_FORMS)} в справочнике`,
                  },
                  {
                    value: TOTAL_LESSONS,
                    label: `${pluralize(TOTAL_LESSONS, LESSON_FORMS)} в курсах`,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col-reverse gap-1 bg-[#050505]/90 px-4 py-5 backdrop-blur"
                  >
                    <dt className="text-xs leading-4 text-white/35">
                      {stat.label}
                    </dt>
                    <dd className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* 2. Быстрый переход: длинную главную можно листать по разделам */}
        <nav
          aria-label="Разделы главной"
          className="sticky top-[4.5rem] z-30 border-b border-white/[0.06] bg-[#030303]/85 backdrop-blur-xl"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 py-3 sm:px-8">
            <span className="mr-2 hidden shrink-0 text-[10px] font-semibold tracking-[0.18em] text-white/25 uppercase sm:block">
              На странице
            </span>
            {ANCHORS.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                {anchor.label}
              </a>
            ))}
          </div>
        </nav>

        {/* 3. Какие боли снимаем: сначала проблема, потом инструмент */}
        <section
          id="problems"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-blue-300")}>Что решаем</p>
                <h2 className={SECTION_TITLE}>
                  Печать упирается не в принтер, а в рутину
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Шесть типовых проблем печатника — и конкретный инструмент TriDi
                на каждую. Без переключения между пятью сервисами и таблицами.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PAINS.map((pain, index) => {
                const tone = TONE_STYLES[pain.tone];

                return (
                  <article
                    key={pain.title}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080808] p-6 transition-colors hover:border-white/15 sm:p-7"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                        tone.glow,
                      )}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] tracking-[0.18em] text-white/25">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
                          tone.badge,
                        )}
                      >
                        боль
                      </span>
                    </div>
                    <p className="relative mt-5 text-xs leading-5 text-white/35">
                      «{pain.pain}»
                    </p>
                    <h3 className="relative mt-3 text-lg font-extrabold tracking-tight text-white">
                      {pain.title}
                    </h3>
                    <p className="relative mt-2 flex-1 text-sm leading-6 text-white/45">
                      {pain.text}
                    </p>
                    <Link
                      href={pain.href}
                      className={cx(
                        "relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-white",
                        tone.text,
                      )}
                    >
                      {pain.linkLabel}
                      <span
                        aria-hidden
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-2xl text-sm leading-6 text-white/45">
                Не нашли свою боль? В каталоге — все инструменты с описанием,
                лимитами и бесплатными возможностями.
              </p>
              <CtaLink
                href="/tools"
                variant="outline"
                className="shrink-0 self-start sm:self-auto"
              >
                Каталог инструментов →
              </CtaLink>
            </div>
          </div>
        </section>

        {/* 4. Все инструменты: платформа целиком, а не только генератор */}
        <section
          id="tools"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-emerald-300")}>
                  Все инструменты
                </p>
                <h2 className={SECTION_TITLE}>
                  Один аккаунт — от идеи до готового заказа
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Создавайте модели, ведите производство и разбирайте дефекты.
                Бесплатные инструменты доступны без подписки.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((tool) => {
                const tone = TONE_STYLES[tool.tone];

                return (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080808] p-6 transition-colors hover:border-white/15 sm:p-7"
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                        tone.glow,
                      )}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
                          tone.badge,
                        )}
                      >
                        {tool.category}
                      </span>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-white/45">
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="relative mt-6 text-xl font-extrabold tracking-tight text-white">
                      {tool.title}
                    </h3>
                    <p className="relative mt-2 flex-1 text-sm leading-6 text-white/45">
                      {tool.text}
                    </p>
                    <p className="relative mt-5 border-t border-white/[0.07] pt-4 text-xs leading-5 text-white/30">
                      {tool.meta}
                    </p>
                    <span
                      className={cx(
                        "relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold",
                        tone.text,
                      )}
                    >
                      Перейти
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

            <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/45">
                  <span className="font-semibold text-white/70">
                    В Конструкторе:
                  </span>{" "}
                  {MODEL_TYPES.map((type) => MODEL_TYPE_LABELS[type]).join(" · ")}
                </p>
                <CtaLink
                  href="/constructor"
                  variant="outline"
                  className="shrink-0 self-start sm:self-auto"
                >
                  Открыть конструктор
                </CtaLink>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-5 rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-300 uppercase">
                  Ещё есть обучение
                </p>
                <p className="mt-2 text-lg font-extrabold tracking-tight text-white">
                  {LEVELS.length} {pluralize(LEVELS.length, LEVEL_FORMS)}: от
                  первого слоя до заработка
                </p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/45">
                  Первый уровень бесплатно, остальные — с доступом навсегда.
                  Курсы не входят в Pro и покупаются отдельно.
                </p>
              </div>
              <CtaLink
                href="#courses"
                variant="success"
                className="shrink-0 self-start sm:self-auto"
              >
                Посмотреть курсы →
              </CtaLink>
            </div>
          </div>
        </section>

        {/* 5. Как это работает: три шага, одинаковые для фото и параметров */}
        <section
          id="how"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-violet-300")}>
                Как это работает
              </p>
              <h2 className={SECTION_TITLE}>
                Три шага до файла, который можно печатать
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
                Не нужно устанавливать CAD, разбираться в топологии и покупать
                курсы по моделированию. Маршрут одинаковый для фото и
                Конструктора.
              </p>
            </div>

            <ol className="mt-12 grid gap-4 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-2xl border border-white/[0.07] bg-[#080808] p-6 sm:p-7"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className={cx(
                        "flex h-11 w-11 items-center justify-center rounded-xl border",
                        index === 0
                          ? TONE_STYLES.blue.icon
                          : index === 1
                            ? TONE_STYLES.violet.icon
                            : TONE_STYLES.emerald.icon,
                      )}
                    >
                      <FeatureIcon name={step.icon} />
                    </span>
                    <span
                      aria-hidden
                      className="font-mono text-3xl font-black text-white/[0.07]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
                <p className="text-base font-extrabold text-white">
                  Оба пути дают один результат — STL
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Генератор берёт форму с фотографий и чистит сетку. Конструктор
                  строит её по параметрам: высота, диаметр, узор, подпись.
                  Дальше — ваш слайсер и привычный профиль печати.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7">
                <p className="text-sm font-semibold text-white">
                  Не хотите начинать с фото?
                </p>
                <CtaLink href="/constructor" variant="outline" fullWidth>
                  Собрать по параметрам
                </CtaLink>
                <CtaLink href="/3d-generator" variant="ghost" fullWidth>
                  Загрузить фото →
                </CtaLink>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Мастерская: главный Pro-инструмент, разобранный по разделам */}
        <section
          id="workshop"
          className="relative scroll-mt-36 overflow-hidden border-b border-white/[0.06]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute -right-40 top-0 h-[28rem] w-[28rem] rounded-full bg-amber-500/[0.07] blur-[140px]" />
            <div className="absolute -left-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-emerald-500/[0.05] blur-[140px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16">
              <div>
                <p className={cx(SECTION_LABEL, "text-amber-300")}>
                  Главный Pro-инструмент
                </p>
                <h2 className={SECTION_TITLE}>
                  Мастерская: заказы, склад и принтеры в одном окне
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/45">
                  Заказы с маркетплейсов и ручные, остатки пластика, загрузка
                  станков, себестоимость и документы — в одной рабочей области.
                  Не нужно сводить таблицы вручную и вспоминать, какая катушка
                  стоит на каком принтере.
                </p>

                <ul className="mt-7 space-y-3">
                  {[
                    "Одна доска статусов вместо чатов и блокнотов",
                    "Списание пластика при завершении печати",
                    "Себестоимость и прибыль до запуска, а не после",
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
                  <CtaLink
                    href="/tools/workshop"
                    className="w-full sm:w-auto"
                  >
                    Что внутри мастерской →
                  </CtaLink>
                  <a
                    href="/api/demo/workshop"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/15 sm:w-auto"
                  >
                    Смотреть демо
                  </a>
                </div>
                <p className="mt-3 text-xs text-white/30">
                  Демо открывается без оплаты и работает только на чтение.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {WORKSHOP_FEATURES.map((feature, index) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-white/[0.07] bg-[#080808]/90 p-5 backdrop-blur"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] tracking-[0.18em] text-white/25">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
                    </div>
                    <h3 className="mt-4 text-sm font-extrabold tracking-tight text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      {feature.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
              <p className="text-sm leading-6 text-white/45">
                <span className="font-semibold text-white/70">
                  Честно о границах:
                </span>{" "}
                Мастерская не заменяет слайсер и бухгалтерию. Модель режется в
                вашей программе, а налоги и чеки остаются в сторонних сервисах.
                TriDi закрывает заказы, материалы, станки и документы вокруг
                печати.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Галерея: реальные модели Конструктора вместо абстрактных обещаний */}
        <section
          id="gallery"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-blue-300")}>Результат</p>
                <h2 className={SECTION_TITLE}>
                  Модели, которые можно напечатать сегодня
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Это превью из Конструктора: форму, рельеф и пропорции можно
                поменять слайдерами и сразу скачать STL.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {DEMO_MODELS.map((model) => (
                <Link
                  key={model.id}
                  href="/constructor"
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080808] transition-colors hover:border-white/15"
                >
                  <div className="aspect-square overflow-hidden bg-[#0d0d0d]">
                    <Image
                      src={vaseRecipeImagePath(model.id)}
                      alt={`3D-модель вазы ${model.name}`}
                      width={600}
                      height={600}
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-white">
                      {model.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/35">
                      {model.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-2xl text-sm leading-6 text-white/45">
                Понравилась форма? Откройте её в Конструкторе, поменяйте высоту
                и узор, затем скачайте STL — без регистрации в CAD-программе.
              </p>
              <CtaLink
                href="/gallery"
                variant="outline"
                className="shrink-0 self-start sm:self-auto"
              >
                Смотреть галерею →
              </CtaLink>
            </div>
          </div>
        </section>

        {/* 8. Для кого: помогает узнать себя до чтения тарифов */}
        <section className="relative border-b border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-emerald-300")}>
                Для кого
              </p>
              <h2 className={SECTION_TITLE}>
                Один аккаунт для дома и мастерской
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
                Начните с одной модели для себя или сразу ведите поток заказов.
                Инструменты включаются по мере роста, а не требуют покупать всё
                сразу.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AUDIENCE.map((item) => (
                <article
                  key={item.title}
                  className="flex flex-col rounded-2xl border border-white/[0.07] bg-[#080808] p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-300">
                    <FeatureIcon name={item.icon} />
                  </span>
                  <h3 className="mt-5 text-base font-extrabold tracking-tight text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Тарифы: бесплатный старт, Pro и токены без скрытых условий */}
        <section
          id="pricing"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-amber-300")}>Тарифы</p>
                <h2 className={SECTION_TITLE}>
                  Начните бесплатно, платите за регулярную работу
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Бесплатный старт без карты, Pro — один платёж на 30 дней, токены
                — разово и не сгорают. Курсы покупаются отдельно.
              </p>
            </div>

            <div className="mt-12 grid items-start gap-4 lg:grid-cols-3">
              {PRICING_PLANS.map((plan) => {
                const tone = TONE_STYLES[plan.tone];

                return (
                  <article
                    key={plan.title}
                    className={cx(
                      "relative flex h-full flex-col rounded-3xl border p-6 sm:p-7",
                      plan.featured
                        ? "border-amber-400/30 bg-gradient-to-b from-amber-500/[0.08] to-[#080808] shadow-[0_30px_80px_-40px_rgba(245,158,11,0.35)]"
                        : "border-white/[0.07] bg-[#080808]",
                    )}
                  >
                    {plan.featured && (
                      <span className="absolute -top-3 left-6 rounded-full border border-amber-400/30 bg-[#1a1405] px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-amber-200 uppercase">
                        Выбор мастерских
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-extrabold tracking-tight text-white">
                        {plan.title}
                      </h3>
                      <span className="text-xs text-white/35">{plan.note}</span>
                    </div>
                    <p className="mt-5 text-4xl font-extrabold tracking-tight text-white">
                      {plan.price}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/45">
                      {plan.description}
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm leading-6 text-white/55"
                        >
                          <Check className={cx("mt-1", tone.text)} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <CtaLink
                      href={plan.href}
                      variant={plan.featured ? "light" : "outline"}
                      fullWidth
                      className="mt-7"
                    >
                      {plan.cta}
                    </CtaLink>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-2xl text-sm leading-6 text-white/45">
                Полные лимиты, условия оплаты и чеки — на странице тарифов.
                Курсы покупаются отдельно и не входят в подписку Pro.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <Link
                  href="/pricing"
                  className="text-white transition-colors hover:text-amber-300"
                >
                  Все тарифы и лимиты →
                </Link>
                <Link
                  href="/subscription"
                  className="text-white/45 transition-colors hover:text-white"
                >
                  Курсы →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 10. FAQ: возражения до оплаты, с разметкой FAQPage */}
        <section
          id="faq"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-blue-300")}>Вопросы</p>
                <h2 className={SECTION_TITLE}>
                  Вопросы, которые обычно задают до оплаты
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                Коротко о моделировании, лимитах, лицензии и оплате. Если
                вопроса нет в списке — спросите на форуме.
              </p>
            </div>

            <div className="mt-12 grid items-start gap-3 lg:grid-cols-2">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-white/[0.07] bg-[#080808] px-5 py-4 transition-colors open:border-white/20 sm:px-6 sm:py-5"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm leading-6 font-semibold text-white sm:text-base [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden
                      className="shrink-0 text-sm text-white/35 transition-transform duration-200 group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-2xl text-sm leading-6 text-white/45">
                Не нашли ответ? На форуме разбирают конкретные модели, настройки
                и дефекты печати.
              </p>
              <CtaLink
                href="/forum"
                variant="outline"
                className="shrink-0 self-start sm:self-auto"
              >
                Открыть форум →
              </CtaLink>
            </div>
          </div>
        </section>

        {/* 11. Курсы: три платных уровня и бесплатный, без кнопок покупки */}
        <section
          id="courses"
          className="relative scroll-mt-36 border-b border-white/[0.06]"
        >
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-violet-300")}>Обучение</p>
                <h2 className={SECTION_TITLE}>
                  Курсы, чтобы печатать увереннее и зарабатывать на этом
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/45 lg:pb-2">
                {LEVELS.length} {pluralize(LEVELS.length, LEVEL_FORMS)} и{" "}
                {TOTAL_LESSONS} уроков. Первый уровень бесплатный, платные
                открываются навсегда.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LEVELS.map((level) => (
                <Link
                  key={level.key}
                  href={level.href}
                  className={cx(
                    "group flex h-full flex-col rounded-2xl border p-6 transition-colors",
                    level.isFree
                      ? "border-emerald-400/20 bg-emerald-500/[0.04] hover:border-emerald-300/40"
                      : "border-white/[0.07] bg-[#080808] hover:border-white/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-white/25">
                      {level.code}
                    </span>
                    <span
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                        level.isFree
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-white/45",
                      )}
                    >
                      {level.isFree
                        ? "Бесплатно"
                        : `${formatPrice(level.price)} ₽`}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-extrabold tracking-tight text-white">
                    {level.shortTitle}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-white/35">
                    {level.audience}
                  </p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-white/45">
                    {level.goal}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4 text-center">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {level.lessons}
                      </p>
                      <p className="text-[10px] text-white/30">уроков</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {level.visuals}
                      </p>
                      <p className="text-[10px] text-white/30">схем</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {level.tests}
                      </p>
                      <p className="text-[10px] text-white/30">тестов</p>
                    </div>
                  </div>

                  <span
                    className={cx(
                      "mt-5 inline-flex items-center gap-1.5 text-sm font-semibold",
                      level.isFree ? "text-emerald-300" : "text-white/70",
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

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="max-w-2xl text-sm leading-6 text-white/45">
                Программа, демо-уроки и условия покупки — на странице курсов.
                Доступ к оплаченному уровню остаётся навсегда.
              </p>
              <Link
                href="/subscription"
                className="shrink-0 self-start text-sm font-semibold text-white transition-colors hover:text-violet-300 sm:self-auto"
              >
                Все курсы и программа →
              </Link>
            </div>
          </div>
        </section>

        {/* 12. Финальный CTA: последний шаг до первой модели */}
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
                <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                  Соберите первую модель сегодня — оплата не нужна
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/50 sm:text-base sm:leading-8">
                  Загрузите фото или откройте Конструктор. Первая генерация по
                  фото бесплатна,{" "}
                  {FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL в Конструкторе
                  доступны каждый месяц без карты.
                </p>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <CtaLink
                    href="/3d-generator"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Сделать модель по фото
                    <span aria-hidden>→</span>
                  </CtaLink>
                  <CtaLink
                    href="/constructor"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    Открыть конструктор
                  </CtaLink>
                </div>
                <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/35">
                  {[
                    "Без карты на старте",
                    "STL сразу после сборки",
                    `До ${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL в месяц`,
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
