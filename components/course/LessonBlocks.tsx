import Image from "next/image";

import { MiniCheck } from "@/components/course/MiniCheck";
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
 * от 04.10: короткие предложения, одна мысль на абзац. В базовом и продвинутом
 * курсах пустых строк в текстах нет, поэтому их вид не меняется.
 *
 * Типы данных — в lib/types.ts (LessonBlock). Здесь только внешний вид.
 */
export type { LessonBlock, LessonBlockStep } from "@/lib/types";

const calloutStyles = {
  tip: {
    icon: "💡",
    card: "border-emerald-500/30 bg-emerald-500/10",
    title: "text-emerald-200",
    body: "text-emerald-100/85",
  },
  warning: {
    icon: "⚠️",
    card: "border-amber-500/40 bg-amber-500/10",
    title: "text-amber-200",
    body: "text-amber-100/85",
  },
  analogy: {
    icon: "🧩",
    card: "border-violet-500/30 bg-violet-500/10",
    title: "text-violet-200",
    body: "text-violet-100/85",
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
 * Разбор строки на обычный текст и **жирные** вставки: звёздочки из данных
 * превращаются в <strong>.
 *
 * Жирным помечаем термин и главное число — так объяснение термина видно в самом
 * тексте, а не в сноске. Разметка разбирается вручную (библиотеки markdown в
 * проекте нет), но только в React-узлы: dangerouslySetInnerHTML не нужен, значит,
 * вставка из данных не может принести с собой разметку.
 */
function inlineText(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    );
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
        <p key={index} className={index === 0 ? undefined : "mt-3"}>
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
 * нет подписки: превью — это те же самые блоки, просто обрезанный массив.
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
    <div className="mt-12 space-y-8 sm:mt-16 sm:space-y-10">
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
    <h2 className="text-2xl font-bold text-white sm:text-3xl">{children}</h2>
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
            className="h-auto w-full rounded-xl border border-slate-700/50 bg-slate-950/40"
          />
        ) : Visual ? (
          <Visual
            title={block.title ?? style.label}
            animated={block.type === "animation"}
          />
        ) : (
          <div className="my-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-6">
            <p className="mb-3 text-sm text-slate-300">{block.title}</p>
            <div
              aria-hidden
              className="mx-auto flex aspect-[16/9] w-full max-w-[600px] items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/40 text-4xl"
            >
              {style.icon}
            </div>
          </div>
        )}
      </div>
      {preview ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
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
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
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
              className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg"
            />
          ) : null}
        </section>
      );

    case "list":
      if (!block.items || block.items.length === 0) {
        return null;
      }

      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
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
          <ul className="mt-6 space-y-4">
            {block.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                />
                <span className="text-base leading-relaxed text-slate-300">
                  {inlineText(item)}
                </span>
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
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
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
          <ol className="mt-6 space-y-6">
            {steps.map((step, index) => (
              <li key={`${index}-${step.title}`} className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-base font-extrabold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white sm:text-xl">
                    {step.title}
                  </h3>
                  {step.text ? (
                    <BlockText
                      text={step.text}
                      className="mt-2 text-base leading-relaxed text-slate-400"
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
        <aside
          className={`flex items-start gap-4 rounded-3xl border p-7 sm:p-9 ${style.card}`}
        >
          <span aria-hidden className="text-2xl">
            {style.icon}
          </span>
          <div>
            <h2 className={`text-lg font-bold sm:text-xl ${style.title}`}>
              {block.title}
            </h2>
            {block.content ? (
              <BlockText
                text={block.content}
                className={`mt-2 text-base leading-relaxed ${style.body}`}
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
