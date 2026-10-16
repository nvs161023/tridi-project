import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре предмета осмотра: 12…304 и 22…64, ширина 70, шаг 74. */
const ITEMS = ["вилка", "шнур", "розетка", "удлинитель"];
const ITEM_X = [12, 86, 160, 234];
const ITEM_W = 70;
const ITEM_Y = 22;
const ITEM_H = 42;
const ITEM_CX = ITEM_X.map((x) => x + ITEM_W / 2);

type Finding = { line1: string; line2: string; color: string };

/** Признаки перегрева — шаги блока 21; порядок осмотра — блок 17. */
const FINDINGS: Finding[] = [
  {
    line1: "Тёплая вилка после двух часов печати — плохой контакт",
    line2: "Горячая вилка или чёрный след — снимай питание",
    color: "#f59e0b",
  },
  {
    line1: "Заломы, потёртости и запах изоляции на шнуре",
    line2: "Нагар на розетке — перегрузка, розетку меняет электрик",
    color: "#f87171",
  },
];

const FINDING_Y = [68, 100];
const FINDING_H = 30;

const NOTES = [
  "Один удлинитель — один мощный прибор",
  "Вилку тянут за корпус, а не за шнур",
  "Осмотр по порядку: вилка, шнур, розетка, удлинитель",
];

/**
 * Кадр блока 20 урока C3 «Осмотр вилки, шнура и розетки».
 *
 * Четыре предмета из описания кадра `C3_electric_check.png`: вилка, шнур,
 * розетка и удлинитель. Признаки перегрева — шаги блока 21: вилку трогают
 * после двух часов печати, тёплая значит плохой контакт, горячая или чёрный
 * след — снимай питание и зови электрика; шнур смотрят по всей длине, заломы,
 * потёртости и запах изоляции это перегрев; нагар на розетке значит перегрузку,
 * а розетку меняет электрик. Нижние строки — блок 17: один удлинитель для
 * одного мощного прибора, вилку тянут за корпус, а не за шнур, и осмотр идёт
 * по порядку — вилка, шнур, розетка, удлинитель.
 */
export function ConfidentC3Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Осмотр вилки, шнура, розетки и удлинителя — четыре признака перегрева. Тёплая вилка после двух часов печати — плохой контакт, горячая вилка или чёрный след — снимай питание и зови электрика. Заломы, потёртости и запах изоляции на шнуре. Нагар на розетке — перегрузка, розетку меняет электрик. Один удлинитель — один мощный прибор, а вилку тянут за корпус, не за шнур, и осмотр идёт по порядку: вилка, шнур, розетка, удлинитель"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Осмотр вилки, шнура и розетки
        </text>

        {/* Четыре предмета осмотра: вилка, шнур, розетка и удлинитель */}
        {ITEMS.map((label, index) => {
          const cx = ITEM_CX[index];
          return (
            <g key={label}>
              <rect
                x={ITEM_X[index]}
                y={ITEM_Y}
                width={ITEM_W}
                height={ITEM_H}
                rx="5"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              {index === 0 && (
                <>
                  <rect
                    x={cx - 8}
                    y="32"
                    width="16"
                    height="12"
                    rx="2"
                    fill="#475569"
                    fillOpacity="0.4"
                    stroke="#64748b"
                  />
                  <line x1={cx - 4} y1="32" x2={cx - 4} y2="26" stroke="#94a3b8" />
                  <line x1={cx + 4} y1="32" x2={cx + 4} y2="26" stroke="#94a3b8" />
                  <line x1={cx} y1="44" x2={cx} y2="48" stroke="#64748b" />
                </>
              )}
              {index === 1 && (
                <>
                  <path
                    d={`M ${cx - 14} 36 q 7 -10 14 0 q 7 10 14 0`}
                    fill="none"
                    stroke="#64748b"
                  />
                  <circle cx={cx + 7} cy="32" r="2.5" fill="#f59e0b" fillOpacity="0.6" />
                </>
              )}
              {index === 2 && (
                <>
                  <rect
                    x={cx - 11}
                    y="26"
                    width="22"
                    height="22"
                    rx="3"
                    fill="#0f172a"
                    fillOpacity="0.6"
                    stroke="#64748b"
                  />
                  <circle cx={cx - 5} cy="35" r="2" fill="#94a3b8" fillOpacity="0.6" />
                  <circle cx={cx + 5} cy="35" r="2" fill="#94a3b8" fillOpacity="0.6" />
                </>
              )}
              {index === 3 && (
                <>
                  <rect
                    x={cx - 16}
                    y="32"
                    width="32"
                    height="13"
                    rx="3"
                    fill="#0f172a"
                    fillOpacity="0.6"
                    stroke="#64748b"
                  />
                  <circle cx={cx - 9} cy="38.5" r="2" fill="#94a3b8" fillOpacity="0.5" />
                  <circle cx={cx} cy="38.5" r="2" fill="#94a3b8" fillOpacity="0.5" />
                  <circle cx={cx + 9} cy="38.5" r="2" fill="#94a3b8" fillOpacity="0.5" />
                  <line x1={cx - 16} y1="38.5" x2={cx - 23} y2="38.5" stroke="#64748b" />
                </>
              )}
              <text x={cx} y="58" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}

        {/* Четыре признака перегрева: вилка, шнур, розетка, удлинитель */}
        {FINDINGS.map((finding, index) => {
          const y = FINDING_Y[index];
          return (
            <g key={finding.color}>
              <rect
                x="12"
                y={y}
                width="296"
                height={FINDING_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={finding.color}
                strokeOpacity="0.45"
              />
              <rect
                x="16"
                y={y + 8}
                width="3"
                height={FINDING_H - 16}
                rx="1.5"
                fill={finding.color}
                fillOpacity="0.7"
              />
              <text x="26" y={y + 13} fontSize="10" fill="#e2e8f0">
                {finding.line1}
              </text>
              <text x="26" y={y + 25} fontSize="10" fill="#94a3b8">
                {finding.line2}
              </text>
            </g>
          );
        })}

        {/* Порядок осмотра и правила удлинителя */}
        <rect
          x="12"
          y="134"
          width="296"
          height="36"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={145 + index * 11}
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
