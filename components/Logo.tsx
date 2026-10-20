import Link from "next/link";

type LogoProps = {
  /**
   * `full` — иконка и название для шапки.
   * `wordmark` — только текст `tridi-print.ru` для подвала.
   */
  variant?: "full" | "wordmark";
  className?: string;
};

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
 * В шапке: изометрический принтер и слово `tridi-print.ru`. В подвале — только
 * слово, без знака. На узких экранах `.ru` скрывается, чтобы шапка не ломалась.
 */
export function Logo({
  variant = "full",
  className = "",
}: LogoProps) {
  const isFull = variant === "full";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
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
    </div>
  );
}


