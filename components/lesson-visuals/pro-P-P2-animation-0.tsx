import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять отрезков пути на верхней стороне контура: их и просчитывает Pi вперёд. */
const SEG_X = [124, 140, 156, 172, 188];

/**
 * «Klipper в деле» — Raspberry Pi со светящимся индикатором, окно просчёта
 * вперёд (скоба над пятью отрезками пути, огоньки бегут по ним волной) и
 * пунктирная труба вниз, к плате принтера; голова идёт по прямоугольному
 * контуру и в углах не тормозит. Слева панель чисел: «500 мм/с» и «×2».
 *
 * Из items урока: «Расчёты на Raspberry Pi», «Скорость — 500 мм/с. Klipper
 * быстрее» — отсюда и панель чисел, и сама идея, что Pi считает путь заранее.
 * Больше чисел в кадре нет: в уроке прогресса и процентов не называется.
 *
 * От O1-animation отличается приёмом: там сервер опережал печать теневой
 * копией (negative animation-delay), здесь вперёд смотрит окно просчёта —
 * скоба и бегущие по отрезкам огоньки, а голова идёт своим ходом. От
 * N3-animation (сетка детали и её сгущение) отличается тем, что там контур
 * заливки, а здесь траектория головы и связь Pi с платой. От M6-animation
 * (проходы экрана) — предметом: там полосы проходов, здесь один контур детали.
 *
 * Классы с префиксом v-pp2a: <style> внутри SVG действует на всю страницу.
 */
export function ProPP2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация работы Klipper: Raspberry Pi с индикатором держит окно просчёта вперёд — над верхней стороной контура стоит скоба, по пяти отрезкам пути волной пробегают огоньки; от Pi по пунктирной трубе данные уходят к плате принтера, голова идёт по всему прямоугольному контуру и в углах не останавливается, а на панели слева стоят числа 500 мм/с и «×2 к прежней»."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-pp2a-head { animation: v-pp2a-run 8s linear infinite; }
          .v-pp2a-seg { animation: v-pp2a-seg 8s linear infinite; }
          .v-pp2a-pulse { animation: v-pp2a-pulse 2s ease-in-out infinite; }
          @keyframes v-pp2a-run {
            0% { transform: translate(124px, 52px); }
            25% { transform: translate(288px, 52px); }
            50% { transform: translate(288px, 112px); }
            75% { transform: translate(124px, 112px); }
            100% { transform: translate(124px, 52px); }
          }
          @keyframes v-pp2a-seg {
            0%, 2% { opacity: 0.22; }
            8%, 30% { opacity: 1; }
            40%, 100% { opacity: 0.22; }
          }
          @keyframes v-pp2a-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pp2a-head { animation: none; transform: translate(288px, 52px); }
            .v-pp2a-seg { animation: none; opacity: 0.85; }
            .v-pp2a-pulse { animation: none; opacity: 1; }
          }
        `}</style>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Klipper: расчёт вперёд, движение без пауз
        </text>

        {/* Raspberry Pi: считает путь заранее — индикатор горит ровным пульсом */}
        <rect x="12" y="38" width="76" height="54" rx="6" fill="#1e293b" stroke="#94a3b8" />
        <text x="20" y="50" fontSize="8.5" fontWeight="bold" fill="#e2e8f0">
          Raspberry Pi
        </text>
        <text x="20" y="66" fontSize="7.5" fill="#94a3b8">
          Klipper
        </text>
        <text x="20" y="80" fontSize="7.5" fill="#6ee7b7">
          расчёт вперёд
        </text>
        <circle cx="80" cy="46" r="2.6" fill="#34d399" className="v-pp2a-pulse" />

        {/* Числа урока: скорость и её выигрыш */}
        <rect x="12" y="100" width="76" height="50" rx="6" fill="#0f172a" stroke="#34d399" strokeOpacity="0.5" />
        <text x="20" y="113" fontSize="7.5" fill="#94a3b8">
          скорость печати
        </text>
        <text x="20" y="129" fontSize="10" fontWeight="bold" fill="#e2e8f0">
          500 мм/с
        </text>
        <text x="20" y="144" fontSize="7.5" fill="#6ee7b7">
          ×2 к прежней
        </text>

        {/* Область печати: контур детали, окно просчёта над пятью отрезками пути */}
        <rect x="104" y="34" width="204" height="112" rx="6" fill="#0f172a" stroke="#334155" />
        <rect x="124" y="52" width="164" height="60" fill="none" stroke="#475569" />
        {SEG_X.map((x, index) => (
          <rect
            key={x}
            x={x}
            y="51"
            width="12"
            height="3"
            fill="#6ee7b7"
            className="v-pp2a-seg"
            style={{ animationDelay: `${index * 0.32}s` }}
          />
        ))}
        <path d="M 124,44 L 124,40 L 200,40 L 200,44" fill="none" stroke="#6ee7b7" />
        <text x="206" y="44" fontSize="7.5" fill="#6ee7b7">
          окно просчёта
        </text>

        {/* Голова: обходит контур без остановок в углах — линейный цикл по четырём сторонам */}
        <g className="v-pp2a-head">
          <rect x="-6" y="-6" width="12" height="8" rx="1" fill="#334155" stroke="#94a3b8" />
          <polygon points="-2,2 2,2 0,7" fill="#fbbf24" />
        </g>

        {/* Плата принтера: принимает рассчитанный путь и двигает моторы.
            Труба нарисована здесь, а не до области печати: её заливка перекрывала линию. */}
        <path d="M 88,80 H 100 V 131 H 112" fill="none" stroke="#475569" strokeDasharray="3 2" />
        <rect x="112" y="124" width="56" height="14" rx="3" fill="#1e293b" stroke="#475569" />
        <text x="118" y="134" fontSize="7.5" fill="#94a3b8">
          плата
        </text>

        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          голова идёт по контуру без остановок в углах
        </text>
      </svg>
    </VisualWrapper>
  );
}
