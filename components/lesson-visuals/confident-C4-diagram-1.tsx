import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Операции: строки 22…150 через 26, высота 24; СИЗ — правая колонка с x=170. */
const ROW_Y = [22, 48, 74, 100, 126];
const ROW_H = 24;
const LABEL_X = 42;
const PPE_X = 170;

type Operation = { label: string; ppe: string; color: string };

/** Пять операций и набор СИЗ — блок 16; очки, фартук и респиратор — блоки 15, 23. */
const OPERATIONS: Operation[] = [
  { label: "Смола в ванночке", ppe: "нитрил 0,1–0,15, очки", color: "#f87171" },
  { label: "Промывка модели", ppe: "нитрил 0,3 мм, очки", color: "#3b82f6" },
  { label: "Слив смолы, спирта", ppe: "щиток лица, фартук ПВХ", color: "#f59e0b" },
  { label: "Шлифовка, пыль", ppe: "респиратор, очки", color: "#10b981" },
  { label: "Уборка, протирка", ppe: "перчатки, ведро", color: "#cbd5e1" },
];

const NOTES = [
  "Перчатки выше запястья: зазор с рукавом закрыт",
  "Старт 2–4 тыс. ₽: перчатки 500–900 ₽, очки 300–700 ₽",
];

/**
 * Кадр блока 16 урока C4 «Что надеть: карта операций».
 *
 * Пять операций из описания кадра `C4_ppe_map.png` и списка блока 15: со смолой
 * в ванночке работают в нитриле 0,1–0,15 мм и закрытых очках; промывка модели
 * идёт в нитриле 0,3 мм; слив смолы и спирта требует щитка лица и фартука из
 * ПВХ, потому что тканевый фартук впитывает смолу и остаётся источником;
 * шлифовка отвердевшей смолы даёт пыль, поэтому нужны респиратор и очки
 * (блок 23); уборка и протирка — перчатки и ведро с крышкой, иначе мокрые
 * расходники пахнут и пачкают. Нижние строки — блоки 15 и 17: перчатки берут
 * выше запястья, чтобы закрыть зазор с рукавом, а стартовый набор стоит 2–4
 * тыс. ₽ — перчатки 500–900 ₽, очки 300–700 ₽.
 */
export function ConfidentC4Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Что надеть: карта операций. Со смолой в ванночке — нитрил 0,1–0,15 мм и закрытые очки. Промывка модели — нитрил 0,3 мм и очки. Слив смолы и спирта — щиток лица и фартук из ПВХ. Шлифовка смолы и пыль — респиратор и очки. Уборка и протирка — перчатки и ведро с крышкой. Перчатки выше запястья, чтобы зазор с рукавом был закрыт. Стартовый набор стоит 2–4 тыс. ₽: перчатки 500–900 ₽, очки 300–700 ₽"
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
          Что надеть: карта операций
        </text>
        <text x="308" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          СИЗ к операции
        </text>

        {/* Пять операций: слева название, справа нужный набор СИЗ */}
        {OPERATIONS.map((operation, index) => {
          const y = ROW_Y[index];
          return (
            <g key={operation.label}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x="12"
                y={y}
                width="2.5"
                height={ROW_H}
                rx="1"
                fill={operation.color}
                fillOpacity="0.8"
              />
              <text x="22" y={y + 15} fontSize="10" fill="#64748b">
                {index + 1}
              </text>
              <text x={LABEL_X} y={y + 15} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {operation.label}
              </text>
              <text x={PPE_X} y={y + 15} fontSize="10" fill={operation.color}>
                {operation.ppe}
              </text>
            </g>
          );
        })}

        <line x1="12" y1="155" x2="308" y2="155" stroke="#475569" strokeOpacity="0.4" />

        {/* Запястье и стартовый набор */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={167 + index * 11}
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
