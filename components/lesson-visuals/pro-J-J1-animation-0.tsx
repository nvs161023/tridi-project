import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Panel = {
  /** Левый верхний угол панели 145×118. */
  x: number;
  y: number;
  /** Заголовок панели — слова из контента блока: «нагрузка по слоям». */
  header: string;
  accent: string;
  /** У сломанной детали слои стоят вдоль нагрузки, у целой — поперёк. */
  broken: boolean;
  /** Подпись под схемой: что стало с деталью. */
  caption: string;
};

/** Одна и та же пластина в двух панелях: поворот на 90° меняет только слои. */
const PANELS: Panel[] = [
  {
    x: 12,
    y: 26,
    header: "нагрузка по слоям",
    accent: "#f87171",
    broken: true,
    caption: "ломается по слою",
  },
  {
    x: 163,
    y: 26,
    header: "нагрузка поперёк слоёв",
    accent: "#34d399",
    broken: false,
    caption: "поворот на 90° — держит",
  },
];

const PANEL_W = 145;
const PANEL_H = 118;

/** Пластина: одна и та же деталь в обеих панелях, меняется только рисунок слоёв. */
const PLATE = { dx: 48, dy: 33, w: 52, h: 56 };

/** Слои сломанной пластины: линии стоят вдоль нагрузки. */
const VERTICAL_LAYERS = [54, 60, 66, 72, 78, 84, 90];

/** Слои целой пластины: после поворота линии стоят поперёк нагрузки. */
const HORIZONTAL_LAYERS = [39, 45, 51, 57, 63, 69, 75, 81];

/** Трещина идёт вдоль слоя: зигзаг на всю высоту сломанной пластины. */
const CRACK = "l-3,8 l3,8 l-3,8 l3,8 l-3,8 l3,8 l-3,8";

/** Пластина со слоями и стрелками разрыва: слева добавляется трещина. */
function Plate({ panel }: { panel: Panel }) {
  const { x, y, accent, broken } = panel;
  const plateX = x + PLATE.dx;
  const plateY = y + PLATE.dy;

  return (
    <g>
      <rect x={plateX} y={plateY} width={PLATE.w} height={PLATE.h} fill="#475569" stroke="#64748b" />
      {broken
        ? VERTICAL_LAYERS.map((offset) => (
            <line
              key={`vertical-${offset}`}
              x1={x + offset}
              y1={plateY + 1}
              x2={x + offset}
              y2={plateY + PLATE.h - 1}
              stroke="#94a3b8"
              strokeOpacity="0.35"
            />
          ))
        : HORIZONTAL_LAYERS.map((offset) => (
            <line
              key={`horizontal-${offset}`}
              x1={plateX + 1}
              y1={y + offset}
              x2={plateX + PLATE.w - 1}
              y2={y + offset}
              stroke="#94a3b8"
              strokeOpacity="0.35"
            />
          ))}
      {broken ? (
        <path d={`M${x + 72},${plateY} ${CRACK}`} fill="none" stroke={accent} strokeWidth="2" />
      ) : null}
      <line x1={x + 26} y1={plateY} x2={x + 26} y2={plateY + PLATE.h} stroke="#94a3b8" strokeWidth="1.4" />
      <polygon points={`${x + 21},${plateY + 11} ${x + 31},${plateY + 11} ${x + 26},${plateY}`} fill="#94a3b8" />
      <polygon points={`${x + 21},${plateY + 45} ${x + 31},${plateY + 45} ${x + 26},${plateY + PLATE.h}`} fill="#94a3b8" />
    </g>
  );
}

/**
 * Как ломается деталь, по контенту урока: «Деталь с нагрузкой по слоям ломается.
 * Повёрнутая на 90° — держит. Ориентация важнее заполнения». Диптих одной и той
 * же пластины: слева слои стоят вдоль нагрузки и трещина идёт вдоль слоя, справа
 * деталь повёрнута на 90° — слои идут поперёк нагрузки, и пластина держит.
 * Внизу — вывод урока. Стрелки разрыва в обеих панелях одинаковые: меняется
 * только ориентация слоёв.
 *
 * От pro-J-J1-image-0 отличается тем, что там четыре схемы нагрузки и правила к
 * ним, а здесь одна деталь до и после поворота — с трещиной и без.
 */
export function ProJJ1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Как ломается деталь, диптих из одной и той же пластины: слева нагрузка идёт по слоям и трещина проходит вдоль слоя — деталь ломается; справа та же деталь повёрнута на 90 градусов, нагрузка идёт поперёк слоёв — пластина держит; внизу вывод: ориентация важнее заполнения, поворот на 90 градусов меняет всё"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          одна и та же деталь, две ориентации
        </text>

        {PANELS.map((panel) => (
          <g key={panel.header}>
            <rect x={panel.x} y={panel.y} width={PANEL_W} height={PANEL_H} rx="8" fill="#0f172a" stroke="#475569" />
            <text x={panel.x + 8} y={panel.y + 14} fontSize="10" fontWeight="bold" fill={panel.accent}>
              {panel.header}
            </text>
            <Plate panel={panel} />
            <text
              x={panel.x + 72}
              y={panel.y + 106}
              fontSize="10"
              fontWeight="bold"
              fill={panel.accent}
              textAnchor="middle"
            >
              {panel.caption}
            </text>
          </g>
        ))}

        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          ориентация важнее заполнения — поворот на 90° меняет всё
        </text>
      </svg>
    </VisualWrapper>
  );
}
