import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Каретка головы на рельсе: одна и та же деталь у головы и у трёх шлейфов. */
function Head() {
  return (
    <g>
      <rect x="34" y="47" width="26" height="12" rx="1" fill="#334155" stroke="#94a3b8" />
      <rect x="41" y="59" width="12" height="12" rx="1" fill="#1e293b" stroke="#94a3b8" />
      <polygon points="46,71 50,71 48,77" fill="#fbbf24" />
    </g>
  );
}

/**
 * Шлейф движения: три отставшие копии головы. Пуск анимации со сдвигом (negative
 * delay) — приём, которого в курсе нет: копии едут по тем же кадрам, но позже, и
 * образуют «хвост» за головой. Дрожь шлейфа — то самое ringing из content урока:
 * после переключения Input Shaper копии выравниваются и больше не дрожат.
 */
const GHOSTS = [
  { className: "v-oo1a-g1", shake: "v-oo1a-sh1", opacity: 0.34 },
  { className: "v-oo1a-g2", shake: "v-oo1a-sh2", opacity: 0.2 },
  { className: "v-oo1a-g3", shake: "v-oo1a-sh3", opacity: 0.1 },
];

/** Шкала скорости: четыре деления из урока, 60 и 150 мм/с по краям. */
const SPEED_TICKS = [12, 58, 104, 150];
const SPEED_LABELS = ["60", "90", "120", "150"];

/** Счётчик времени: значения отвечают делениям шкалы (60 → 90 → 120 → 150 мм/с). */
const TIME_VALUES = ["4:00", "2:40", "2:00", "1:36"];
const TIME_STEP = 34;

/**
 * «Klipper и скорость» — про скорость и время, а не про качество кромки: язык
 * «две стенки-колонны рядом» в курсе занят трижды (basic-7, B4-animation и
 * I-I4-animation, где об этом прямо сказано в докстроке).
 *
 * Поэтому кадр — рельс с головой и шлейфом: голова проходит один и тот же путь
 * дважды. Первый проход медленный (60 мм/с), шлейф за ней дрожит — это ringing.
 * На переключении (46–52 % цикла) дрожь прекращается, шкала и счётчик времени
 * перескакивают на 90, 120 и 150 мм/с, а второй проход идёт тем же путём заметно
 * быстрее (26 % цикла против 38 %). Счётчик времени — окно clipPath, как везде в
 * курсе: числа стоят в ряд с шагом 34 px и ползут влево, окно 34 px показывает
 * одно значение. Пара 4:00 → 1:36 — это арифметика урока (60 → 150 мм/с ровно в
 * 2,5 раза), а не измерение: чисел времени в тексте блока нет.
 *
 * От I-I4-animation (деталь в плане, дуги эха у углов, тумблер Input Shaper и
 * счётчик скорости) отличается тем, что тут нет ни детали, ни тумблера, ни
 * счётчика скорости: шкала и дрожащий шлейф. От B4-animation и basic-7 (две
 * детали рядом) — тем, что деталь одна и она не меняется: меняются путь и время.
 * От A-A2-animation (ремни тянут голову) — тем, что ремень не показан вовсе.
 *
 * Классы с префиксом v-oo1a: <style> внутри SVG действует на всю страницу.
 */
export function ProOO1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: голова проходит рельс дважды, за ней тянется дрожащий шлейф из трёх отставших копий — это звон; после переключения Input Shaper шлейф выравнивается, шкала скорости уходит с 60 на 90, 120 и 150 мм/с, а счётчик времени печати той же детали падает с 4:00 до 1:36 — второй проход тем же путём идёт заметно быстрее."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-oo1a-head { animation: v-oo1a-run 8s linear infinite; }
          .v-oo1a-g1 { animation: v-oo1a-run 8s linear -0.10s infinite; }
          .v-oo1a-g2 { animation: v-oo1a-run 8s linear -0.20s infinite; }
          .v-oo1a-g3 { animation: v-oo1a-run 8s linear -0.30s infinite; }
          .v-oo1a-sh1 { animation: v-oo1a-shake 8s linear -0.05s infinite; }
          .v-oo1a-sh2 { animation: v-oo1a-shake 8s linear -0.13s infinite; }
          .v-oo1a-sh3 { animation: v-oo1a-shake 8s linear -0.21s infinite; }
          .v-oo1a-scale { animation: v-oo1a-scale 8s linear infinite; }
          .v-oo1a-time { animation: v-oo1a-time 8s linear infinite; }
          .v-oo1a-after { animation: v-oo1a-after 8s linear infinite; }
          .v-oo1a-ring { animation: v-oo1a-ring 8s linear infinite; }
          @keyframes v-oo1a-run {
            0%, 8% { transform: translateX(0); }
            46%, 52% { transform: translateX(216px); }
            78%, 100% { transform: translateX(0); }
          }
          @keyframes v-oo1a-shake {
            0%, 2% { transform: translateY(0); }
            4% { transform: translateY(-2.5px); }
            6% { transform: translateY(1.5px); }
            8% { transform: translateY(-1px); }
            11% { transform: translateY(2.5px); }
            14% { transform: translateY(-1.5px); }
            17% { transform: translateY(1px); }
            20% { transform: translateY(-2.5px); }
            23% { transform: translateY(1.5px); }
            26% { transform: translateY(-1px); }
            29% { transform: translateY(2px); }
            32% { transform: translateY(-2px); }
            35% { transform: translateY(1px); }
            38% { transform: translateY(-2.5px); }
            41% { transform: translateY(1.5px); }
            44% { transform: translateY(-1px); }
            46%, 100% { transform: translateY(0); }
          }
          @keyframes v-oo1a-scale {
            0%, 46% { transform: translateX(0); }
            52%, 58% { transform: translateX(46px); }
            65%, 71% { transform: translateX(92px); }
            78%, 88% { transform: translateX(138px); }
            94%, 100% { transform: translateX(0); }
          }
          @keyframes v-oo1a-time {
            0%, 46% { transform: translateX(0); }
            52%, 58% { transform: translateX(-34px); }
            65%, 71% { transform: translateX(-68px); }
            78%, 94% { transform: translateX(-102px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-oo1a-after {
            0%, 48% { opacity: 0.25; }
            52%, 94% { opacity: 1; }
            100% { opacity: 0.25; }
          }
          @keyframes v-oo1a-ring {
            0%, 44% { opacity: 0.9; }
            48%, 100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-oo1a-head, .v-oo1a-g1, .v-oo1a-g2, .v-oo1a-g3 { animation: none; transform: translateX(0); }
            .v-oo1a-sh1, .v-oo1a-sh2, .v-oo1a-sh3 { animation: none; transform: translateY(0); }
            .v-oo1a-scale { animation: none; transform: translateX(138px); }
            .v-oo1a-time { animation: none; transform: translateX(-102px); }
            .v-oo1a-after { animation: none; opacity: 1; }
            .v-oo1a-ring { animation: none; opacity: 0; }
          }
        `}</style>

        {/* Окно счётчика времени: clipPath в кадре не рисуется, рамку окна задаёт rect */}
        <defs>
          <clipPath id="v-oo1a-window">
            <rect x="176" y="104" width="34" height="14" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          та же деталь: сначала медленно и со звоном
        </text>

        {/* Рельс с концевыми опорами: путь головы один и тот же в обоих проходах */}
        <rect x="20" y="40" width="280" height="7" rx="1" fill="#334155" stroke="#475569" />
        <rect x="14" y="37" width="7" height="13" rx="1" fill="#334155" stroke="#475569" />
        <rect x="299" y="37" width="7" height="13" rx="1" fill="#334155" stroke="#475569" />

        {/* Шлейф: три копии головы с отставанием по времени; внутренние группы дрожат */}
        {GHOSTS.map((ghost) => (
          <g key={ghost.className} className={ghost.className} opacity={ghost.opacity}>
            <g className={ghost.shake}>
              <Head />
            </g>
          </g>
        ))}

        {/* Сама голова: едет по кадрам v-oo1a-run, шлейф повторяет её позже */}
        <g className="v-oo1a-head">
          <Head />
        </g>

        {/* Шкала скорости: 60 и 150 мм/с — края шкалы из content урока */}
        <text x="12" y="92" fontSize="8" fill="#94a3b8">
          скорость, мм/с
        </text>
        <line x1="12" y1="104" x2="150" y2="104" stroke="#475569" />
        {SPEED_TICKS.map((x, index) => (
          <g key={x}>
            <line x1={x} y1="100" x2={x} y2="108" stroke="#64748b" />
            <text x={x} y="118" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
              {SPEED_LABELS[index]}
            </text>
          </g>
        ))}
        <polygon points="8,98 16,98 12,103" fill="#6ee7b7" className="v-oo1a-scale" />

        {/* Счётчик времени печати: та же деталь, значит и время сравнимо */}
        <rect x="166" y="86" width="138" height="42" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="174" y="98" fontSize="8" fill="#94a3b8">
          время печати: пример
        </text>
        <rect x="176" y="104" width="34" height="14" rx="2" fill="#0f172a" stroke="#334155" />
        <g clipPath="url(#v-oo1a-window)">
          <g className="v-oo1a-time">
            {TIME_VALUES.map((value, index) => (
              <text
                key={value}
                x={193 + index * TIME_STEP}
                y="115"
                fontSize="10"
                fontWeight="bold"
                fill="#6ee7b7"
                textAnchor="middle"
              >
                {value}
              </text>
            ))}
          </g>
        </g>

        {/* До и после: вторая строка проявляется, когда Input Shaper уже работает */}
        <text x="12" y="138" fontSize="8.5" fill="#e2e8f0">
          до: 60 мм/с, звон
        </text>
        <text x="12" y="154" fontSize="8.5" fill="#e2e8f0" className="v-oo1a-after">
          после: 150 мм/с, гладко
        </text>

        {/* Звон — две дуги у строки «до»: гаснут на переключении, больше нигде не рисуются */}
        <path
          d="M124,132 q5,5 10,0"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.2"
          className="v-oo1a-ring"
        />
        <path
          d="M122,137 q7,7 14,0"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.2"
          className="v-oo1a-ring"
        />

        <text x="166" y="138" fontSize="8" fill="#94a3b8">
          Input Shaper компенсирует
        </text>
        <text x="166" y="152" fontSize="8" fill="#94a3b8">
          вибрации — звон уходит
        </text>
      </svg>
    </VisualWrapper>
  );
}
