import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: решётка 16…152 и дерево 168…304, стол на 86. */
const PANEL_LEFT_X = 16;
const PANEL_RIGHT_X = 168;
const PART_Y = 44;
const PART_H = 11;
const BED_Y = 86;

/** Решётка: столбики через 18, слои через 9 — плотная площадь касания. */
const GRID_COLUMNS = [30, 48, 66, 84, 102, 120, 138];
const GRID_ROWS = [64, 73, 82];

/** Дерево: ствол из основания и три ветки к точкам контакта. */
const TREE_TRUNK_X = 234;
const TREE_PAD = { x: 210, y: 79, w: 48, h: 7 };
const TREE_BRANCHES = [204, 234, 266];

const NOTES = [
  "Дерево тянется ветками от стола: касаний мало",
  "Широкие плоские свесы держит только решётка",
  "Под дерево ставят кайму: основание крепко",
  "Дерево печатается медленнее, но пластика уходит мало",
];

/**
 * Кадр блока 18 урока C5 «Древовидные и решётчатые поддержки».
 *
 * Сравнение из описания кадра `C5_tree.png` и блоков 17, 19, 20: решётка стоит
 * столбиками и слоями, касается детали всей площадью — она уверенно держит
 * широкий плоский свес, но расходует много пластика и оставляет больше следов.
 * Дерево растёт ветками от основания, касается детали только точками: расход
 * почти вдвое ниже, следов почти нет, зато широкий свес оно не удержит, а от
 * толчка сопла качается — поэтому скорость поддержек снижают (блок 17). Нижние
 * строки — блоки 17 и 20: дерево берут там, где важна чистая поверхность, а
 * кайма под основанием держит ствол на гладком столе. Столбики и слои решётки,
 * кайма под основанием дерева и точки контакта — прямо из описания кадра.
 */
export function ConfidentC5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Решётка и дерево: что выбрать. Решётка стоит столбиками и слоями и касается детали всей площадью: широкий свес держит, но много пластика и следов. Дерево растёт ветками от основания и касается точками: расход почти вдвое ниже, следов мало, широкий свес не держит. Под дерево ставят кайму, чтобы основание держалось крепко. Дерево печатается медленнее, зато пластика уходит мало"
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

        <text x="14" y="30" fontSize="10" fontWeight="700" fill="#3b82f6">
          Решётка (Grid)
        </text>
        <text x={PANEL_RIGHT_X} y="30" fontSize="10" fontWeight="700" fill="#10b981">
          Дерево (Tree, Organic)
        </text>
        <line x1="160" y1="22" x2="160" y2="132" stroke="#475569" strokeOpacity="0.5" />

        {/* Левая панель: решётка держит свес всей площадью */}
        <rect
          x="22"
          y={PART_Y}
          width="126"
          height={PART_H}
          rx="2"
          fill="#334155"
          fillOpacity="0.55"
          stroke="#64748b"
        />
        {GRID_COLUMNS.map((x) => (
          <line
            key={x}
            x1={x}
            y1={PART_Y + PART_H}
            x2={x}
            y2={BED_Y}
            stroke="#3b82f6"
            strokeOpacity="0.45"
          />
        ))}
        {GRID_ROWS.map((y) => (
          <line
            key={y}
            x1="22"
            y1={y}
            x2="148"
            y2={y}
            stroke="#3b82f6"
            strokeOpacity="0.3"
          />
        ))}
        <line
          x1={PANEL_LEFT_X}
          y1={BED_Y}
          x2="152"
          y2={BED_Y}
          stroke="#475569"
        />

        {/* Правая панель: дерево касается детали точками */}
        <rect
          x="170"
          y={PART_Y}
          width="126"
          height={PART_H}
          rx="2"
          fill="#334155"
          fillOpacity="0.55"
          stroke="#64748b"
        />
        <rect
          x={TREE_PAD.x}
          y={TREE_PAD.y}
          width={TREE_PAD.w}
          height={TREE_PAD.h}
          rx="2"
          fill="#0f172a"
          fillOpacity="0.6"
          stroke="#10b981"
          strokeOpacity="0.5"
        />
        <line
          x1={TREE_TRUNK_X}
          y1={TREE_PAD.y}
          x2={TREE_TRUNK_X}
          y2="64"
          stroke="#10b981"
          strokeOpacity="0.7"
          strokeLinecap="round"
        />
        {TREE_BRANCHES.map((x) => (
          <g key={x}>
            <line
              x1={TREE_TRUNK_X}
              y1="64"
              x2={x}
              y2={PART_Y + PART_H}
              stroke="#10b981"
              strokeOpacity="0.6"
              strokeLinecap="round"
            />
            <circle cx={x} cy={PART_Y + PART_H} r="2.2" fill="#10b981" fillOpacity="0.85" />
          </g>
        ))}
        <line
          x1={PANEL_RIGHT_X}
          y1={BED_Y}
          x2="304"
          y2={BED_Y}
          stroke="#475569"
        />

        {/* Что даёт решётка и что даёт дерево */}
        <text x={PANEL_LEFT_X} y="100" fontSize="10" fill="#cbd5e1">
          широкий свес держит
        </text>
        <text x={PANEL_LEFT_X} y="112" fontSize="10" fill="#94a3b8">
          много пластика
        </text>
        <text x={PANEL_LEFT_X} y="124" fontSize="10" fill="#94a3b8">
          следов больше
        </text>
        <text x={PANEL_RIGHT_X} y="100" fontSize="10" fill="#cbd5e1">
          касание точками
        </text>
        <text x={PANEL_RIGHT_X} y="112" fontSize="10" fill="#94a3b8">
          расход почти вдвое ниже
        </text>
        <text x={PANEL_RIGHT_X} y="124" fontSize="10" fill="#94a3b8">
          широкий свес не держит
        </text>

        {/* Выбор решает форма нависания */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={136 + index * 12}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
