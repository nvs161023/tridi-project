import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 28 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_heat_time.png`: две кривые нагрева. Сопло идёт с 20 до
 * 210° за минуту-полторы, стол до 60° — за две-три минуты, до 100° — за семь-девять
 * (блок 27). Пауза `G4 P5000` после выхода в температуру — тоже блок 27.
 */
export function EngineerIN9Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две кривые нагрева: сопло проходит с 20 до 210 градусов за минуту-полторы, стол до 60 градусов за две-три минуты и до 100 градусов за семь-девять. После выхода в температуру нужна пауза G4 P5000 на пять секунд, чтобы тепло дошло до сопла"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          кривая нагрева: градусы и минуты
        </text>

        {/* Оси */}
        <path d="M34 30 V126 H302" fill="none" stroke="#64748b" strokeWidth="1" />
        <text x="296" y="120" fontSize="10" fill="#94a3b8" textAnchor="end">
          мин
        </text>

        {/* Сетка и подписи температур */}
        <path d="M34 106 H302 M34 86 H302" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
        <text x="30" y="109" fontSize="10" fill="#94a3b8" textAnchor="end">
          60
        </text>
        <text x="30" y="89" fontSize="10" fill="#94a3b8" textAnchor="end">
          100
        </text>
        <text x="30" y="35" fontSize="10" fill="#94a3b8" textAnchor="end">
          210
        </text>
        <text x="30" y="126" fontSize="10" fill="#94a3b8" textAnchor="end">
          20
        </text>
        {["0", "3", "6", "9"].map((tick, i) => (
          <text key={tick} x={34 + i * 89.3} y="138" fontSize="10" fill="#94a3b8" textAnchor="middle">
            {tick}
          </text>
        ))}

        {/* Сопло */}
        <path d="M34 121 C42 78 54 46 72 32" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
        <circle cx="72" cy="32" r="2.6" fill="#38bdf8" />
        <text x="78" y="40" fontSize="10" fontWeight="700" fill="#38bdf8">
          210° за 1–1,5 мин
        </text>

        {/* Стол */}
        <path d="M34 121 C58 113 84 108 108 106 C170 100 232 92 271 86" fill="none" stroke="#f472b6" strokeWidth="1.8" />
        <circle cx="108" cy="106" r="2.6" fill="#f472b6" />
        <circle cx="271" cy="86" r="2.6" fill="#f472b6" />
        <text x="114" y="120" fontSize="10" fontWeight="700" fill="#f472b6">
          60° · 2–3 мин
        </text>
        <text x="196" y="76" fontSize="10" fontWeight="700" fill="#f472b6">
          100° · 7–9 мин
        </text>

        <rect x="12" y="144" width="296" height="33" rx="6" fill="#38bdf8" fillOpacity="0.08" stroke="#38bdf8" strokeOpacity="0.3" />
        <text x="22" y="157" fontSize="10" fill="#e2e8f0">
          сопло греется быстрее стола: старт с M140
        </text>
        <text x="22" y="173" fontSize="10" fill="#38bdf8">
          после выхода в температуру — G4 P5000
        </text>
      </svg>
    </VisualWrapper>
  );
}
