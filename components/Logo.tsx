import Link from "next/link";

type LogoProps = {
  /**
   * Куда ведёт плашка «Уроки».
   *
   * Гостю — первый урок (middleware сам отправит на вход и вернёт обратно),
   * вошедшему — личный кабинет. Значение передаёт шапка, которая уже знает
   * состояние сессии.
   */
  lessonsHref?: string;
  /**
   * `full` — иконка, название и быстрые ссылки для шапки.
   * `wordmark` — только текст `tridi-print.ru` для подвала.
   */
  variant?: "full" | "wordmark";
  /** Показывать ли плашки «Уроки» и «Конструктор моделей» (по умолчанию да). */
  showBadges?: boolean;
  className?: string;
};

/** Общий стиль быстрых ссылок: обводка, мягкий фон и синий hover. */
const badgeClassName =
  "group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap text-slate-300 transition-colors duration-200 hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 xl:text-xs";

/** Иконка Play для ссылки на уроки. */
function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 shrink-0 text-blue-400 transition-transform duration-200 group-hover:scale-110"
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M6.5 5.3 10.7 8l-4.2 2.7V5.3Z" fill="currentColor" />
    </svg>
  );
}

/** Изометрический куб для ссылки на конструктор. */
function CubeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-blue-400 transition-transform duration-200 group-hover:-translate-y-0.5"
      fill="none"
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 1.8 14 5.2v5.6L8 14.2 2 10.8V5.2L8 1.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="m2.3 5.3 5.7 3.2 5.7-3.2M8 8.5v5.5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/**
 * Изометрический 3D-принтер: тёмный корпус-рама, стол и синяя шестерёнка.
 *
 * Рисуется простыми полигонами без внешних картинок, поэтому остаётся
 * чётким на любом размере и не требует отдельного запроса к серверу.
 */
function PrinterMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 48 48"
    >
      {/* Задняя стойка рамы — видна в проёме верхней панели. */}
      <path d="M24 7.5v20" stroke="#334155" strokeWidth="2.2" />

      {/* Верхняя рама: внешний ромб с вырезом внутри. */}
      <path
        d="M24 7 43 16.5 24 26 5 16.5 24 7Zm0 3.8-14.8 5.7L24 22.2l14.8-5.7L24 10.8Z"
        fill="#1e293b"
        fillRule="evenodd"
      />

      {/* Боковые стойки. */}
      <path d="M5 16.5v19M43 16.5v19" stroke="#334155" strokeWidth="2.6" />
      <path
        d="M6.4 17.2v17.5M41.6 17.2v17.5"
        stroke="#475569"
        strokeWidth="0.9"
      />

      {/* Основание с толщиной: верхняя грань, левая и правая стенки. */}
      <path d="M24 26 43 35.5 24 45 5 35.5 24 26Z" fill="#1e293b" />
      <path d="M5 35.5 24 45v2.5L5 38V35.5Z" fill="#0f172a" />
      <path d="M24 45 43 35.5V38L24 47.5V45Z" fill="#334155" />

      {/* Стол принтера. */}
      <path d="M24 28.6 39 35.5 24 42.4 9 35.5 24 28.6Z" fill="#172033" />
      <path
        d="M24 28.6 39 35.5 24 42.4 9 35.5 24 28.6Z"
        stroke="#475569"
        strokeWidth="0.8"
      />

      {/* Синее свечение под деталью. */}
      <ellipse
        cx="24"
        cy="35.6"
        rx="11"
        ry="4.6"
        fill="#0055FF"
        opacity="0.14"
      />

      {/* Шестерёнка лежит на столе: плоская изометрия через scale(1 .56). */}
      <g transform="translate(24 35.4) scale(1 .56)">
        <g fill="#0055FF">
          <circle r="5.6" />
          <rect x="-1.5" y="-8" width="3" height="3.8" rx="0.7" />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(45)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(90)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(135)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(180)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(225)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(270)"
          />
          <rect
            x="-1.5"
            y="-8"
            width="3"
            height="3.8"
            rx="0.7"
            transform="rotate(315)"
          />
        </g>
        <circle r="2.1" fill="#172033" />
        <circle
          r="5.5"
          stroke="#60a5fa"
          strokeOpacity="0.5"
          strokeWidth="0.7"
        />
      </g>
    </svg>
  );
}

/**
 * Логотип проекта.
 *
 * В шапке: изометрический принтер, слово `tridi-print.ru` и две быстрые ссылки
 * («Уроки» и «Конструктор моделей»). В подвале — только слово, без плашек.
 * На узких экранах быстрые ссылки и `.ru` скрываются, чтобы шапка не ломалась.
 */
export function Logo({
  lessonsHref = "/course/lesson-1",
  variant = "full",
  showBadges = true,
  className = "",
}: LogoProps) {
  const isFull = variant === "full";

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <Link
        aria-label="tridi-print.ru — на главную"
        className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        href="/"
      >
        {isFull ? (
          <PrinterMark className="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
        ) : null}

        <span
          className={`flex items-baseline whitespace-nowrap font-extrabold tracking-tight ${
            isFull ? "text-[21px] sm:text-2xl" : "text-sm"
          }`}
        >
          <span className="text-slate-100">tridi</span>
          <span className="text-[#0055FF]">-print</span>
          <span
            className={`ml-0.5 text-[10px] font-semibold tracking-normal text-slate-300 ${
              isFull ? "hidden md:inline" : ""
            }`}
          >
            .ru
          </span>
        </span>
      </Link>

      {isFull && showBadges ? (
        <nav
          aria-label="Быстрый доступ"
          className="hidden items-center gap-1.5 md:flex"
        >
          <Link className={badgeClassName} href={lessonsHref}>
            <PlayIcon />
            Уроки
          </Link>
          <Link className={badgeClassName} href="/constructor">
            <CubeIcon />
            Конструктор моделей
          </Link>
        </nav>
      ) : null}
    </div>
  );
}


