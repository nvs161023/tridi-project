import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Устройство принтера — изометрия с пятью пронумерованными узлами.
 *
 * Ракурс: изометрия, принтер целиком, средняя детализация. Единственный
 * температурный акцент — сопло (200–240 °C из урока). Рядом с соплом оранжевая
 * метка, остальные узлы холодные серо-синие, чтобы взгляд шёл по подписям.
 *
 * Пять узлов из content урока: сопло (hotend) — 200–240 °C, стол, катушка,
 * экструдер, рама и ремни.
 */
export function Basic1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Изометрическая схема устройства FDM-принтера: сопло с температурой 200–240 °C, стол для модели, катушка с филаментом, экструдер, рама и ремни"
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

        {/* Рама: нижняя и верхняя грани изометрического короба */}
        <polygon
          points="112,148 178,158 200,138 134,128"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.2"
        />
        <polygon
          points="112,84 178,94 200,74 134,64"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.2"
        />
        <polyline points="112,148 112,84" fill="none" stroke="#475569" strokeWidth="1.2" />
        <polyline points="178,158 178,94" fill="none" stroke="#475569" strokeWidth="1.2" />
        <polyline points="200,138 200,74" fill="none" stroke="#475569" strokeWidth="1.2" />
        <polyline points="134,128 134,64" fill="none" stroke="#475569" strokeWidth="1.2" />

        {/* Стол, на котором растёт модель */}
        <polygon
          points="120,126 186,136 202,120 136,110"
          fill="#1e3a5f"
          fillOpacity="0.7"
          stroke="#3b82f6"
          strokeWidth="1.2"
        />

        {/* Ремни: две нити вдоль портала */}
        <line x1="116" y1="108" x2="182" y2="118" stroke="#64748b" strokeWidth="1" />
        <line x1="116" y1="103" x2="182" y2="113" stroke="#64748b" strokeWidth="1" />

        {/* Каретка с соплом */}
        <polygon
          points="142,100 158,105 158,113 142,108"
          fill="#334155"
          stroke="#475569"
          strokeWidth="1"
        />
        <polygon points="150,113 158,115 154,124" fill="#f59e0b" />

        {/* Катушка с филаментом */}
        <circle cx="140" cy="44" r="16" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
        <circle cx="140" cy="44" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <path
          d="M152,50 C170,60 150,88 152,99"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* Экструдер с шестернёй подачи */}
        <polygon
          points="186,88 206,93 206,105 186,100"
          fill="#334155"
          stroke="#475569"
          strokeWidth="1"
        />
        <circle cx="196" cy="96" r="4" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />

        {/* Выноски: подписи никогда не лежат на деталях */}
        <polyline
          points="60,92 108,104 146,112"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <circle cx="148" cy="112" r="2" fill="#f59e0b" />
        <polyline
          points="58,140 100,140 130,131"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="0.9"
        />
        <circle cx="131" cy="131" r="2" fill="#3b82f6" />
        <polyline
          points="248,34 176,40 158,42"
          fill="none"
          stroke="#475569"
          strokeWidth="0.9"
        />
        <circle cx="157" cy="43" r="2" fill="#94a3b8" />
        <polyline
          points="236,68 222,74 206,96"
          fill="none"
          stroke="#475569"
          strokeWidth="0.9"
        />
        <circle cx="205" cy="97" r="2" fill="#94a3b8" />
        <polyline
          points="106,166 150,158 174,153"
          fill="none"
          stroke="#475569"
          strokeWidth="0.9"
        />
        <circle cx="175" cy="153" r="2" fill="#94a3b8" />

        {/* Подписи узлов */}
        <text x="14" y="70" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          1 Сопло
        </text>
        <text x="14" y="86" fontSize="10" fill="#f59e0b" dominantBaseline="middle">
          200–240 °C
        </text>
        <text x="14" y="132" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          2 Стол
        </text>
        <text x="14" y="148" fontSize="10" fill="#94a3b8" dominantBaseline="middle">
          растёт модель
        </text>
        <text
          x="306"
          y="34"
          fontSize="10"
          fill="#e2e8f0"
          textAnchor="end"
          dominantBaseline="middle"
        >
          3 Катушка
        </text>
        <text
          x="306"
          y="68"
          fontSize="10"
          fill="#e2e8f0"
          textAnchor="end"
          dominantBaseline="middle"
        >
          4 Экструдер
        </text>
        <text x="14" y="170" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          5 Рама и ремни
        </text>
      </svg>
    </VisualWrapper>
  );
}
