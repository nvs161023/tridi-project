import Image from "next/image";

import { GENERATOR_PHOTO_VIEWS } from "@/lib/generator/photo-generator";

/**
 * Плохой пример генерации по одному фото и объяснение, зачем нужны ракурсы.
 *
 * Один блок на двух страницах: карточка на `/3d-generator` и секция на витрине
 * `/preview/generator` (проп `variant`). Главный тезис: сеть не «улучшает»
 * картинку, а восстанавливает 3D. Всё, чего нет ни на одном кадре, она
 * достраивает по догадке — поэтому один снимок даёт правдоподобный анфас и
 * упрощённые спину и профиль.
 *
 * Показываем реальный прогон владельца: один снимок кота, качество «Стандарт»,
 * без правок. Сзади и в профиль видно, где догадка не совпала; 2–4 кадра с
 * разных сторон заменяют её реальной геометрией.
 *
 * Файлы примера лежат в `public/showcase/generator-cat`: исходный кадр, три вида
 * из слайсера и сам `cat.stl` (100 000 треугольников, 120 мм по высоте,
 * 98 × 98 мм в плане — размеры посчитаны по самой сетке). Ссылка на STL даёт
 * скачать ровно то, что на картинках, — без «примерно такой модели».
 */
export const GENERATOR_EXAMPLE_SHOTS = [
  // Что подали на вход: исходный кадр владельца 320 × 320, без второго ракурса.
  {
    src: "/showcase/generator-cat/source.jpg",
    alt: "Исходный кадр: иллюстрация кота анфас на белом фоне, лапы и хвост видны",
    caption: "Один кадр: видна только передняя сторона, спины и профиля нет.",
    width: 320,
    height: 320,
    tag: "Вход · 1 фото",
    tone: "neutral",
  },
  {
    src: "/showcase/generator-cat/slicer-front.png",
    alt: "Та же модель кота в слайсере, вид спереди: стоит на столе, поддержки не нужны",
    caption: "Спереди лицо и грудь совпали с фото — этой стороны хватило.",
    width: 860,
    height: 645,
    tag: "Спереди",
    tone: "good",
  },
  {
    src: "/showcase/generator-cat/slicer-back.png",
    alt: "Модель кота в слайсере сзади: затылок и спина восстановлены по симметрии",
    caption: "Сзади затылок и спина достроены по симметрии — деталей нет.",
    width: 780,
    height: 585,
    tag: "Сзади · догадка",
    tone: "bad",
  },
  {
    src: "/showcase/generator-cat/slicer-side.png",
    alt: "Профиль модели кота в слайсере: дальнее ухо и затылок упрощены",
    caption: "В профиле нос, глаз и дальнее ухо потеряли форму — цена одного кадра.",
    width: 820,
    height: 615,
    tag: "Профиль · догадка",
    tone: "bad",
  },
] as const;

/** Сколько кадров нужно и что именно даёт каждый. */
export const GENERATOR_FRAME_NOTES = [
  {
    title: "1 кадр",
    text: "Только для простой симметричной фигурки. Затылок, спину и бока сеть придумывает — на примерах выше это видно.",
  },
  {
    title: "2 кадра",
    text: "Спереди и сзади. Второй кадр задаёт глубину и убирает плоский затылок.",
  },
  {
    title: "3–4 кадра",
    text: "Спереди, слева, сзади и справа. Сеть видит предмет со всех сторон: ручки, застёжки, поза и асимметрия остаются в модели.",
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
      "mt-4 scroll-mt-24 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/60 p-5 backdrop-blur-xl sm:p-7",
    inner: "",
    label: "text-xs font-semibold tracking-widest text-blue-300 uppercase",
    title: "mt-2 text-lg font-extrabold tracking-tight text-white sm:text-xl",
    lead: "mt-2 max-w-3xl text-sm leading-relaxed text-slate-300",
    compare: "mt-4 grid gap-3 sm:grid-cols-2",
    compareBad:
      "rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-4",
    compareGood:
      "rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.05] p-4",
    compareTitle:
      "text-xs font-semibold tracking-wide text-white uppercase",
    compareText: "mt-1.5 text-xs leading-relaxed text-slate-300",
    angles: "mt-4 flex flex-wrap items-center gap-2",
    anglesLabel: "text-[11px] font-semibold text-zinc-500",
    angleChip:
      "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300",
    angleIndex: "text-[10px] text-zinc-500 tabular-nums",
    badHeader: "mt-5 flex flex-wrap items-center gap-x-3 gap-y-2",
    badBadge:
      "inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200",
    badText: "text-xs leading-relaxed text-zinc-400",
    gallery: "mt-3 grid gap-3 sm:grid-cols-2",
    frame:
      "relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.07] bg-[#080808]",
    frameBad: "ring-1 ring-amber-400/45",
    tag: "absolute top-2 left-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur",
    tagNeutral: "border-white/15 bg-slate-950/80 text-slate-200",
    tagGood: "border-emerald-400/25 bg-emerald-950/85 text-emerald-200",
    tagBad: "border-amber-400/35 bg-amber-950/85 text-amber-200",
    caption: "mt-2 text-[11px] leading-relaxed text-zinc-400",
    notes: "mt-5 grid gap-3 sm:grid-cols-3",
    note: "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4",
    noteText: "mt-1 text-xs leading-relaxed text-zinc-400",
    download:
      "mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between",
    downloadText: "mt-1 text-xs leading-relaxed text-zinc-400",
    noteTitle: "text-sm font-semibold text-white",
    imageSizes: "(max-width: 640px) 100vw, 540px",
  },
  page: {
    section: "scroll-mt-24 border-b border-white/10",
    inner: "mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16",
    label: "text-sm font-semibold tracking-widest text-fuchsia-300 uppercase",
    title: "mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl",
    lead: "mt-4 max-w-3xl text-base leading-relaxed text-slate-300",
    compare: "mt-6 grid gap-4 sm:grid-cols-2",
    compareBad:
      "rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-5",
    compareGood:
      "rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.05] p-5",
    compareTitle:
      "text-sm font-semibold tracking-wide text-white uppercase",
    compareText: "mt-2 text-sm leading-relaxed text-slate-300",
    angles: "mt-5 flex flex-wrap items-center gap-2",
    anglesLabel: "text-xs font-semibold text-zinc-500",
    angleChip:
      "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300",
    angleIndex: "text-[11px] text-zinc-500 tabular-nums",
    badHeader: "mt-7 flex flex-wrap items-center gap-x-3 gap-y-2",
    badBadge:
      "inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200",
    badText: "text-sm leading-relaxed text-zinc-400",
    gallery: "mt-4 grid gap-4 sm:grid-cols-2",
    frame:
      "relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#080808]",
    frameBad: "ring-1 ring-amber-400/45",
    tag: "absolute top-2.5 left-2.5 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur",
    tagNeutral: "border-white/15 bg-slate-950/80 text-slate-200",
    tagGood: "border-emerald-400/25 bg-emerald-950/85 text-emerald-200",
    tagBad: "border-amber-400/35 bg-amber-950/85 text-amber-200",
    caption: "mt-2 text-xs leading-relaxed text-slate-400",
    notes: "mt-4 grid gap-4 sm:grid-cols-3",
    note: "rounded-2xl border border-white/10 bg-white/[0.04] p-5",
    noteText: "mt-2 text-sm leading-relaxed text-slate-300",
    download:
      "mt-6 flex flex-col gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between",
    downloadText: "mt-1 text-sm leading-relaxed text-slate-300",
    noteTitle: "text-sm font-semibold text-white sm:text-base",
    imageSizes: "(max-width: 640px) 100vw, 540px",
  },
} as const;

export function GeneratorPhotoExample({
  variant = "card",
}: {
  variant?: ExampleVariant;
}) {
  const styles = EXAMPLE_STYLES[variant];
  const titleId = `generator-example-${variant}`;

  return (
    <section
      aria-labelledby={titleId}
      className={styles.section}
      id="generator-photo-example"
    >
      <div className={styles.inner || undefined}>
        <p className={styles.label}>Плохой пример</p>
        <h2 className={styles.title} id={titleId}>
          Почему одного фото мало
        </h2>
        <p className={styles.lead}>
          Чем больше ракурсов, тем точнее детали. Один кадр задаёт силуэт
          спереди, а затылок, спину и дальнюю сторону сеть достраивает по
          догадке. Ниже — реальный прогон с одним снимком: спереди модель
          похожа, сзади и в профиль видно, где догадка не совпала.
        </p>

        <div className={styles.compare}>
          <div className={styles.compareBad}>
            <p className={styles.compareTitle}>1 фото</p>
            <p className={styles.compareText}>
              Сеть видит только анфас. Всё, что осталось за кадром, она
              придумывает по симметрии: спина выходит плоской, детали сбоку
              теряются.
            </p>
          </div>
          <div className={styles.compareGood}>
            <p className={styles.compareTitle}>2–4 фото</p>
            <p className={styles.compareText}>
              Каждый новый ракурс заменяет догадку реальной геометрией. Снимки
              слева, сзади и справа показывают глубину, затылок и вторую сторону.
            </p>
          </div>
        </div>

        <div
          aria-label="Порядок кадров"
          className={styles.angles}
          role="group"
        >
          <span className={styles.anglesLabel}>Порядок кадров:</span>
          {GENERATOR_PHOTO_VIEWS.map((view, index) => (
            <span className={styles.angleChip} key={view}>
              <span className={styles.angleIndex}>{index + 1}</span>
              {view}
            </span>
          ))}
        </div>

        <div className={styles.badHeader}>
          <span className={styles.badBadge}>1 фото · реальный прогон</span>
          <p className={styles.badText}>
            Сзади и в профиль видны места, где одного кадра не хватило.
          </p>
        </div>

        <div className={styles.gallery}>
          {GENERATOR_EXAMPLE_SHOTS.map((shot) => {
            const frameClass =
              shot.tone === "bad"
                ? `${styles.frame} ${styles.frameBad}`
                : styles.frame;
            const tagClass =
              shot.tone === "bad"
                ? styles.tagBad
                : shot.tone === "good"
                  ? styles.tagGood
                  : styles.tagNeutral;

            return (
              <figure key={shot.src}>
                <div className={frameClass}>
                  <Image
                    alt={shot.alt}
                    className="h-full w-full object-contain"
                    height={shot.height}
                    sizes={styles.imageSizes}
                    src={shot.src}
                    width={shot.width}
                  />
                  <span className={`${styles.tag} ${tagClass}`}>
                    {shot.tag}
                  </span>
                </div>
                <figcaption className={styles.caption}>
                  {shot.caption}
                </figcaption>
              </figure>
            );
          })}
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
