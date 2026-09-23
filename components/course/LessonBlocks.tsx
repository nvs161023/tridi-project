import Image from "next/image";

import { getVisualComponent } from "@/components/lesson-visuals";

/**
 * Отрисовка блоков урока — общая для базового и продвинутого курса.
 *
 * Блоки описаны данными в data/lessons.json и data/lessons-pro.json, а здесь
 * лежит их внешний вид: текст, список, шаги, подсказки, иллюстрации. Один
 * компонент на оба курса — значит, любой новый тип блока достаточно добавить
 * здесь, и он сразу появится и в базовом курсе, и в продвинутом.
 *
 * Блоки image/animation получают SVG-визуализацию из components/lesson-visuals:
 * у каждого блока свой компонент (один блок — один файл, без повторов между
 * уроками). Пока своей визуализации нет — в карточке остаётся заглушка.
 */

export type LessonBlock = {
  type: string;
  title?: string;
  src?: string;
  content?: string;
  items?: string[];
  steps?: { title: string; text: string }[];
};

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

const mediaStyles = {
  image: {
    icon: "🖼️",
    label: "Иллюстрация",
    title: "text-sky-200",
  },
  animation: {
    icon: "🎬",
    label: "Анимация",
    title: "text-indigo-200",
  },
} as const;

type MediaType = keyof typeof mediaStyles;

/**
 * Список блоков урока с отступами между ними.
 *
 * Продвинутая страница передаёт сюда только часть блоков, когда у пользователя
 * нет подписки: превью — это те же самые блоки, просто обрезанный массив.
 */
export function LessonBlocks({
  blocks,
  courseType,
  lessonId,
}: {
  blocks: LessonBlock[];
  courseType?: "basic" | "pro";
  lessonId?: number;
}) {
  return (
    <div className="mt-12 space-y-8 sm:mt-16 sm:space-y-10">
      {blocks.map((block, index) => (
        <BlockView
          key={`${index}-${block.type}`}
          block={block}
          blockIndex={index}
          courseType={courseType}
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

function BlockView({
  block,
  blockIndex,
  courseType,
  lessonId,
}: {
  block: LessonBlock;
  blockIndex: number;
  courseType?: "basic" | "pro";
  lessonId?: number;
}) {
  switch (block.type) {
    case "text":
      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
            {block.content}
          </p>
        </section>
      );

    case "list":
      if (!block.items || block.items.length === 0) {
        return null;
      }

      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <ul className="mt-6 space-y-4">
            {block.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                />
                <span className="text-base leading-relaxed text-slate-300">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case "steps":
      if (!block.steps || block.steps.length === 0) {
        return null;
      }

      return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <BlockTitle>{block.title}</BlockTitle>
          <ol className="mt-6 space-y-6">
            {block.steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
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
                  <p className="mt-2 text-base leading-relaxed text-slate-400">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );

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
            <p className={`mt-2 text-base leading-relaxed ${style.body}`}>
              {block.content}
            </p>
          </div>
        </aside>
      );
    }

    case "image":
    case "animation": {
      const style = mediaStyles[block.type as MediaType];
      const Visual = getVisualComponent({ course: courseType, lessonId, blockIndex });
      const preview = block.content?.slice(0, 100);

      return (
        <section>
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

    default:
      return null;
  }
}

