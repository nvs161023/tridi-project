import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Отметки оси времени. Последняя несёт единицу измерения и прижата к правому
 * полю (x = 308): отдельное «мин» от x = 300 выходило за карточку на 11 px.
 */
const TICKS = [
  { x: 40, label: "0", anchor: "middle" },
  { x: 124, label: "30", anchor: "middle" },
  { x: 208, label: "60", anchor: "middle" },
  { x: 308, label: "90 мин", anchor: "end" },
] as const;

/**
 * Кадр блока 27 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_annealing_curve.png`: температура, время выдержки и
 * усадка. Числа — блок 25: PLA 80–90°, PETG 100°, выдержка 30–60 мин, плюс
 * десять минут на каждые три миллиметра, медленное остывание в духовке, усадка
 * 1–2 %, прочность на разрыв плюс треть. Оправка и замеры — блок 26.
 */
export function EngineerIN10Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Кривая отжига: PLA держится при 80–90 градусах, PETG при 100, выдержка от 30 до 60 минут, плюс десять минут на каждые три миллиметра толщины. После выдержки деталь остывает медленно вместе с духовкой. Прочность на разрыв растёт примерно на треть, усадка составляет один-два процента"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          отжиг: полка и медленное остывание
        </text>

        <path d="M40 34 V126 H292" fill="none" stroke="#64748b" strokeWidth="1" />
        <path d="M40 46 H292 M40 66 H292" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
        <text x="36" y="49" fontSize="10" fill="#94a3b8" textAnchor="end">
          100
        </text>
        <text x="36" y="69" fontSize="10" fill="#94a3b8" textAnchor="end">
          80
        </text>
        <text x="36" y="126" fontSize="10" fill="#94a3b8" textAnchor="end">
          20
        </text>
        <text x="36" y="31" fontSize="10" fill="#94a3b8" textAnchor="end">
          °C
        </text>

        <path d="M124 34 V126 M208 34 V126" stroke="#475569" strokeWidth="0.8" strokeDasharray="2 3" />
        <text x="128" y="29" fontSize="10" fill="#fbbf24">
          выдержка 30–60 мин
        </text>

        <path d="M40 126 C62 96 82 56 104 47 L124 47 H208 C240 64 270 100 292 126" fill="none" stroke="#f472b6" strokeWidth="1.8" />
        <path d="M40 126 C60 100 76 72 100 66 L124 61 H208 C240 72 268 100 292 126" fill="none" stroke="#38bdf8" strokeWidth="1.8" />

        <text x="112" y="44" fontSize="10" fontWeight="700" fill="#f472b6">
          PETG 100°
        </text>
        <text x="112" y="80" fontSize="10" fontWeight="700" fill="#38bdf8">
          PLA 80–90°
        </text>

        {TICKS.map((tick) => (
          <text key={tick.label} x={tick.x} y="138" fontSize="10" fill="#94a3b8" textAnchor={tick.anchor}>
            {tick.label}
          </text>
        ))}

        <rect x="12" y="144" width="296" height="30" rx="6" fill="#fbbf24" fillOpacity="0.08" stroke="#fbbf24" strokeOpacity="0.3" />
        <text x="22" y="157" fontSize="10" fill="#e2e8f0">
          прочность +⅓ · усадка 1–2 %
        </text>
        <text x="22" y="171" fontSize="10" fill="#94a3b8">
          +10 мин на 3 мм · остывание в духовке
        </text>
      </svg>
    </VisualWrapper>
  );
}
