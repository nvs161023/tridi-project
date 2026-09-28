import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три кадра истории одной детали: фото поломки, чертёж, установка. */
const PANELS = [12, 115, 218];

/** Штрихи шкалы штангенциркуля. */
const CALIPER_TICKS = [137, 144, 151, 158];

/** Крепления ручки на двери: две стойки с винтами. */
const POSTS = [240, 280];

/** Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что у проверки читаемости. */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Пример: ручка холодильника — от сломанной детали до готовой в трёх кадрах.
 * В первом кадре фото сломанной ручки с разломом, во втором модель по размерам —
 * со штангенциркулем над чертежом, размером и допуском (±0,2) и подписями про
 * усадку PLA 0,3% и PETG 0,5%, в третьем деталь на месте: готовая ручка,
 * прикрученная винтами к двери холодильника.
 *
 * Ровно по content урока: «Фото: сломанная ручка, измерение, модель, напечатанная
 * деталь на месте», «Усадка материала: PLA 0,3%, PETG 0,5%» и по steps: измерь
 * штангенциркулем, смоделируй, напечатай, проверь.
 *
 * От L-L2-image-0 (диорама из четырёх предметов разной природы) отличается тем, что
 * здесь один предмет в трёх состояниях; от M-M7-image-0 (одна деталь и три зоны
 * работы инструментами) — тем, что там операции над деталью, а здесь путь детали:
 * сломалась, измерена, стоит на месте.
 */
export function ProNN6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пример: ручка холодильника — от сломанной детали до готовой в трёх кадрах. Первый: фото сломанной ручки с разломом посередине. Второй: модель по размерам — чертёж ручки со штангенциркулем, размером 180 плюс-минус 0,2 и подписями про усадку PLA 0,3 процента и PETG 0,5 процента. Третий: деталь на месте — готовая ручка, прикрученная винтами к двери холодильника"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Пример: ручка холодильника
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          от сломанной детали до готовой
        </text>

        {/* Три кадра истории */}
        {PANELS.map((x) => (
          <rect
            key={`panel-${x}`}
            x={x}
            y="38"
            width="90"
            height="112"
            rx="8"
            fill="#1e293b"
            stroke="#475569"
          />
        ))}

        {/* Кадр 1: фото сломанной ручки с разломом */}
        <rect x="20" y="44" width="74" height="56" rx="4" fill="#1e293b" stroke="#475569" />
        <rect x="25" y="49" width="64" height="46" rx="2" fill="#0f172a" stroke="#334155" />
        <rect x="30" y="66" width="24" height="10" rx="3" fill="#64748b" />
        <rect x="60" y="66" width="24" height="10" rx="3" fill="#64748b" />
        <polyline points="54,66 57,69 55,72 58,76" fill="none" stroke="#f87171" strokeWidth="1" />
        <text x={centerX(57, "1. сломалась", 7.5)} y="114" fontSize="7.5" fill="#e2e8f0">
          1. сломалась
        </text>
        <text x={centerX(57, "измеряем размеры", 7.5)} y="128" fontSize="7.5" fill="#94a3b8">
          измеряем размеры
        </text>

        {/* Кадр 2: чертёж и штангенциркуль над ним */}
        <rect x="132" y="48" width="56" height="4" fill="#64748b" />
        {CALIPER_TICKS.map((x) => (
          <line key={`tick-${x}`} x1={x} y1="48" x2={x} y2="51" stroke="#94a3b8" strokeWidth="0.7" />
        ))}
        <polygon points="131,48 131,42 136,42 136,48" fill="#94a3b8" />
        <rect x="168" y="44" width="12" height="10" rx="2" fill="#64748b" />
        <polygon points="170,44 170,42 175,42 175,44" fill="#94a3b8" />

        <rect x="127" y="68" width="66" height="12" rx="5" fill="#475569" stroke="#94a3b8" />
        <line x1="127" y1="74" x2="193" y2="74" stroke="#64748b" strokeDasharray="4 3" />
        <circle cx="139" cy="74" r="2.5" fill="#0f172a" />
        <circle cx="181" cy="74" r="2.5" fill="#0f172a" />

        {/* Размер с допуском: он же ответ на усадку материала */}
        <line x1="127" y1="80" x2="127" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="193" y1="80" x2="193" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="127" y1="92" x2="135" y2="92" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="185" y1="92" x2="193" y2="92" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="127" y1="94" x2="131" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="189" y1="94" x2="193" y2="90" stroke="#94a3b8" strokeWidth="0.7" />
        <text x="139.4" y="95" fontSize="7.5" fill="#e2e8f0">
          180 ±0,2
        </text>

        <text x={centerX(160, "усадка PLA 0,3%", 7.5)} y="112" fontSize="7.5" fill="#e2e8f0">
          усадка PLA 0,3%
        </text>
        <text x={centerX(160, "PETG 0,5%", 7.5)} y="126" fontSize="7.5" fill="#e2e8f0">
          PETG 0,5%
        </text>
        <text x={centerX(160, "2. модель по размерам", 7.5)} y="140" fontSize="7.5" fill="#94a3b8">
          2. модель по размерам
        </text>

        {/* Кадр 3: готовая ручка на двери холодильника */}
        <rect x="228" y="42" width="70" height="76" rx="3" fill="#334155" stroke="#64748b" />
        <rect x="233" y="47" width="60" height="66" fill="none" stroke="#64748b" />
        <rect x="238" y="70" width="50" height="9" rx="4" fill="#94a3b8" />
        {POSTS.map((x) => (
          <g key={`post-${x}`}>
            <rect x={x} y="79" width="6" height="8" fill="#64748b" />
            <circle cx={x + 3} cy="83" r="1.6" fill="#0f172a" />
          </g>
        ))}
        <text x={centerX(263, "3. готовая ручка", 7.5)} y="132" fontSize="7.5" fill="#e2e8f0">
          3. готовая ручка
        </text>
        <text x={centerX(263, "деталь на месте", 7.5)} y="146" fontSize="7.5" fill="#94a3b8">
          деталь на месте
        </text>

        {/* Один кейс целиком: путь детали из списка шагов урока */}
        <text x={centerX(160, "путь детали: измерил, смоделировал, напечатал, проверил", 7.5)} y="166" fontSize="7.5" fill="#94a3b8">
          путь детали: измерил, смоделировал, напечатал, проверил
        </text>
      </svg>
    </VisualWrapper>
  );
}
