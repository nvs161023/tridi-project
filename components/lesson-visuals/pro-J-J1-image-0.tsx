import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Вид нагрузки: от него зависит и рисунок детали, и вид стрелок силы. */
type LoadKind = "compression" | "tension" | "bend" | "torsion";

type Panel = {
  /** Левый верхний угол панели 145×60. */
  x: number;
  y: number;
  /** Название нагрузки — слово из content и из списка урока. */
  name: string;
  accent: string;
  kind: LoadKind;
  /** Строки правила: как класть слои под эту нагрузку (список урока). */
  rule: string[];
};

/** Две колонки по два ряда: сжатие и растяжение сверху, изгиб и кручение снизу. */
const PANELS: Panel[] = [
  {
    x: 12,
    y: 28,
    name: "Сжатие",
    accent: "#93c5fd",
    kind: "compression",
    rule: ["слои", "параллельно"],
  },
  {
    x: 163,
    y: 28,
    name: "Растяжение",
    accent: "#fdba74",
    kind: "tension",
    rule: ["слои", "перпендикулярно"],
  },
  {
    x: 12,
    y: 96,
    name: "Изгиб",
    accent: "#6ee7b7",
    kind: "bend",
    rule: ["комбинация:", "сжатие и", "растяжение"],
  },
  {
    x: 163,
    y: 96,
    name: "Кручение",
    accent: "#c4b5fd",
    kind: "torsion",
    rule: ["слои", "под 45°"],
  },
];

const PANEL_W = 145;
const PANEL_H = 60;

/** Слои на панели «сжатие»: линии идут вдоль силы — сила давит с боков. */
const ALONG_LAYERS = [32, 37, 42, 47];

/** Слои на панели «растяжение»: линии стоят поперёк силы. */
const ACROSS_LAYERS = [30, 35, 40, 45];

/** Слои на панели «кручение»: три линии под 45° внутри вала. */
const DIAGONAL_LAYERS: [number, number, number, number][] = [
  [30, 32, 42, 44],
  [34, 29, 42, 37],
  [30, 42, 36, 48],
];

/**
 * Строки правила на панели: две строки стоят по центру высоты панели, три — от
 * верха, чтобы последняя строка не выехала за низ панели.
 */
function ruleBaselines(y: number, count: number): number[] {
  return count === 2 ? [y + 34, y + 46] : [y + 28, y + 40, y + 52];
}

/** Деталь и стрелки силы: каждой нагрузке своя пара «предмет — сила». */
function Sketch({ panel }: { panel: Panel }) {
  const { x, y, accent, kind } = panel;

  if (kind === "compression") {
    return (
      <g>
        <rect x={x + 24} y={y + 28} width="26" height="22" fill="#475569" stroke="#64748b" />
        {ALONG_LAYERS.map((offset) => (
          <line
            key={`along-${offset}`}
            x1={x + 25}
            y1={y + offset}
            x2={x + 49}
            y2={y + offset}
            stroke={accent}
            strokeOpacity="0.6"
          />
        ))}
        <line x1={x + 8} y1={y + 39} x2={x + 14} y2={y + 39} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points={`${x + 13},${y + 35} ${x + 13},${y + 43} ${x + 21},${y + 39}`} fill="#94a3b8" />
        <line x1={x + 66} y1={y + 39} x2={x + 60} y2={y + 39} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points={`${x + 61},${y + 35} ${x + 61},${y + 43} ${x + 53},${y + 39}`} fill="#94a3b8" />
      </g>
    );
  }

  if (kind === "tension") {
    return (
      <g>
        <rect x={x + 24} y={y + 28} width="26" height="22" fill="#475569" stroke="#64748b" />
        {ACROSS_LAYERS.map((offset) => (
          <line
            key={`across-${offset}`}
            x1={x + offset}
            y1={y + 29}
            x2={x + offset}
            y2={y + 49}
            stroke={accent}
            strokeOpacity="0.6"
          />
        ))}
        <line x1={x + 22} y1={y + 39} x2={x + 16} y2={y + 39} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points={`${x + 17},${y + 35} ${x + 17},${y + 43} ${x + 10},${y + 39}`} fill="#94a3b8" />
        <line x1={x + 52} y1={y + 39} x2={x + 58} y2={y + 39} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points={`${x + 57},${y + 35} ${x + 57},${y + 43} ${x + 64},${y + 39}`} fill="#94a3b8" />
      </g>
    );
  }

  if (kind === "bend") {
    return (
      <g>
        <path
          d={`M${x + 22},${y + 30} Q${x + 44},${y + 35} ${x + 66},${y + 30} L${x + 66},${y + 42} Q${x + 44},${y + 47} ${x + 22},${y + 42} Z`}
          fill="#475569"
          stroke="#64748b"
        />
        <path
          d={`M${x + 25},${y + 33} Q${x + 44},${y + 38} ${x + 63},${y + 33}`}
          fill="none"
          stroke={accent}
          strokeOpacity="0.6"
        />
        <polygon points={`${x + 22},${y + 42} ${x + 30},${y + 42} ${x + 26},${y + 50}`} fill="#64748b" />
        <polygon points={`${x + 58},${y + 42} ${x + 66},${y + 42} ${x + 62},${y + 50}`} fill="#64748b" />
        <line x1={x + 44} y1={y + 24} x2={x + 44} y2={y + 29} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points={`${x + 40},${y + 29} ${x + 48},${y + 29} ${x + 44},${y + 34}`} fill="#94a3b8" />
      </g>
    );
  }

  return (
    <g>
      <rect x={x + 28} y={y + 28} width="16" height="22" fill="#475569" stroke="#64748b" />
      <ellipse cx={x + 36} cy={y + 28} rx="8" ry="2.5" fill="#64748b" />
      {DIAGONAL_LAYERS.map(([dx1, dy1, dx2, dy2]) => (
        <line
          key={`diagonal-${dx1}-${dy1}`}
          x1={x + dx1}
          y1={y + dy1}
          x2={x + dx2}
          y2={y + dy2}
          stroke={accent}
          strokeOpacity="0.6"
        />
      ))}
      <path d={`M${x + 46},${y + 30} Q${x + 58},${y + 40} ${x + 46},${y + 50}`} fill="none" stroke={accent} />
      <polygon points={`${x + 42},${y + 49} ${x + 50},${y + 46} ${x + 46},${y + 54}`} fill={accent} />
    </g>
  );
}

/**
 * Типы нагрузки, по контенту урока: «Одна и та же деталь в разных условиях
 * работает по-разному». Четыре панели одного размера: в каждой деталь и стрелки
 * силы (сжатие — сила давит с боков, растяжение — тянет в стороны, изгиб — прогиб
 * на двух опорах, кручение — вал со стрелкой вращения), рядом правило из списка
 * урока: как класть слои. Внизу — пятый случай из списка: удар, где важна
 * вязкость, а не слои.
 *
 * От pro-F-F2-diagram-0 отличается тем, что тот объясняет только ориентацию
 * слоёв (две схемы и проценты прочности), а здесь четыре разных нагрузки со
 * своим рисунком силы, и слои показаны как следствие нагрузки.
 */
export function ProJJ1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре схемы нагрузки и правила слоёв к ним: сжатие — сила давит с боков, слои параллельно; растяжение — сила тянет в стороны, слои перпендикулярно; изгиб — прогиб балки на двух опорах, комбинация сжатия и растяжения; кручение — вал со стрелкой вращения, слои под 45 градусов; внизу пятый случай — удар, где важна вязкость, а не слои"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          куда идёт сила и как класть слои
        </text>

        {PANELS.map((panel) => (
          <g key={panel.name}>
            <rect
              x={panel.x}
              y={panel.y}
              width={PANEL_W}
              height={PANEL_H}
              rx="8"
              fill="#0f172a"
              stroke="#475569"
            />
            <text x={panel.x + 8} y={panel.y + 13} fontSize="10" fontWeight="bold" fill={panel.accent}>
              {panel.name}
            </text>
            <Sketch panel={panel} />
            {panel.rule.map((line, index) => (
              <text
                key={`${panel.name}-${line}`}
                x={panel.x + 74}
                y={ruleBaselines(panel.y, panel.rule.length)[index]}
                fontSize="8.5"
                fill="#cbd5e1"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          пятый случай — удар: там важна вязкость, а не слои
        </text>
      </svg>
    </VisualWrapper>
  );
}
