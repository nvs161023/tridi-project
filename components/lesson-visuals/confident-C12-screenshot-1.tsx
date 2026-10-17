import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно камеры: 12…308 по X, 18…138 по Y. */
const WIN_Y = 18;
const WIN_H = 120;
const BAR_H = 16;
const VALUE_X = 304;

type Row = { label: string; value: string; color?: string };

/** Что показала служба на кадре: блок 23. */
const ROWS: Row[] = [
  { label: "обнаружено", value: "спагетти", color: "#fcd34d" },
  { label: "уверенность", value: "96 %", color: "#fcd34d" },
  { label: "действие", value: "пауза", color: "#f87171" },
  { label: "печать", value: "на паузе", color: "#f87171" },
];

/**
 * Кадр блока 23 урока C12 «Рамка обнаружения на кадре».
 *
 * Макет из описания кадра `C12_ai_detect.png`: кадр камеры, рамка вокруг клубка
 * пластика и подписи справа. Блок 23 объясняет, что служба сравнивает кадры с
 * обычной печатью, блок 25 — что автопауза не всегда снимает нагрев.
 */
export function ConfidentC12Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Рамка обнаружения на кадре: кадр камеры со столом и деталью, справа от детали клубок пластика в рамке с подписью «спагетти 96 процентов». Служба обнаружила дефект, поставила печать на паузу и прислала уведомление. Автопауза не всегда снимает нагрев — это проверяют в настройках службы"
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
          кадр камеры и вердикт службы
        </text>

        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.9"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          камера · слой 118
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#f87171" textAnchor="end">
          LIVE
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Кадр камеры */}
        <rect
          x="16"
          y="38"
          width="172"
          height="92"
          rx="4"
          fill="#0f172a"
          stroke="#334155"
        />
        <line x1="20" y1="64" x2="184" y2="64" stroke="#475569" />
        <polygon points="24,122 180,122 164,100 40,100" fill="#1e293b" fillOpacity="0.9" />
        <rect
          x="64"
          y="88"
          width="48"
          height="18"
          fill="#60a5fa"
          fillOpacity="0.15"
          stroke="#60a5fa"
          strokeOpacity="0.6"
        />
        <polygon points="112,68 106,84 118,84" fill="#94a3b8" fillOpacity="0.8" />

        {/* Клубок пластика и рамка обнаружения */}
        <path
          d="M126 84 q4 -8 12 -5 t10 4 q7 1 6 8 t-8 6 q-2 7 -10 5 t-10 -6 q-6 -4 0 -12"
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.9"
        />
        <rect
          x="120"
          y="56"
          width="60"
          height="44"
          rx="3"
          fill="none"
          stroke="#f59e0b"
          strokeDasharray="4 3"
        />
        <text x="120" y="50" fontSize="10" fontWeight="700" fill="#fcd34d">
          спагетти 96 %
        </text>

        {/* Что видит служба */}
        {ROWS.map((row, index) => {
          const y = 52 + index * 18;
          return (
            <g key={row.label}>
              <text x="196" y={y} fontSize="10" fill="#94a3b8">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight="700"
                fill={row.color ?? "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="152" fontSize="10" fill="#cbd5e1">
          Служба остановила печать и прислала уведомление
        </text>
        <text x="12" y="166" fontSize="10" fill="#94a3b8">
          Автопауза не всегда снимает нагрев — проверь
        </text>
      </svg>
    </VisualWrapper>
  );
}
