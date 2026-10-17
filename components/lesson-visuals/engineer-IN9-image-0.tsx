import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 19 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_feed_extrude.png`: сечение линии 0,42 на 0,2 мм и пруток
 * 1,75 мм. Площадь линии 0,084 мм², прутка — 2,41 мм², расход — 0,035 мм нити на
 * миллиметр пути. Числа — блок 17, подача F1200 = 20 мм/с и строка
 * `G1 X100 E3.5 F1200` — блок 16, поправка ширины на 0,45 (+7 %) — блок 17.
 */
export function EngineerIN9Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сечение линии 0,42 на 0,2 миллиметра площадью 0,084 квадратного миллиметра и пруток диаметром 1,75 миллиметра площадью 2,41. Делим одно на другое и получаем 0,035 миллиметра нити на миллиметр пути: сто миллиметров дают E3.5. Подача F1200 — это двадцать миллиметров в секунду. Ширина 0,45 вместо 0,42 добавляет семь процентов расхода"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          отрезок, ширина и поток
        </text>
        <text x="308" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          G1 X100 E3.5 F1200
        </text>

        <defs>
          <marker id="in9-4-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Сечение линии */}
        <text x="24" y="34" fontSize="10" fontWeight="700" fill="#38bdf8">
          сечение линии
        </text>
        <rect x="30" y="42" width="96" height="36" rx="2" fill="#38bdf8" fillOpacity="0.22" stroke="#38bdf8" strokeOpacity="0.8" />
        <path d="M30 42 L126 78 M42 42 L126 69 M54 42 L126 60 M66 42 L126 51 M78 42 L126 42" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.25" />
        <text x="78" y="92" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          0,42 × 0,2 мм
        </text>

        {/* Пруток */}
        <text x="214" y="34" fontSize="10" fontWeight="700" fill="#f472b6">
          пруток
        </text>
        <circle cx="234" cy="60" r="22" fill="#f472b6" fillOpacity="0.18" stroke="#f472b6" strokeOpacity="0.8" />
        <path d="M234 38 V50 M234 70 V82" stroke="#f472b6" strokeWidth="0.8" strokeOpacity="0.6" />
        <text x="234" y="94" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          Ø1,75 мм
        </text>

        <path d="M142 60 H202" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in9-4-arrow)" />
        <text x="172" y="52" fontSize="11" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          ÷
        </text>

        <text x="12" y="112" fontSize="10" fill="#cbd5e1">
          площадь линии 0,084 мм² · пруток 2,41 мм²
        </text>
        <text x="12" y="128" fontSize="10" fill="#34d399">
          0,084 ÷ 2,41 = 0,035 мм нити на мм пути
        </text>

        <rect x="12" y="136" width="296" height="38" rx="6" fill="#38bdf8" fillOpacity="0.08" stroke="#38bdf8" strokeOpacity="0.3" />
        <text x="22" y="151" fontSize="10" fill="#e2e8f0">
          100 мм пути → E3.5 · F1200 = 20 мм/с
        </text>
        <text x="22" y="167" fontSize="10" fill="#fbbf24">
          ширина 0,45 вместо 0,42 — +7 % расхода
        </text>
      </svg>
    </VisualWrapper>
  );
}
