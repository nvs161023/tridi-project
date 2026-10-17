import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Разрез корпуса 60 мм: 44…116 по X, 44…130 по Y, верх со скруглением. */
const PART = "M44,130 L44,60 Q44,44 60,44 L100,44 Q116,44 116,60 L116,130 Z";
/** Толстые слои внизу (шаг 7), средние (шаг 4), тонкие на куполе (шаг 3). */
const THICK_Y = [124, 117, 110, 103, 96];
const MID_Y = [92, 88, 84, 80, 76, 72];
const THIN_Y = [69, 66, 63, 60, 57, 54, 51, 48];
/** Колонка значений: подписи 160…308, три строки через 32. */
const ROW_X = 160;
const ROW_TOP = 52;
const ROW_STEP = 32;

type Row = { value: string; note: string; color: string };

/** Высоты из блоков 17, 23 и 31: стенки 0,24, фаска 0,12, границы 0,1–0,3. */
const ROWS: Row[] = [
  { value: "0,24 мм", note: "низ и стенки", color: "#60a5fa" },
  { value: "0,12 мм", note: "фаска и купол", color: "#10b981" },
  { value: "0,1–0,3 мм", note: "границы: 25–75 % сопла", color: "#f59e0b" },
];

const NOTES = [
  "Корпус 60 мм: первые 2 мм постоянным",
  "Последние 2–3 мм — тоже постоянным",
  "Качество там, где видно, скорость — где нет",
];

/**
 * Кадр блока 20 урока C6 «Разрез: толстые слои внизу, тонкие на куполе».
 *
 * Разрез корпуса высотой 60 мм из блока 17 и описания кадра `C6_vlh.png`: низ и
 * стенки идут слоем 0,24 мм, а фаска и купол — 0,12 мм, поэтому линии слоёв
 * внизу редкие, а наверху частые. Справа — границы того же профиля: 0,1–0,3 мм
 * для сопла 0,4 мм, то есть 25–75 % диаметра сопла (блок 23). Нижние строки —
 * блоки 28 и 31: первые 2 мм и последние 2–3 мм держат на постоянной высоте,
 * а тонкий слой ставят только туда, где деталь видна.
 */
export function ConfidentC6Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез: толстые слои внизу, тонкие на куполе. Корпус высотой 60 миллиметров: низ и стенки печатаются слоем 0,24 миллиметра, фаска и купол — 0,12 миллиметра, поэтому линии слоёв внизу редкие, а наверху частые. Границы высоты слоя для сопла 0,4 миллиметра — от 0,1 до 0,3 миллиметра, то есть от 25 до 75 процентов диаметра сопла. Первые 2 миллиметра и последние 2–3 миллиметра держат на постоянной высоте. Качество ставят там, где его видно, а скорость — там, где нет"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <clipPath id="c6VlhPart">
            <path d={PART} />
          </clipPath>
        </defs>

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
          Разрез: шаг по Z
        </text>

        {/* Корпус в разрезе */}
        <path d={PART} fill="#334155" fillOpacity="0.45" stroke="#64748b" />

        {/* Слои: редкие внизу, частые на куполе */}
        <g clipPath="url(#c6VlhPart)">
          {THICK_Y.map((y) => (
            <line key={y} x1="42" y1={y} x2="118" y2={y} stroke="#60a5fa" strokeOpacity="0.75" />
          ))}
          {MID_Y.map((y) => (
            <line key={y} x1="42" y1={y} x2="118" y2={y} stroke="#7dd3fc" strokeOpacity="0.4" />
          ))}
          {THIN_Y.map((y) => (
            <line key={y} x1="42" y1={y} x2="118" y2={y} stroke="#10b981" strokeOpacity="0.55" />
          ))}
        </g>

        {/* Подписи частей разреза */}
        <text x="12" y="50" fontSize="10" fill="#34d399">
          купол
        </text>
        <text x="16" y="122" fontSize="10" fill="#93c5fd">
          низ
        </text>

        {/* Границы и рабочие значения */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.value}>
              <text x={ROW_X} y={y} fontSize="10" fontWeight="700" fill={row.color}>
                {row.value}
              </text>
              <text x={ROW_X} y={y + 12} fontSize="10" fill="#cbd5e1">
                {row.note}
              </text>
            </g>
          );
        })}

        {/* Что держат постоянным */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={148 + index * 12}
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
