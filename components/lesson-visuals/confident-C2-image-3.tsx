import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** План комнаты 12…308 и 22…136: четыре зоны по сетке 2×2. */
const ZONE_X = [24, 168];
const ZONE_W = [136, 128];
const ZONE_Y = [30, 82];
const ZONE_H = 46;

type Zone = { head: string; note1: string; note2: string; color: string };

/** Зоны и подписи — блок 19 плюс блоки 18, 20 и 23. */
const ZONES: Zone[] = [
  {
    head: "Печать",
    note1: "стол не играет",
    note2: "розетка в 1–1,5 м",
    color: "#3b82f6",
  },
  {
    head: "Постобработка",
    note1: "перчатки и очки",
    note2: "отдельный стол",
    color: "#10b981",
  },
  {
    head: "Пластик",
    note1: "сухие боксы",
    note2: "материал, цвет, дата",
    color: "#f59e0b",
  },
  {
    head: "Химия",
    note1: "ацетон, ИПС и клей",
    note2: "в закрытом шкафу",
    color: "#f87171",
  },
];

const NOTES = [
  "Первые пять минут печати стоят рядом",
  "Лампа 500–800 лм сбоку: дефект видно под светом",
  "Зона печати не совпадает с игровой зоной детей",
];

/**
 * Кадр блока 20 урока C2 «Организация мастерской».
 *
 * План комнаты по зонам из описания кадра `C2_workplace_layout.png`: печать,
 * постобработка, хранение пластика и шкаф с химией. Подписи собраны по соседним
 * блокам. Блок 19: стол не должен играть, розетка в 1–1,5 м без удлинителя под
 * ногами, инструмент и термостойкие перчатки под рукой, лампа 500–800 лм, зона
 * печати не совпадает с игровой зоной детей. Блок 21: сухие боксы, маркировка с
 * материалом, цветом и датой вскрытия, хранение отдельно от химии. Блок 24:
 * ацетон, ИПС и клей живут в закрытом шкафу, а работа с ними идёт не на столе
 * печати. Блок 23: первые пять минут печати стоят рядом и смотрят, как ложится
 * первый слой. Очки, перчатки и респиратор под рукой — блоки 19 и 26.
 */
export function ConfidentC2Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Организация мастерской: план комнаты по зонам. Зона печати: стол не играет, розетка в 1–1,5 м. Постобработка: перчатки и очки, отдельный стол. Пластик: сухие боксы, маркировка с материалом, цветом и датой. Химия: ацетон, ИПС и клей в закрытом шкафу. Первые пять минут печати стоят рядом, лампа 500–800 лм сбоку показывает дефект, а зона печати не совпадает с игровой зоной детей"
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
          Организация мастерской: четыре зоны
        </text>

        {/* План комнаты: зоны не пересекаются */}
        <rect
          x="12"
          y="22"
          width="296"
          height="114"
          rx="6"
          fill="#1e293b"
          fillOpacity="0.3"
          stroke="#475569"
          strokeOpacity="0.7"
        />

        {ZONES.map((zone, index) => {
          const x = ZONE_X[index % 2];
          const y = ZONE_Y[Math.floor(index / 2)];
          return (
            <g key={zone.head}>
              <rect
                x={x}
                y={y}
                width={ZONE_W[index % 2]}
                height={ZONE_H}
                rx="5"
                fill="#0f172a"
                fillOpacity="0.45"
                stroke={zone.color}
                strokeOpacity="0.5"
              />
              <rect
                x={x + 4}
                y={y + 7}
                width="3"
                height={ZONE_H - 14}
                rx="1.5"
                fill={zone.color}
                fillOpacity="0.7"
              />
              <text x={x + 12} y={y + 16} fontSize="10" fontWeight="700" fill={zone.color}>
                {zone.head}
              </text>
              <text x={x + 12} y={y + 29} fontSize="10" fill="#cbd5e1">
                {zone.note1}
              </text>
              <text x={x + 12} y={y + 40} fontSize="10" fill="#94a3b8">
                {zone.note2}
              </text>
            </g>
          );
        })}

        {/* Свет, первые минуты печати и живые существа */}
        <rect
          x="12"
          y="140"
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
            y={151 + index * 11}
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
