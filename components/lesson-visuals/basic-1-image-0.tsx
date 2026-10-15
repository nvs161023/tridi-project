import type { ReactElement } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Что рисуем слева от подписей: три разных источника тепла. Сопло с нитью,
 * ванна со смолой и лучом, камера с порошком и валиком.
 */
type IconKind = "fdm" | "sla" | "sls";

/** Свойства иконки: верхняя граница полосы и её цвет. */
type IconProps = { top: number; color: string };

/**
 * Одна полоса сравнения: имя технологии, принцип (из чего строится деталь и чем
 * материал становится твёрдым), числа урока и где технология применяется.
 */
type TechnologyRow = {
  kind: IconKind;
  name: string;
  accent: string;
  /** Чем материал превращается в твёрдое тело. */
  principle: string;
  /** Числа из урока: слой, сопло, температура. */
  numbers: string;
  /** Где применяется эта технология. */
  application: string;
};

/**
 * Три технологии в порядке урока L1: FDM (плавление нити), SLA (свет и смола),
 * SLS (лазер и порошок). Все числа — из блоков 5, 6 и 9 урока, без округлений
 * «от себя»: сопло 0,4 мм и 190–260 °C, слои 0,1–0,3 мм; смола застывает под
 * светом, платформа опускается на 25–50 мкм (0,025–0,05 мм); у SLS слой
 * 0,08–0,12 мм, материал — полиамид PA12.
 */
const ROWS: TechnologyRow[] = [
  {
    kind: "fdm",
    name: "FDM",
    accent: "#3b82f6",
    principle: "плавление нити, сопло 0,4 мм",
    numbers: "190–260 °C, слои 0,1–0,3 мм",
    application: "прототипы, крепления, корпуса",
  },
  {
    kind: "sla",
    name: "SLA",
    accent: "#f59e0b",
    principle: "смола застывает под светом",
    numbers: "слой 0,025–0,05 мм (25–50 мкм)",
    application: "миниатюры, ювелирные модели",
  },
  {
    kind: "sls",
    name: "SLS",
    accent: "#10b981",
    principle: "лазер спекает порошок",
    numbers: "слой 0,08–0,12 мм, PA12",
    application: "шестерни, втулки, воздуховоды",
  },
];

/** Три полосы по 48 px: имя, числа и применение встают в три строки. */
const ROW_TOP = 20;
const ROW_HEIGHT = 48;
const ROW_GAP = 3;

/** Столбцы подписей: имя технологии и отступ до её принципа. */

/** FDM: нить входит в горячее сопло, расплав ложится слоями. */
function FdmIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Нить сверху и сопло, из которого выходит расплав */}
      <line x1="32" y1="0" x2="32" y2="9" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <polygon points="24,9 40,9 34,21 30,21" fill="#94a3b8" />
      {/* Расплавленный шов под соплом */}
      <line x1="18" y1="23" x2="46" y2="23" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="23" r="3.2" fill={color} />
      {/* Застывшие слои: 0,1–0,3 мм каждый */}
      <rect x="18" y="27" width="28" height="3" fill="#cbd5e1" fillOpacity="0.85" />
      <rect x="18" y="30.5" width="28" height="3" fill="#cbd5e1" fillOpacity="0.7" />
      <rect x="18" y="34" width="28" height="3" fill="#cbd5e1" fillOpacity="0.55" />
    </g>
  );
}

/** SLA: луч засвечивает смолу, платформа с деталью уходит в ванну. */
function SlaIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Лазер и его луч */}
      <rect x="6" y="2" width="10" height="6" rx="1.5" fill="#94a3b8" />
      <line x1="16" y1="5" x2="21" y2="19" stroke={color} strokeWidth="1.4" />
      {/* Засветка: полимеризация в точке попадания луча */}
      <circle cx="22" cy="20" r="4.5" fill={color} fillOpacity="0.3" />
      <circle cx="22" cy="20" r="2" fill={color} />
      {/* Ванна с жидкой смолой */}
      <path d="M12 12 L12 36 L52 36 L52 12" fill="none" stroke="#64748b" strokeWidth="1.5" />
      <rect x="13" y="20" width="38" height="15" fill={color} fillOpacity="0.18" />
      <line x1="13" y1="20" x2="51" y2="20" stroke={color} strokeWidth="1" />
      {/* Штанга платформы, сама платформа и растущая слой за слоем деталь */}
      <line x1="32" y1="2" x2="32" y2="12" stroke="#64748b" strokeWidth="1.5" />
      <rect x="20" y="12" width="24" height="4" fill="#94a3b8" />
      <rect x="26" y="16" width="12" height="4" fill="#cbd5e1" />
    </g>
  );
}

/** SLS: тонкий слой порошка разравнивает валик, лазер спекает его точки. */
function SlsIcon({ top, color }: IconProps) {
  return (
    <g transform={`translate(22, ${top + 3})`}>
      {/* Лазер и его луч */}
      <rect x="4" y="2" width="10" height="6" rx="1.5" fill="#94a3b8" />
      <line x1="14" y1="5" x2="29" y2="18" stroke={color} strokeWidth="1.4" />
      <circle cx="30" cy="19" r="4.5" fill={color} fillOpacity="0.3" />
      <circle cx="30" cy="19" r="2" fill={color} />
      {/* Валик, который разравнивает свежий слой порошка */}
      <rect x="36" y="10" width="18" height="9" rx="4.5" fill="#94a3b8" />
      {/* Камера: свежий слой, порошок и деталь внутри порошка */}
      <rect x="10" y="18" width="44" height="18" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
      <rect x="11" y="20" width="42" height="4" fill={color} fillOpacity="0.35" />
      <rect x="11" y="24" width="42" height="11" fill={color} fillOpacity="0.15" />
      <rect x="24" y="27" width="16" height="8" fill="#cbd5e1" fillOpacity="0.9" />
      <circle cx="17" cy="30" r="0.9" fill="#94a3b8" fillOpacity="0.6" />
      <circle cx="19" cy="33" r="0.9" fill="#94a3b8" fillOpacity="0.6" />
      <circle cx="45" cy="29" r="0.9" fill="#94a3b8" fillOpacity="0.6" />
    </g>
  );
}

const ICONS: Record<IconKind, (props: IconProps) => ReactElement> = {
  fdm: FdmIcon,
  sla: SlaIcon,
  sls: SlsIcon,
};

/**
 * Сравнение FDM, SLA, SLS — блок 5 урока L1.
 *
 * Три полосы, три источника тепла: полоса FDM показывает нить в горячем сопле и
 * застывшие слои, SLA — ванну со смолой и луч лазера, который её засвечивает,
 * SLS — камеру с порошком, валик и спекающий луч. Справа от каждой схемы три
 * строки ровно по содержанию урока: чем материал становится твёрдым, что это
 * даёт по слоям и где технология применяется.
 *
 * Ровно по content блока 5: «Три технологии, три источника тепла. Схема: как
 * строится деталь и где каждая применяется». Числа взяты из блока 6 (сопло
 * 0,4 мм, 190–260 °C и слои 0,1–0,3 мм у FDM; платформа 25–50 мкм и слой
 * 0,025–0,05 мм у SLA; слой и материал PA12 у SLS) и блока 9 (слой SLS
 * 0,08–0,12 мм). Применение — из строк «Для чего» тех же блоков.
 *
 * От аналогии «Три мастерских» (гончар, художник, кузнец) кадр отличается тем,
 * что мастерских тут нет вовсе: это техническая схема печати, а не метафора.
 */
export function Basic1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение трёх технологий печати: FDM — плавление нити в сопле 0,4 мм при 190–260 °C, слои 0,1–0,3 мм, для прототипов, креплений и корпусов; SLA — смола застывает под светом, платформа опускается на 25–50 мкм (слой 0,025–0,05 мм), для миниатюр и ювелирных моделей; SLS — лазер спекает порошок, слой 0,08–0,12 мм из полиамида PA12, для шестерён, втулок и воздуховодов"
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
          Три технологии, три источника тепла
        </text>

        {/* Полосы-технологии: цвет слева, схема, три подписи справа */}
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
                {row.numbers}
              </text>
              <text x={LABEL_X} y={top + 43} fontSize="10" fill="#94a3b8">
                {row.application}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}

const NAME_X = 98;
const PRINCIPLE_X = 134;
/** Строки «числа» и «применение» — общий столбец. */
const LABEL_X = 98;
