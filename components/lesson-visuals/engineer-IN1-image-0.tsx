import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Ось температур: 40 °C — x=56, 130 °C — x=264. */
const X = (temp: number) => 56 + ((temp - 40) / 90) * 208;

type Row = {
  name: string;
  min: number;
  max: number;
  value: string;
  color: string;
};

/** Блок 4: шкала теплостойкости четырёх материалов, цифры из блока. */
const ROWS: Row[] = [
  { name: "PLA", min: 55, max: 60, value: "55–60", color: "#60a5fa" },
  { name: "PETG", min: 75, max: 80, value: "75–80", color: "#10b981" },
  { name: "ASA", min: 95, max: 100, value: "95–100", color: "#f59e0b" },
  { name: "PA / PC", min: 120, max: 120, value: "120", color: "#f87171" },
];

/**
 * Кадр блока 4 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_heat_ladder.png`: горизонтальная шкала HDT и
 * четыре материала. Длина полосы — обещанная теплостойкость, справа та же
 * цифра числом. Пунктир на 70–75 °C — рабочая зона из блока 3: деталь ставят
 * туда, где температура не подходит к HDT вплотную.
 */
export function EngineerIN1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шкала теплостойкости: PLA держит 55–60 °C, PETG 75–80, ASA 95–100, PA и PC 120. Горизонтальная ось от 40 до 130 градусов, пунктиром отмечена рабочая зона 70–75 °C. Внизу правило: запас 20–30 °C до рабочей температуры"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          HDT, °C — под нагрузкой
        </text>

        <rect
          x={X(70)}
          y="32"
          width={X(75) - X(70)}
          height="94"
          fill="#fcd34d"
          fillOpacity="0.12"
        />
        <line x1={X(70)} y1="32" x2={X(70)} y2="126" stroke="#fcd34d" strokeDasharray="3 3" strokeOpacity="0.6" />
        <line x1={X(75)} y1="32" x2={X(75)} y2="126" stroke="#fcd34d" strokeDasharray="3 3" strokeOpacity="0.6" />
        <text x={(X(70) + X(75)) / 2} y="27" fontSize="10" fill="#fcd34d" textAnchor="middle">
          70–75 °C
        </text>

        {ROWS.map((row, index) => {
          const y = 42 + index * 24;
          const single = row.min === row.max;
          return (
            <g key={row.name}>
              <text x="12" y={y + 8} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {row.name}
              </text>
              {single ? (
                <circle cx={X(row.max)} cy={y + 4} r="4" fill={row.color} />
              ) : (
                <rect
                  x={X(row.min)}
                  y={y}
                  width={X(row.max) - X(row.min)}
                  height="8"
                  rx="4"
                  fill={row.color}
                  fillOpacity="0.85"
                />
              )}
              <text x="304" y={y + 8} fontSize="10" fill="#cbd5e1" textAnchor="end">
                {row.value}
              </text>
            </g>
          );
        })}

        <line x1="56" y1="130" x2="264" y2="130" stroke="#475569" />
        {[40, 60, 80, 100, 120, 130].map((temp) => (
          <g key={temp}>
            <line x1={X(temp)} y1="130" x2={X(temp)} y2="135" stroke="#475569" />
            <text x={X(temp)} y="146" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {temp}
            </text>
          </g>
        ))}

        <text x="12" y="166" fontSize="10" fill="#fcd34d">
          запас 20–30 °C до рабочей температуры
        </text>
      </svg>
    </VisualWrapper>
  );
}
