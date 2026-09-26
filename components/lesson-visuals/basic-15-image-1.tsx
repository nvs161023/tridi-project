import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять умений из content урока: печатает без дефектов, ремонтирует сам, работает
 * с любым пластиком, зарабатывает, учит других. Раскладка 3 + 2: в первом ряду три
 * карточки, во втором две по центру — просторно, иконки крупные.
 */
const skills = [
  { kind: "print", lines: ["печатает", "без дефектов"], x: 16, y: 16, accent: "#3b82f6" },
  { kind: "repair", lines: ["ремонтирует", "сам"], x: 116, y: 16, accent: "#22c55e" },
  { kind: "filament", lines: ["работает с", "любым пластиком"], x: 216, y: 16, accent: "#a855f7" },
  { kind: "income", lines: ["зарабатывает", "на печати"], x: 66, y: 98, accent: "#f59e0b" },
  { kind: "teach", lines: ["учит", "других"], x: 166, y: 98, accent: "#ec4899" },
];

/** Карточка 88×74: иконка сверху, две строки подписи под ней. */
const CARD = { width: 88, height: 74, iconOffset: 32, firstLine: 51, secondLine: 66 };

/**
 * Что умеет выпускник продвинутого — пять крупных карточек с иконками.
 *
 * Ровно по content урока: «Схема: печатает без дефектов, ремонтирует сам,
 * работает с любым пластиком, зарабатывает, учит других».
 *
 * От карты дефектов (урок 10) отличается размером и назначением: там десять
 * мелких красных профилей брака ради обзора, здесь пять крупных цветных иконок —
 * это итог курса, а не диагностика.
 */
export function Basic15Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Что умеет выпускник продвинутого: печатает без дефектов, ремонтирует сам, работает с любым пластиком, зарабатывает на печати, учит других"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        {skills.map((skill) => {
          const cx = skill.x + CARD.width / 2;
          const cy = skill.y + CARD.iconOffset;
          const accent = skill.accent;

          return (
            <g key={skill.kind}>
              <rect
                x={skill.x}
                y={skill.y}
                width={CARD.width}
                height={CARD.height}
                rx="10"
                fill="#0f172a"
                stroke={accent}
                strokeWidth="1.4"
              />

              {/* Печатает без дефектов: принтер и галочка */}
              {skill.kind === "print" ? (
                <>
                  <rect x={cx - 17} y={cy - 9} width="22" height="15" rx="2" fill="none" stroke={accent} strokeWidth="1.6" />
                  <line x1={cx - 19} y1={cy + 7} x2={cx + 3} y2={cy + 7} stroke="#94a3b8" strokeWidth="2" />
                  <polyline
                    points={`${cx + 3},${cy - 1} ${cx + 8},${cy + 4} ${cx + 16},${cy - 8}`}
                    fill="none"
                    stroke={accent}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {/* Ремонтирует сам: ключ */}
              {skill.kind === "repair" ? (
                <>
                  <circle cx={cx - 8} cy={cy - 5} r="6" fill="none" stroke={accent} strokeWidth="2" />
                  <line
                    x1={cx - 4}
                    y1={cy - 1}
                    x2={cx + 11}
                    y2={cy + 11}
                    stroke={accent}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {/* Работает с любым пластиком: три катушки и нить */}
              {skill.kind === "filament" ? (
                <>
                  <circle cx={cx - 13} cy={cy - 3} r="5.5" fill="none" stroke={accent} strokeWidth="1.6" />
                  <circle cx={cx} cy={cy - 7} r="5.5" fill="none" stroke={accent} strokeWidth="1.6" />
                  <circle cx={cx + 13} cy={cy - 3} r="5.5" fill="none" stroke={accent} strokeWidth="1.6" />
                  <path
                    d={`M${cx + 13},${cy + 1} q -6,7 -13,4 q -6,-2 -12,2`}
                    fill="none"
                    stroke={accent}
                    strokeWidth="1.6"
                  />
                </>
              ) : null}

              {/* Зарабатывает: купюра с монетой */}
              {skill.kind === "income" ? (
                <>
                  <rect x={cx - 16} y={cy - 8} width="32" height="16" rx="3" fill="none" stroke={accent} strokeWidth="1.6" />
                  <circle cx={cx} cy={cy} r="5" fill="none" stroke={accent} strokeWidth="1.6" />
                  <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={accent} />
                </>
              ) : null}

              {/* Учит других: шапочка выпускника */}
              {skill.kind === "teach" ? (
                <>
                  <polygon
                    points={`${cx},${cy - 9} ${cx + 15},${cy - 3} ${cx},${cy + 3} ${cx - 15},${cy - 3}`}
                    fill="none"
                    stroke={accent}
                    strokeWidth="1.6"
                  />
                  <line x1={cx + 15} y1={cy - 3} x2={cx + 15} y2={cy + 7} stroke={accent} />
                  <circle cx={cx + 15} cy={cy + 9} r="2" fill={accent} />
                </>
              ) : null}

              <text
                x={cx}
                y={skill.y + CARD.firstLine}
                fontSize="10"
                fill="#e2e8f0"
                textAnchor="middle"
              >
                {skill.lines[0]}
              </text>
              <text
                x={cx}
                y={skill.y + CARD.secondLine}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {skill.lines[1]}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
