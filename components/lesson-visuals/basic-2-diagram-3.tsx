import type { ReactElement } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две схемы подачи нити: мотор на голове и мотор на раме. */
type IconKind = "direct" | "bowden";

/** Свойства схемы: верхняя граница полосы и её цвет. */
type IconProps = { top: number; color: string };

/**
 * Одна полоса сравнения: где стоит мотор, какой длины путь нити, какой нужен
 * ретракт и сколько весит голова.
 */
type FeedingRow = {
  kind: IconKind;
  name: string;
  accent: string;
  /** Где стоит мотор подачи. */
  principle: string;
  /** Длина пути нити от шестерни до сопла. */
  path: string;
  /** Втягивание нити при перемещениях без печати. */
  retract: string;
  /** Что это даёт голове или чего стоит. */
  head: string;
};

/**
 * Direct и Bowden в порядке урока L2. Числа — из блока 16, который подписывает
 * этот кадр: путь нити 2–5 см против 30–50 см, ретракт 0,4–1,2 мм против 4–7 мм.
 * Массы головы — из блока 17: Direct тяжелее на 250–400 г, у Bowden голова
 * 150–250 г. В блоке 17 для Bowden назван ретракт 3–7 мм, но кадр принадлежит
 * блоку 16, поэтому цифра берётся из его подписи — 4–7 мм.
 */
const ROWS: FeedingRow[] = [
  {
    kind: "direct",
    name: "Direct",
    accent: "#3b82f6",
    principle: "мотор стоит на голове",
    path: "путь нити 2–5 см",
    retract: "ретракт 0,4–1,2 мм",
    head: "голова тяжелее на 250–400 г",
  },
  {
    kind: "bowden",
    name: "Bowden",
    accent: "#f59e0b",
    principle: "мотор стоит на раме",
    path: "путь нити 30–50 см",
    retract: "ретракт 4–7 мм",
    head: "голова легче: 150–250 г",
  },
];

/** Две полосы по 72 px: четыре строки успевают встать просторно. */
const ROW_TOP = 22;
const ROW_HEIGHT = 72;
const ROW_GAP = 4;

/** Столбцы подписей: имя подачи и её принцип в первой строке. */
const NAME_X = 98;
const PRINCIPLE_X = 152;
/** Строки «путь нити», «ретракт» и «цена» — общий столбец. */
const LABEL_X = 98;
/** Шаг строк внутри полосы. */
const LINE_STEP = 16;

/**
 * Direct: мотор подачи закреплён прямо на печатающей голове, поэтому нить идёт
 * от шестерни к соплу коротким отрезком.
 */
function DirectIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Мотор подачи на голове */}
      <rect x="4" y="8" width="13" height="13" rx="2" fill={color} />
      {/* Голова с соплом */}
      <rect x="21" y="8" width="24" height="17" rx="2" fill="#94a3b8" />
      <polygon points="29,25 37,25 33,31" fill="#cbd5e1" />
      {/* Нить: от шестерни до сопла пара сантиметров */}
      <line x1="17" y1="14" x2="21" y2="14" stroke="#cbd5e1" strokeWidth="2.6" />
      {/* Деталь на столе */}
      <rect x="27" y="34" width="14" height="3" fill="#cbd5e1" />
      <line x1="2" y1="37" x2="62" y2="37" stroke="#64748b" />
    </g>
  );
}

/**
 * Bowden: мотор подачи стоит на раме, а нить идёт к голове по длинной трубке
 * PTFE, которая изгибается вместе с движением каретки.
 */
function BowdenIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Мотор подачи на раме */}
      <rect x="4" y="0" width="13" height="13" rx="2" fill={color} />
      <line x1="4" y1="13" x2="4" y2="37" stroke="#64748b" />
      {/* Трубка PTFE и нить внутри неё */}
      <path
        d="M17 6 Q34 -4 48 14"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="3.2"
      />
      <path
        d="M17 6 Q34 -4 48 14"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Голова с соплом */}
      <rect x="46" y="13" width="16" height="14" rx="2" fill="#94a3b8" />
      <polygon points="51,27 59,27 55,32" fill="#cbd5e1" />
      {/* Деталь на столе */}
      <rect x="49" y="34" width="13" height="3" fill="#cbd5e1" />
      <line x1="2" y1="37" x2="62" y2="37" stroke="#64748b" />
    </g>
  );
}

/** Схемы обеих подач по имени полосы. */
const ICONS: Record<IconKind, (props: IconProps) => ReactElement> = {
  direct: DirectIcon,
  bowden: BowdenIcon,
};

/**
 * Кадр блока 16 урока L2 «Direct и Bowden: путь нити».
 *
 * Компоновка — две полосы: это сравнение двух схем подачи, поэтому слева схема
 * узла, справа четыре строки, которые читаются построчно друг против друга: где
 * стоит мотор, сколько нити идёт до сопла, какой нужен ретракт и во что это
 * обходится голове. У Direct мотор закреплён на самой голове и нить идёт к соплу
 * коротким отрезком; у Bowden мотор стоит на раме, а нить тянется к голове по
 * длинной изогнутой трубке PTFE.
 *
 * Числа — из подписи блока 16: путь нити 2–5 см против 30–50 см, ретракт
 * 0,4–1,2 мм против 4–7 мм. Массы головы добавлены одним числом из блока 17:
 * Direct тяжелее на 250–400 г, у Bowden голова 150–250 г. Материалы и примеры
 * принтеров в кадр не попали: это текст урока, а не геометрия узла.
 */
export function Basic2Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение подачи нити Direct и Bowden: у Direct мотор подачи стоит прямо на печатающей голове, путь нити 2–5 см, ретракт 0,4–1,2 мм, но голова тяжелее на 250–400 г; у Bowden мотор стоит на раме и нить идёт по трубке PTFE длиной 30–50 см, ретракт приходится делать 4–7 мм, зато голова легче — 150–250 г"
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
          Direct и Bowden: путь нити и ретракт
        </text>

        {/* Полосы-подачи: цвет слева, схема узла, четыре строки справа */}
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
                height={ROW_HEIGHT - 14}
                rx="1.5"
                fill={row.accent}
              />

              <Icon top={top} color={row.accent} />

              <text
                x={NAME_X}
                y={top + 15}
                fontSize="10"
                fontWeight="700"
                fill={row.accent}
              >
                {row.name}
              </text>
              <text x={PRINCIPLE_X} y={top + 15} fontSize="10" fill="#e2e8f0">
                {row.principle}
              </text>
              <text x={LABEL_X} y={top + 15 + LINE_STEP} fontSize="10" fill="#cbd5e1">
                {row.path}
              </text>
              <text x={LABEL_X} y={top + 15 + LINE_STEP * 2} fontSize="10" fill="#cbd5e1">
                {row.retract}
              </text>
              <text x={LABEL_X} y={top + 15 + LINE_STEP * 3} fontSize="10" fill="#94a3b8">
                {row.head}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
