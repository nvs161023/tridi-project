import Image from "next/image";

/**
 * Пример генерации по одному фото — разбор «зачем 1–4 кадра».
 *
 * Один блок на двух страницах: карточка под «Как это работает» на `/3d-generator`
 * и секция между шагами и лимитами на витрине `/preview/generator` (проп
 * `variant`). Он отвечает на вопрос, который возникает у загрузчика: если сервис
 * принимает до четырёх кадров, то что будет от одного? Показываем реальный
 * прогон владельца: один снимок кота, качество «Стандарт», без правок.
 *
 * Файлы примера лежат в `public/showcase/generator-cat`: скриншот страницы,
 * три вида из слайсера и сам `cat.stl` (100 000 треугольников, 120 мм по
 * высоте, 98 × 98 мм в плане — размеры посчитаны по самой сетке). Ссылка на
 * STL даёт скачать ровно то, что на картинках, — без «примерно такой модели».
 *
 * Текст намеренно не обещает качества: у модели из одного кадра упрощены
 * затылок и дальнее ухо. Это и есть ответ на «зачем ещё кадры» — второй и
 * третий снимок убирают догадки, а не «улучшают рендер».
 */
export const GENERATOR_EXAMPLE_SHOTS = [
  // Что подали на вход: исходный кадр владельца 320 × 320, без второго ракурса.
  {
    src: "/showcase/generator-cat/source.jpg",
    alt: "Исходный кадр: иллюстрация кота анфас на белом фоне, лапы и хвост видны",
    caption: "Что загрузили: один кадр 320 × 320, второго ракурса нет.",
    width: 320,
    height: 320,
    span: 1,
  },
  // Скриншот страницы — реальный прогон от 19.11.2026. Из кадра убрана только
  // устаревшая подпись под загрузчиком («чем больше видов, тем точнее силуэт»):
  // её заменили в этом же релизе, а фото, модель и кнопки не тронуты.
  {
    src: "/showcase/generator-cat/generator-run.png",
    alt: "Страница генератора TriDi: слева загруженное фото кота, справа готовая 3D-модель в просмотре",
    caption: "Генератор: слева тот же кадр, справа модель после чистки.",
    width: 1290,
    height: 676,
    span: 2,
  },
  {
    src: "/showcase/generator-cat/slicer-front.png",
    alt: "Та же модель кота в слайсере, вид спереди: стоит на столе, поддержки не нужны",
    caption: "Слайсер, вид спереди: модель уже в мм и стоит на столе.",
    width: 860,
    height: 645,
    span: 1,
  },
  {
    src: "/showcase/generator-cat/slicer-back.png",
    alt: "Модель кота в слайсере сзади: затылок и спина восстановлены по симметрии",
    caption: "Вид сзади: спины в кадре не было, её достроила сеть.",
    width: 780,
    height: 585,
    span: 1,
  },
  {
    src: "/showcase/generator-cat/slicer-side.png",
    alt: "Профиль модели кота в слайсере: дальнее ухо и затылок упрощены",
    caption: "Профиль: дальнее ухо и затылок упрощены — цена одного кадра.",
    width: 820,
    height: 615,
    span: 1,
  },
] as const;

/** Сколько кадров нужно: три случая вместо правила «чем больше, тем лучше». */
export const GENERATOR_FRAME_NOTES = [
  {
    title: "1 кадр",
    text: "Симметричный предмет: фигурка анфас, ваза, брелок. Заднюю сторону сеть достроит.",
  },
  {
    title: "2 кадра",
    text: "Спереди и сзади. Второй кадр убирает догадку о глубине и спине.",
  },
  {
    title: "3–4 кадра",
    text: "Асимметричные детали: ручка кружки, крышка, застёжка, поза в движении.",
  },
] as const;

/** Файл примера: ссылка и то, что в нём лежит. Числа посчитаны по сетке. */
export const GENERATOR_EXAMPLE_STL = {
  href: "/showcase/generator-cat/cat.stl",
  fileName: "cat.stl",
  facts:
    "100 000 треугольников, 120 мм по высоте, 98 × 98 мм в плане. Сетка прямо из генератора: в слайсере включите поддержки — нависания есть на морде, ушах и хвосте. Глаза и нос — только форма: STL без цвета, зрачки не пропечатаются.",
} as const;

type ExampleVariant = "card" | "page";

/**
 * Классы двух подач. Разметка одна, отличается только оформление: в рабочей
 * области уместна карточка на `#0a0a0a`, на витрине — секция с общей сеткой.
 */
const EXAMPLE_STYLES = {
  card: {
    section:
      "mt-4 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/60 p-5 backdrop-blur-xl sm:p-7",
    inner: "",
    label: "text-xs font-semibold tracking-widest text-blue-300 uppercase",
    title: "mt-2 text-lg font-extrabold tracking-tight text-white sm:text-xl",
    lead: "mt-2 max-w-3xl text-sm leading-relaxed text-slate-300",
    gallery: "mt-5 grid gap-3 sm:grid-cols-3",
    frame: "overflow-hidden rounded-xl border border-white/[0.07] bg-[#080808]",
    caption: "mt-2 text-[11px] leading-relaxed text-zinc-400",
    notes: "mt-5 grid gap-3 sm:grid-cols-3",
    note: "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4",
    noteText: "mt-1 text-xs leading-relaxed text-zinc-400",
    download:
      "mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between",
    downloadText: "mt-1 text-xs leading-relaxed text-zinc-400",
    noteTitle: "text-sm font-semibold text-white",
    sizes: {
      wide: "(max-width: 640px) 100vw, 1100px",
      small: "(max-width: 640px) 100vw, 360px",
    },
  },
  page: {
    section: "border-b border-white/10",
    inner: "mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16",
    label: "text-sm font-semibold tracking-widest text-fuchsia-300 uppercase",
    title: "mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl",
    lead: "mt-4 max-w-3xl text-base leading-relaxed text-slate-300",
    gallery: "mt-7 grid gap-4 sm:grid-cols-3",
    frame: "overflow-hidden rounded-xl border border-white/10 bg-[#080808]",
    caption: "mt-2 text-xs leading-relaxed text-slate-400",
    notes: "mt-4 grid gap-4 sm:grid-cols-3",
    note: "rounded-2xl border border-white/10 bg-white/[0.04] p-5",
    noteText: "mt-2 text-sm leading-relaxed text-slate-300",
    download:
      "mt-6 flex flex-col gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between",
    downloadText: "mt-1 text-sm leading-relaxed text-slate-300",
    noteTitle: "text-sm font-semibold text-white sm:text-base",
    sizes: {
      wide: "(max-width: 640px) 100vw, 1080px",
      small: "(max-width: 640px) 100vw, 350px",
    },
  },
} as const;

/**
 * Ширина плитки в сетке галереи: исходник и виды слайсера — по одной колонке,
 * скриншот генератора — две. Классы выписаны целиком: Tailwind собирает их
 * статически, и `sm:col-span-${n}` из шаблонной строки в сборку не попадёт.
 */
const SPAN_CLASS = {
  1: "",
  2: "sm:col-span-2",
} as const;

export function GeneratorPhotoExample({
  variant = "card",
}: {
  variant?: ExampleVariant;
}) {
  const styles = EXAMPLE_STYLES[variant];
  const titleId = `generator-example-${variant}`;

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <div className={styles.inner || undefined}>
        <p className={styles.label}>Пример</p>
        <h2 className={styles.title} id={titleId}>
          Одно фото: что получается и чего не хватает
        </h2>
        <p className={styles.lead}>
          Реальный прогон: один снимок кота, качество «Стандарт», без правок.
          Ниже — страница генератора и тот же STL в слайсере.
        </p>

        <div className={styles.gallery}>
          {GENERATOR_EXAMPLE_SHOTS.map((shot) => (
            <figure
              className={SPAN_CLASS[shot.span]}
              key={shot.src}
            >
              <div className={styles.frame}>
                <Image
                  alt={shot.alt}
                  className="h-auto w-full"
                  height={shot.height}
                  sizes={shot.span === 1 ? styles.sizes.small : styles.sizes.wide}
                  src={shot.src}
                  width={shot.width}
                />
              </div>
              <figcaption className={styles.caption}>
                {shot.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className={styles.notes}>
          {GENERATOR_FRAME_NOTES.map((note) => (
            <div className={styles.note} key={note.title}>
              <p className={styles.noteTitle}>{note.title}</p>
              <p className={styles.noteText}>{note.text}</p>
            </div>
          ))}
        </div>

        <div className={styles.download}>
          <div className="min-w-0">
            <p className={styles.noteTitle}>
              Этот файл можно скачать и открыть в слайсере
            </p>
            <p className={styles.downloadText}>{GENERATOR_EXAMPLE_STL.facts}</p>
          </div>
          <a
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-300/50 hover:bg-emerald-400/15 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
            download
            href={GENERATOR_EXAMPLE_STL.href}
          >
            <span aria-hidden>↓</span>
            Скачать {GENERATOR_EXAMPLE_STL.fileName}
          </a>
        </div>
      </div>
    </section>
  );
}
