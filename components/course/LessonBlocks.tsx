import Image from "next/image";

import { MiniCheck } from "@/components/course/MiniCheck";
import { LESSON_CARD } from "@/components/course/lesson-ui";
import { getVisualComponent } from "@/components/lesson-visuals";
import type { CourseKind, LessonBlock, LessonBlockStep } from "@/lib/types";

/**
 * Отрисовка блоков урока — общая для базового и продвинутого курса.
 *
 * Блоки описаны данными в data/lessons.json, data/course-pro.json и
 * data/course-confident.json, а здесь
 * лежит их внешний вид: текст, список, шаги, подсказки, визуализации и проверка
 * знаний. Один компонент на оба курса — значит, любой новый тип блока достаточно
 * добавить здесь, и он сразу появится и в базовом курсе, и в продвинутом.
 *
 * Блоки image/animation/screenshot/diagram получают SVG-визуализацию из
 * components/lesson-visuals: у каждого блока свой компонент (один блок — один
 * файл, без повторов между уроками). Пока своей визуализации нет — в карточке
 * остаётся заглушка с иконкой типа блока.
 *
 * Карточка визуализации показывается не только у медийных типов: если у блока
 * другого типа (например, у списка пунктов или у шагов) есть visual_file, кадр
 * встаёт рядом с содержимым — так у списка может быть схема-обзор, а у шагов
 * сборки — схема движения воздуха. В базовом и продвинутом курсах visual_file
 * есть только у медийных блоков, поэтому их вид не меняется.
 *
 * Тексты блоков приходят абзацами: пустая строка в данных — граница абзаца, а
 * **звёздочки** в тексте — жирный термин (см. BlockText). Это правило стиля
 * от 04.10: короткие предложения, одна мысль на абзац. Так же рисуется и пункт
 * списка: длинный пункт нового стиля делится пустой строкой, а не остаётся
 * полотном. В продвинутом курсе пустых строк в текстах нет, поэтому его вид не
 * меняется; в базовом они появляются вместе с переписанными уроками.
 *
 * Типы данных — в lib/types.ts (LessonBlock). Здесь только внешний вид.
 */
export type { LessonBlock, LessonBlockStep } from "@/lib/types";

const calloutStyles = {
  tip: {
    icon: "💡",
    iconBox: "border-emerald-500/20 bg-emerald-500/10",
    title: "text-emerald-200",
  },
  warning: {
    icon: "⚠️",
    iconBox: "border-amber-500/25 bg-amber-500/10",
    title: "text-amber-200",
  },
  analogy: {
    icon: "🧩",
    iconBox: "border-violet-500/20 bg-violet-500/10",
    title: "text-violet-200",
  },
} as const;

type CalloutType = keyof typeof calloutStyles;

/** Как выглядит блок с визуализацией: иконка заглушки, подпись и цвет подписи. */
const mediaStyles = {
  image: {
    icon: "🖼",
    label: "Иллюстрация",
    title: "text-sky-200",
  },
  animation: {
    icon: "🎬",
    label: "Анимация",
    title: "text-indigo-200",
  },
  screenshot: {
    icon: "📸",
    label: "Скриншот",
    title: "text-teal-200",
  },
  diagram: {
    icon: "📊",
    label: "Схема",
    title: "text-fuchsia-200",
  },
} as const;

type MediaType = keyof typeof mediaStyles;

/**
 * Типографика текста урока: крупнее базового 16px и свободный интерлиньяж.
 *
 * Ширину задаёт страница (`LessonLayout`) — колонка до 800px. При 17–18px и
 * `leading-8`/`leading-9` строка держится в пределах 70–80 знаков: глаз не
 * теряет её начало. Цвет — `slate-300`, а не белый: длинный абзац белым слепит,
 * а заголовки и жирные термины остаются белыми, и иерархия читается.
 */
const LESSON_TEXT =
  "text-[17px] leading-8 text-slate-300 sm:text-[18px] sm:leading-9";
const LESSON_TEXT_MUTED =
  "text-[16px] leading-7 text-slate-400 sm:text-[17px] sm:leading-8";

/**
 * Разбор строки на обычный текст, **жирные** вставки и ссылки.
 *
 * Жирным помечаем термин и главное число — так объяснение термина видно в самом
 * тексте, а не в сноске. Ссылки в данных записаны обычным markdown
 * (`[подпись](/artifacts/file.cfg)`): по ним читатель скачивает файл к уроку.
 * Разметка разбирается вручную (библиотеки markdown в проекте нет), но только в
 * React-узлы: dangerouslySetInnerHTML не нужен, значит, вставка из данных не
 * может принести с собой разметку. Адрес пропускаем только относительный или
 * http(s) — javascript: из данных в ссылку не попадёт.
 */
function inlineText(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }

      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);

      if (!link) {
        return part;
      }

      const [, label, href] = link;
      const isExternal = /^https?:\/\//.test(href);
      const isSafe =
        (href.startsWith("/") && !href.startsWith("//")) || isExternal;

      if (!isSafe) {
        return part;
      }

      return (
        <a
          key={index}
          href={href}
          download={href.startsWith("/artifacts/") ? "" : undefined}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-sky-200 hover:decoration-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {label}
        </a>
      );
    });
}

/**
 * Текст блока абзацами: пустая строка — граница абзаца.
 *
 * Зачем: уроки уровня «Уверенный» пишутся короткими абзацами по 2–4 предложения,
 * и границу абзаца автор ставит пустой строкой в самих данных. В разметке абзацы
 * разводит этот компонент — иначе браузер схлопнул бы пустую строку в пробел и
 * весь блок снова стал бы одним полотном. Одиночный перевод строки внутри абзаца
 * остаётся пробелом: так блок, записанный одной строкой, выглядит как раньше.
 */
function BlockText({ text, className }: { text: string; className?: string }) {
  const parts = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {parts.map((paragraph, index) => (
        <p key={index} className={index === 0 ? undefined : "mt-4"}>
          {inlineText(paragraph)}
        </p>
      ))}
    </div>
  );
}

/**
 * Список блоков урока с отступами между ними.
 *
 * Продвинутая страница передаёт сюда только часть блоков, когда у пользователя
 * нет доступа: превью — это те же самые блоки, просто обрезанный массив.
 *
 * Адрес визуализации — курс + урок + тип блока + порядковый номер среди блоков
 * этого же типа: так адрес не сдвигается, если в урок добавят текст. Для
 * продвинутого курса в адрес входит ещё и код модуля (pro-A-A1-image-0), а для
 * «Уверенного» и базового кода модуля нет: коды уроков (C5, 3) уникальны внутри
 * уровня, поэтому хватает confident-C5-image-0 и basic-3-image-0.
 */
export function LessonBlocks({
  blocks,
  courseType,
  moduleId,
  lessonId,
}: {
  blocks: LessonBlock[];
  courseType?: CourseKind;
  /** Код модуля продвинутого курса — он нужен в адресе визуализации. */
  moduleId?: string;
  /** Номер урока базового курса или код урока продвинутого (A1, C1-1). */
  lessonId?: number | string;
}) {
  return (
    <div className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
      {blocks.map((block, index) => (
        <BlockView
          key={`${index}-${block.type}`}
          block={block}
          typeOrdinal={blocks.slice(0, index).filter((item) => item.type === block.type).length}
          courseType={courseType}
          moduleId={moduleId}
          lessonId={lessonId}
        />
      ))}
    </div>
  );
}

function BlockTitle({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return (
    <h2 className="mb-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
      {children}
    </h2>
  );
}

/**
 * Карточка визуализации блока: подпись типа, кадр и первые 100 символов описания.
 *
 * Подпись и иконка берутся у типа блока, а у немедийного типа (список с кадром) —
 * у иллюстрации: схема рядом со списком всё равно картинка, а своего набора
 * подписей у списка нет. Адрес кадра считает LessonBlocks по типу блока и его
 * порядковому номеру среди блоков этого типа (см. visualKey).
 */
function BlockVisual({
  block,
  typeOrdinal,
  courseType,
  moduleId,
  lessonId,
  className,
}: {
  block: LessonBlock;
  typeOrdinal: number;
  courseType?: CourseKind;
  moduleId?: string;
  lessonId?: number | string;
  /** Класс обёртки — внутри карточки списка кадру нужен отступ от заголовка. */
  className?: string;
}) {
  const style =
    block.type in mediaStyles
      ? mediaStyles[block.type as MediaType]
      : mediaStyles.image;
  const Visual = getVisualComponent({
    course: courseType,
    moduleId,
    lessonId,
    type: block.type,
    typeOrdinal,
  });
  const preview = block.content?.slice(0, 100);

  return (
    <section className={className}>
      <span
        className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${style.title}`}
      >
        <span aria-hidden className="text-base">
          {style.icon}
        </span>
        {style.label}
      </span>
      <div>
        {block.src ? (
          <Image
            src={block.src}
            alt={block.title ?? style.label}
            width={800}
            height={450}
            unoptimized
            className="h-auto w-full rounded-xl border border-white/10 bg-black/40"
          />
        ) : Visual ? (
          <Visual
            title={block.title ?? style.label}
            animated={block.type === "animation"}
          />
        ) : (
          <div className="my-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <p className="mb-3 text-sm text-slate-400">{block.title}</p>
            <div
              aria-hidden
              className="mx-auto flex aspect-[16/9] w-full max-w-[600px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-4xl"
            >
              {style.icon}
            </div>
          </div>
        )}
      </div>
      {preview ? (
        <p className="mt-4 text-[15px] leading-7 text-slate-400">
          {preview}
          {block.content && block.content.length > 100 ? "…" : ""}
        </p>
      ) : null}
    </section>
  );
}

function BlockView({
  block,
  typeOrdinal,
  courseType,
  moduleId,
  lessonId,
}: {
  block: LessonBlock;
  typeOrdinal: number;
  courseType?: CourseKind;
  moduleId?: string;
  lessonId?: number | string;
}) {
  switch (block.type) {
    case "text":
      return (
        <section className={LESSON_CARD}>
          <BlockTitle>{block.title}</BlockTitle>
          {block.visual_file || block.src ? (
            <BlockVisual
              block={block}
              typeOrdinal={typeOrdinal}
              courseType={courseType}
              moduleId={moduleId}
              lessonId={lessonId}
              className="mt-6"
            />
          ) : null}
          {block.content ? (
            <BlockText
              text={block.content}
              className={`mt-5 ${LESSON_TEXT}`}
            />
          ) : null}
        </section>
      );

    case "list":
      if (!block.items || block.items.length === 0) {
        return null;
      }

      return (
        <section className={LESSON_CARD}>
          <BlockTitle>{block.title}</BlockTitle>
          {block.visual_file || block.src ? (
            <BlockVisual
              block={block}
              typeOrdinal={typeOrdinal}
              courseType={courseType}
              moduleId={moduleId}
              lessonId={lessonId}
              className="mt-6"
            />
          ) : null}
          {block.content ? (
            <BlockText
              text={block.content}
              className={`mt-5 ${LESSON_TEXT}`}
            />
          ) : null}
          <ul className="mt-6 space-y-4">
            {block.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40"
                />
                <BlockText
                  text={item}
                  className={LESSON_TEXT}
                />
              </li>
            ))}
          </ul>
        </section>
      );

    case "steps": {
      if (!block.steps || block.steps.length === 0) {
        return null;
      }

      // В базовом курсе шаг — пара «заголовок + пояснение», в продвинутом —
      // просто строка с действием. Оба вида приводим к одному списку.
      const steps: LessonBlockStep[] = block.steps.map((step) =>
        typeof step === "string" ? { title: step, text: "" } : step,
      );

      return (
        <section className={LESSON_CARD}>
          <BlockTitle>{block.title}</BlockTitle>
          {block.visual_file || block.src ? (
            <BlockVisual
              block={block}
              typeOrdinal={typeOrdinal}
              courseType={courseType}
              moduleId={moduleId}
              lessonId={lessonId}
              className="mt-6"
            />
          ) : null}
          {block.content ? (
            <BlockText
              text={block.content}
              className={`mt-5 ${LESSON_TEXT}`}
            />
          ) : null}
          <ol className="mt-6 space-y-3">
            {steps.map((step, index) => (
              <li
                key={`${index}-${step.title}`}
                className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-4 transition-colors hover:border-white/10 sm:px-5"
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-black"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-snug text-white sm:text-[17px]">
                    {step.title}
                  </h3>
                  {step.text ? (
                    <BlockText
                      text={step.text}
                      className={`mt-2 ${LESSON_TEXT_MUTED}`}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    }

    case "tip":
    case "warning":
    case "analogy": {
      const style = calloutStyles[block.type as CalloutType];

      return (
        <aside className={`flex items-start gap-4 ${LESSON_CARD}`}>
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base ${style.iconBox}`}
          >
            {style.icon}
          </span>
          <div className="min-w-0">
            <h2 className={`text-base font-semibold sm:text-lg ${style.title}`}>
              {block.title}
            </h2>
            {block.content ? (
              <BlockText
                text={block.content}
                className="mt-2 text-[16px] leading-7 text-slate-300 sm:text-[17px] sm:leading-8"
              />
            ) : null}
          </div>
        </aside>
      );
    }

    case "image":
    case "animation":
    case "screenshot":
    case "diagram":
      // Медиа-блок без кадра (такие остались в модулях, у которых визуализации
      // убраны из данных): показываем заголовок и полный текст — это честнее
      // серой заглушки с иконкой.
      if (!block.visual_file && !block.src) {
        return (
          <section className={LESSON_CARD}>
            <BlockTitle>{block.title}</BlockTitle>
            {block.content ? (
              <BlockText
                text={block.content}
                className={`mt-5 ${LESSON_TEXT}`}
              />
            ) : null}
          </section>
        );
      }

      return (
        <BlockVisual
          block={block}
          typeOrdinal={typeOrdinal}
          courseType={courseType}
          moduleId={moduleId}
          lessonId={lessonId}
        />
      );

    case "mini_check": {
      if (!block.questions || block.questions.length === 0) {
        return null;
      }

      return <MiniCheck title={block.title} questions={block.questions} />;
    }

    default:
      return null;
  }
}
