import type { ReactElement } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три схемы движения: портал со столом-слайдером, две ремённые петли на раме и
 * три колонны с тягами к одной голове.
 */
type IconKind = "cartesian" | "corexy" | "delta";

/** Свойства схемы: верхняя граница полосы и её цвет. */
type IconProps = { top: number; color: string };

/**
 * Одна полоса сравнения: имя кинематики, чем она двигает голову, что именно
 * разгоняется и какие режимы из этого получаются.
 */
type KinematicsRow = {
  kind: IconKind;
  name: string;
  accent: string;
  /** Как устроено движение. */
  principle: string;
  /** Что разгоняется и с какой массой. */
  moving: string;
  /** Скорость и ускорение из блока «Какая кинематика где». */
  modes: string;
};

/**
 * Три кинематики в порядке урока L2. Числа — из блока 5: подвижная масса по Y у
 * Cartesian 0,5–1,2 кг (стол 350–600 г плюс деталь), каретка CoreXY 200–400 г,
 * режимы 80–150 мм/с и 1000–3000 мм/с² у Cartesian, 200–500 мм/с и
 * 5000–20 000 мм/с² у CoreXY, 150–300 мм/с и 3000–10 000 мм/с² у Delta.
 */
const ROWS: KinematicsRow[] = [
  {
    kind: "cartesian",
    name: "Cartesian",
    accent: "#3b82f6",
    principle: "оси независимы",
    moving: "стол + деталь: 0,5–1,2 кг",
    modes: "80–150 мм/с, 1000–3000 мм/с²",
  },
  {
    kind: "corexy",
    name: "CoreXY",
    accent: "#f59e0b",
    principle: "два мотора, два ремня",
    moving: "каретка 200–400 г",
    modes: "200–500 мм/с, 5000–20 000 мм/с²",
  },
  {
    kind: "delta",
    name: "Delta",
    accent: "#10b981",
    principle: "три колонны, тяги",
    moving: "три каретки и голова",
    modes: "150–300 мм/с, 3000–10 000 мм/с²",
  },
];

/** Три полосы по 48 px: принцип, подвижная масса и режимы встают в три строки. */
const ROW_TOP = 20;
const ROW_HEIGHT = 48;
const ROW_GAP = 3;

/** Столбцы подписей: имя кинематики и отступ до её принципа. */
const NAME_X = 98;
const PRINCIPLE_X = 158;
/** Строки «подвижная масса» и «режимы» — общий столбец. */
const LABEL_X = 98;

/**
 * Cartesian: голова едет по балке, стол — по Y, портал поднимается по Z.
 * Стрелки показывают три независимых движения.
 */
function CartesianIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Рама: два столба и верхняя балка */}
      <path d="M6 38 L6 4 L60 4 L60 38" fill="none" stroke="#64748b" strokeWidth="1.5" />
      {/* Балка, по которой каретка идёт по X, и сама голова */}
      <line x1="6" y1="12" x2="60" y2="12" stroke="#64748b" strokeWidth="1.2" />
      <rect x="27" y="5" width="10" height="8" rx="1" fill="#94a3b8" />
      <polygon points="29,13 35,13 32,18" fill="#cbd5e1" />
      {/* Стол, который едет по Y вместе с деталью */}
      <rect x="16" y="26" width="34" height="3" fill="#cbd5e1" />
      <line x1="10" y1="36" x2="56" y2="36" stroke={color} strokeWidth="1.4" />
      <polygon points="10,36 14,33.6 14,38.4" fill={color} />
      <polygon points="56,36 52,33.6 52,38.4" fill={color} />
      {/* Подъём балки по Z */}
      <line x1="63" y1="30" x2="63" y2="19" stroke={color} strokeWidth="1.4" />
      <polygon points="63,17 60.6,21 65.4,21" fill={color} />
    </g>
  );
}

/**
 * CoreXY: два мотора стоят на раме, а каретку ведут два ремня — их
 * согласованное движение и даёт X с Y.
 */
function CorexyIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      <rect x="4" y="4" width="58" height="34" rx="3" fill="none" stroke="#64748b" strokeWidth="1.2" />
      {/* Моторы на раме */}
      <rect x="7" y="7" width="8" height="8" rx="1" fill="#94a3b8" />
      <rect x="51" y="7" width="8" height="8" rx="1" fill="#94a3b8" />
      {/* Ремни: две петли, которые тянут одну каретку */}
      <line x1="11" y1="11" x2="55" y2="31" stroke={color} strokeWidth="1.2" />
      <line x1="55" y1="11" x2="11" y2="31" stroke={color} strokeWidth="1.2" />
      {/* Каретка с головой и стол под ней */}
      <rect x="27" y="16" width="12" height="8" rx="1" fill="#cbd5e1" />
      <polygon points="30,24 36,24 33,29" fill="#94a3b8" />
      <rect x="16" y="32" width="36" height="3" fill="#94a3b8" fillOpacity="0.7" />
    </g>
  );
}

/**
 * Delta: три колонны стоят треугольником (задняя показана пунктиром), а тяги
 * сводят три каретки к одной голове над круглым столом.
 */
function DeltaIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Круглая зона печати */}
      <ellipse cx="33" cy="36" rx="25" ry="4" fill="none" stroke="#64748b" strokeWidth="1.2" />
      {/* Задняя колонна — она стоит за головой */}
      <line x1="33" y1="3" x2="33" y2="14" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 2" />
      <circle cx="33" cy="15" r="1.6" fill="#94a3b8" />
      {/* Две передние колонны и каретки на них */}
      <line x1="8" y1="3" x2="8" y2="34" stroke="#64748b" strokeWidth="1.5" />
      <line x1="58" y1="3" x2="58" y2="34" stroke="#64748b" strokeWidth="1.5" />
      <rect x="5" y="8" width="6" height="6" rx="1" fill="#94a3b8" />
      <rect x="55" y="8" width="6" height="6" rx="1" fill="#94a3b8" />
      {/* Тяги к голове */}
      <line x1="11" y1="11" x2="28" y2="20" stroke={color} strokeWidth="1.3" />
      <line x1="55" y1="11" x2="38" y2="20" stroke={color} strokeWidth="1.3" />
      <rect x="28" y="20" width="10" height="8" rx="1" fill="#cbd5e1" />
      <polygon points="30,28 36,28 33,33" fill="#94a3b8" />
    </g>
  );
}

const ICONS: Record<IconKind, (props: IconProps) => ReactElement> = {
  cartesian: CartesianIcon,
  corexy: CorexyIcon,
  delta: DeltaIcon,
};

/**
 * Кадр блока 4 урока L2 «Три кинематики: Cartesian, CoreXY, Delta».
 *
 * Компоновка — три полосы: это сравнение трёх вариантов, поэтому слева схема
 * движения, справа три строки характеристик. Полоса Cartesian показывает раму со
 * столом-слайдером и стрелки по трём осям, CoreXY — два мотора на раме и две
 * ремённые петли к одной каретке, Delta — три колонны треугольником с тягами к
 * голове над круглым столом.
 *
 * Строки ровно по блоку 5: как устроено движение, что разгоняется и какие
 * режимы из этого выходят. Числа урока — подвижная масса по Y 0,5–1,2 кг (стол
 * 350–600 г плюс растущая деталь), каретка CoreXY 200–400 г, режимы 80–150 мм/с и
 * 1000–3000 мм/с², 200–500 мм/с и 5000–20 000 мм/с², 150–300 мм/с и
 * 3000–10 000 мм/с². Примеров принтеров в кадре нет: имена моделей — это текст
 * урока, а не схема движения.
 */
export function Basic2Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение трёх кинематик FDM-принтера: Cartesian — оси независимы, голова едет по балке, стол с деталью по Y, подвижная масса 0,5–1,2 кг, режимы 80–150 мм/с и ускорение 1000–3000 мм/с²; CoreXY — два мотора на раме и два ремня ведут каретку 200–400 г, режимы 200–500 мм/с и ускорение 5000–20 000 мм/с²; Delta — три колонны и тяги сводят три каретки к одной голове, режимы 150–300 мм/с и ускорение 3000–10 000 мм/с²"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Три кинематики: Cartesian, CoreXY, Delta
        </text>

        {/* Полосы-кинематики: цвет слева, схема движения, три подписи справа */}
        {ROWS.map((row, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);
          const Icon = ICONS[row.kind];

          return (
            <g key={row.kind}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_HEIGHT}
                rx="8"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x="14"
                y={top + 7}
                width="3"
                height="34"
                rx="1.5"
                fill={row.accent}
              />

              <Icon top={top} color={row.accent} />

              <text x={NAME_X} y={top + 15} fontSize="10" fontWeight="700" fill={row.accent}>
                {row.name}
              </text>
              <text x={PRINCIPLE_X} y={top + 15} fontSize="10" fill="#e2e8f0">
                {row.principle}
              </text>
              <text x={LABEL_X} y={top + 29} fontSize="10" fill="#cbd5e1">
                {row.moving}
              </text>
              <text x={LABEL_X} y={top + 43} fontSize="10" fill="#94a3b8">
                {row.modes}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
