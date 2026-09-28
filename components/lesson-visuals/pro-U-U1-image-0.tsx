import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Tag = {
  /** Код лицензии в правом кружке значка. */
  token: string;
  /** Строки правила — слова из блока «Типы лицензий» того же урока. */
  lines: string[];
  /** Подложка бирки: от светлой у свободной лицензии к тёмной у строгой. */
  fill: string;
  accent: string;
  /** Запрет рисуем штампом, а не перечёркнутым кругом. */
  stamp?: string[];
};

/**
 * Шесть бирок на одной рельсе — как ярлыки на товаре: код лицензии, правило из
 * урока и, где урок его называет, красный прямоугольный штамп запрета.
 */
const TAGS: Tag[] = [
  { token: "0", lines: ["делай что", "хочешь"], fill: "#64748b", accent: "#38bdf8" },
  { token: "BY", lines: ["указывай", "автора"], fill: "#64748b", accent: "#38bdf8" },
  { token: "SA", lines: ["версии —", "та же", "лицензия"], fill: "#475569", accent: "#38bdf8" },
  {
    token: "NC",
    lines: ["только", "личное"],
    fill: "#334155",
    accent: "#f87171",
    stamp: ["продавать", "нельзя"],
  },
  {
    token: "ND",
    lines: ["модель", "как есть"],
    fill: "#334155",
    accent: "#f87171",
    stamp: ["менять", "нельзя"],
  },
  {
    token: "©",
    lines: ["ничего", "без", "разрешения"],
    fill: "#0f172a",
    accent: "#f87171",
  },
];

/** Центры бирок: рельса 296 px, шесть бирок по 45 px с зазором 5 px. */
const CENTERS = [35, 85, 135, 185, 235, 285];

const TAG_W = 45;
const TAG_TOP = 54;
const TAG_H = 64;
const EMBLEM_Y = 72;
/** Строки правила внутри бирки, шаг 12 px — подписи не слипаются. */
const RULE_Y = [88, 100, 112];
const RAIL_Y = 48;

/** Ваза-модель в нижнем ряду: к ней подвешена бирка лицензии. */
const VASE = "M 28,134 L 44,134 L 47,146 L 25,146 Z";

/**
 * Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что и в проверке
 * читаемости, поэтому вылет строки виден сразу и на глаз, и в отчёте проверки.
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Лицензии моделей: шесть бирок висят на одной рельсе и упорядочены от самой
 * свободной к самой строгой — стрелка над рельсой показывает, что справа прав
 * всё меньше. В каждой бирке значок «CC» и код, ниже — строки правила из урока.
 * Там, где урок прямо запрещает (NC — продавать, ND — менять модель), поверх
 * бирки лежит красный прямоугольный штамп. Внизу — главная ловушка урока:
 * модель с биркой CC BY-NC и перечёркнутый ценник.
 *
 * Ровно по content урока: «Таблица: CC0, CC BY, CC BY-NC, CC BY-SA, CC BY-ND,
 * All Rights Reserved. Что можно, что нельзя» и по блоку «Типы лицензий».
 *
 * От таблицы пластиков basic-2-image-0 и от таблицы параметров N-N5-image-0
 * отличается тем, что строк и ячеек в кадре нет вовсе: сравнение идёт по самим
 * предметам — биркам, подвешенным к рельсе. От матрицы E2-2-4 и от «четырёх
 * углов нависания» I-I5 — тем, что там клетки «можно/нельзя» на пересечении
 * признаков, а здесь у каждой бирки одно своё правило. Запреты нарисованы
 * прямоугольными штампами, а не перечёркнутым кругом (K-K1, E-хим2, M-M5).
 */
export function ProUU1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть бирок лицензий на одной рельсе, справа права строже: CC0 — делай что хочешь; CC BY — указывай автора; CC BY-SA — версии под той же лицензией; CC BY-NC — только личное и штамп «продавать нельзя»; CC BY-ND — модель как есть и штамп «менять нельзя»; All Rights Reserved — ничего без разрешения. Внизу модель с биркой CC BY-NC и перечёркнутый ценник: скачал бесплатно — не значит можно продавать"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Лицензии моделей — шесть бирок на одной рельсе
        </text>
        <text x="12" y="30" fontSize="7.5" fill="#e2e8f0">
          свободы всё меньше
        </text>

        {/* Стрелка над рельсой: слева свободнее всего, справа — строже */}
        <line x1="12" y1="40" x2="300" y2="40" stroke="#94a3b8" />
        <polygon points="300,36 308,40 300,44" fill="#94a3b8" />

        {/* Рельса, на которой висят бирки */}
        <line x1="12" y1={RAIL_Y} x2="308" y2={RAIL_Y} stroke="#64748b" />

        {TAGS.map((tag, index) => {
          const cx = CENTERS[index];

          return (
            <g key={`tag-${tag.token}`}>
              <line x1={cx} y1={RAIL_Y} x2={cx} y2={TAG_TOP} stroke="#94a3b8" strokeWidth="0.9" />
              <rect
                x={cx - TAG_W / 2}
                y={TAG_TOP}
                width={TAG_W}
                height={TAG_H}
                rx="4"
                fill={tag.fill}
                stroke={tag.accent}
                strokeWidth="0.9"
              />
              <circle
                cx={cx}
                cy={TAG_TOP + 7}
                r="1.7"
                fill="#0f172a"
                stroke={tag.accent}
                strokeWidth="0.7"
              />

              {/* Значок лицензии: кружки «CC» и код */}
              <circle
                cx={cx - 8}
                cy={EMBLEM_Y}
                r="6.5"
                fill="#0f172a"
                stroke={tag.accent}
                strokeWidth="0.8"
              />
              <circle
                cx={cx + 8}
                cy={EMBLEM_Y}
                r="6.5"
                fill="#0f172a"
                stroke={tag.accent}
                strokeWidth="0.8"
              />
              <text x={centerX(cx - 8, "CC", 7.5)} y={EMBLEM_Y} fontSize="7.5" fill="#e2e8f0">
                CC
              </text>
              <text x={centerX(cx + 8, tag.token, 7.5)} y={EMBLEM_Y} fontSize="7.5" fill="#e2e8f0">
                {tag.token}
              </text>

              {/* Правило из урока: одна-три короткие строки */}
              {tag.lines.map((line, lineIndex) => (
                <text
                  key={`rule-${tag.token}-${line}`}
                  x={centerX(cx, line, 7.5)}
                  y={RULE_Y[lineIndex]}
                  fontSize="7.5"
                  fill="#e2e8f0"
                >
                  {line}
                </text>
              ))}

              {/* Запрет: прямоугольный штамп поверх бирки, а не перечёркнутый круг */}
              {tag.stamp ? (
                <g transform={`rotate(-6 ${cx} 118)`}>
                  <rect
                    x={cx - 22}
                    y="107"
                    width="44"
                    height="24"
                    rx="2"
                    fill="#0f172a"
                    stroke="#f87171"
                    strokeWidth="1.1"
                  />
                  {tag.stamp.map((line, stampIndex) => (
                    <text
                      key={`stamp-${tag.token}-${line}`}
                      x={centerX(cx, line, 7.5)}
                      y={stampIndex === 0 ? 117 : 128.5}
                      fontSize="7.5"
                      fill="#fca5a5"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              ) : null}
            </g>
          );
        })}

        {/* Главная ловушка урока: модель с биркой CC BY-NC и перечёркнутый ценник */}
        <path d={VASE} fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
        <ellipse cx="36" cy="134" rx="8" ry="2.5" fill="#64748b" stroke="#94a3b8" />
        <rect x="52" y="134" width="48" height="12" rx="3" fill="#0f172a" stroke="#f87171" />
        <text x={centerX(76, "CC BY-NC", 7.5)} y="143" fontSize="7.5" fill="#fca5a5">
          CC BY-NC
        </text>
        <g transform="rotate(-10 125 139.5)">
          <rect x="110" y="133" width="30" height="13" rx="3" fill="#0f172a" stroke="#f87171" />
          <circle cx="116" cy="139.5" r="1.8" fill="#1e293b" stroke="#f87171" strokeWidth="0.7" />
        </g>
        <line x1="106" y1="132" x2="144" y2="148" stroke="#f87171" strokeWidth="1.3" />
        <line x1="144" y1="132" x2="106" y2="148" stroke="#f87171" strokeWidth="1.3" />

        <text x="12" y="162" fontSize="7.5" fill="#e2e8f0">
          скачал бесплатно — не значит продавать
        </text>
        <text x="12" y="174" fontSize="7.5" fill="#94a3b8">
          большинство моделей на Thingiverse и Printables — CC BY-NC
        </text>
      </svg>
    </VisualWrapper>
  );
}