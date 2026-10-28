import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три колонки: 12…100, 112…200 и 212…300; крышка 34…41, корпус 43…84. */
const COL_X = [12, 112, 212];
const COL_W = 88;
const COL_CX = [56, 156, 256];
const LID_Y = 34;
const BODY_TOP = 43;
const BODY_BOTTOM = 84;
const LINE_Y = 109;

type Bin = { title: string; color: string; lines: string[] };

/** Три корзины — блок 26; что куда идёт — блоки 25, 27. */
const BINS: Bin[] = [
  {
    title: "Мусор",
    color: "#94a3b8",
    lines: ["отвердевшая смола", "поддержки, юбки,", "брак печати", "PLA и PETG, если", "приёма рядом нет"],
  },
  {
    title: "Переработка",
    color: "#10b981",
    lines: ["чистые PLA, PETG", "и ABS без смолы", "упаковка, картон", "и бутылки"],
  },
  {
    title: "Опасные",
    color: "#f87171",
    lines: [
      "жидкая смола и всё,",
      "что ею вымазано",
      "спирт, растворитель",
      "перчатки, салфетки",
      "угольные вставки",
    ],
  },
];

const NOTES = [
  "Не в раковину и не в унитаз: смола, спирт, ацетон",
  "Сомневаешься — считай отходы опасными; подпиши корзины",
];

/**
 * Кадр блока 26 урока C4 «Три корзины на столе».
 *
 * Три ёмкости с подписями из описания кадра `C4_waste_bins.png` и списка
 * блока 25: в обычный мусор идут отвердевшая смола, поддержки, юбки и брак
 * печати, а также PLA и PETG, если переработки рядом нет; в переработку —
 * только чистые PLA, PETG и ABS без следов смолы и клея, упаковка, картон и
 * бутылки; в опасные — жидкая смола и всё, что ею вымазано, промывочный спирт,
 * ацетон и растворитель поддержек, перчатки и салфетки с растворителем,
 * угольные вставки после срока и банки с остатками химии. Нижние строки —
 * блоки 25 и 27: промывку, смолу и ацетон не льют в раковину и унитаз, а если
 * сомневаешься, отходы считают опасными — корзины для этого подписывают.
 */
export function ConfidentC4Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три корзины на столе. Обычный мусор: отвердевшая смола, поддержки, юбки, брак печати, PLA и PETG, если переработки рядом нет. Переработка: чистые PLA, PETG и ABS без следов смолы и клея, упаковка, картон, бутылки. Опасные отходы: жидкая смола и всё, что ею вымазано, промывочный спирт, ацетон, растворитель поддержек, перчатки и салфетки с растворителем, угольные вставки, банки с остатками химии. Не в раковину и не в унитаз. Сомневаешься — считай отходы опасными, корзины подпиши"
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
          Три корзины: мусор, переработка, опасные
        </text>

        {/* Три подписанные ёмкости и то, что в них идёт */}
        {BINS.map((bin, index) => {
          const x = COL_X[index];
          return (
            <g key={bin.title}>
              <rect
                x={x}
                y={LID_Y}
                width={COL_W}
                height="7"
                rx="2"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke={bin.color}
                strokeOpacity="0.6"
              />
              <rect x={x + 38} y="30" width="12" height="4" rx="2" fill={bin.color} fillOpacity="0.35" />
              <polygon
                points={`${x + 6},${BODY_TOP} ${x + 82},${BODY_TOP} ${x + 74},${BODY_BOTTOM} ${x + 14},${BODY_BOTTOM}`}
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={bin.color}
                strokeOpacity="0.55"
              />
              <text
                x={COL_CX[index]}
                y="97"
                fontSize="10"
                fontWeight="700"
                fill={bin.color}
                textAnchor="middle"
              >
                {bin.title}
              </text>
              {bin.lines.map((line, lineIndex) => (
                <text key={line} x={x} y={LINE_Y + lineIndex * 11} fontSize="10" fill="#cbd5e1">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Куда нельзя и правило сомнения: базовая линия ≤ 172, иначе низ
            строки упирается в рамку карточки на узких экранах */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={161 + index * 11}
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
