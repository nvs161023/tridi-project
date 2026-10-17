import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BIG = { x: 74, y: 84, r: 30, n: 20 };
const SMALL = { x: 116, y: 84, r: 12, n: 8 };

/**
 * Кадр блока 9 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_gear.png`: ведущая шестерня на 20 зубьев и ведомая
 * на 8, момент 2 Н·м. Справа — POM/PA, 4 периметра, 60 % кубического
 * заполнения и предел 60 °C; внизу — зазор 0,1–0,2 мм и запрет PLA на силовой паре.
 */
export function EngineerIN5Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пара шестерён 20 и 8 зубьев с передаточным отношением 2,5 к 1. Момент 2 ньютон-метра. Справа параметры: POM или PA, 4 периметра, 60 процентов кубического заполнения, предел 60 градусов. Внизу зазор 0,1–0,2 миллиметра и пометка, что PLA годится только на тихоход"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in5-1-moment"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          шестерня 20 / 8 · передача 2,5:1
        </text>

        <rect x="12" y="23" width="188" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />

        {/* Ведущая шестерня: 20 зубьев */}
        <g>
          {Array.from({ length: BIG.n }, (_, i) => (
            <rect
              key={`in5-1-big-${i}`}
              x={BIG.x - 2.3}
              y={BIG.y - BIG.r - 5}
              width="4.6"
              height="7"
              rx="1"
              fill="#475569"
              stroke="#94a3b8"
              strokeWidth="0.5"
              transform={`rotate(${(i * 360) / BIG.n} ${BIG.x} ${BIG.y})`}
            />
          ))}
          <circle cx={BIG.x} cy={BIG.y} r={BIG.r - 2} fill="#334155" stroke="#94a3b8" />
          <circle cx={BIG.x} cy={BIG.y} r={BIG.r - 7} fill="none" stroke="#64748b" strokeWidth="0.8" />
          <text x={BIG.x} y={BIG.y + 4.5} fontSize="13" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
            20
          </text>
        </g>

        {/* Ведомая шестерня: 8 зубьев */}
        <g>
          {Array.from({ length: SMALL.n }, (_, i) => (
            <rect
              key={`in5-1-small-${i}`}
              x={SMALL.x - 1.8}
              y={SMALL.y - SMALL.r - 4}
              width="3.6"
              height="6"
              rx="0.8"
              fill="#475569"
              stroke="#94a3b8"
              strokeWidth="0.5"
              transform={`rotate(${(i * 360) / SMALL.n} ${SMALL.x} ${SMALL.y})`}
            />
          ))}
          <circle cx={SMALL.x} cy={SMALL.y} r={SMALL.r - 1} fill="#475569" stroke="#94a3b8" />
          <text x={SMALL.x} y={SMALL.y + 3.5} fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
            8
          </text>
        </g>

        {/* Момент */}
        <path d="M62 78 A12 12 0 1 1 74 96" fill="none" stroke="#38bdf8" strokeWidth="1.2" markerEnd="url(#in5-1-moment)" />
        <text x="14" y="41" fontSize="10" fontWeight="700" fill="#7dd3fc">
          2 Н·м
        </text>
        <line x1="36" y1="44" x2="56" y2="72" stroke="#38bdf8" strokeWidth="0.7" strokeOpacity="0.7" />

        {/* Зазор в зацеплении */}
        <circle cx="108" cy="82" r="2.6" fill="none" stroke="#fbbf24" strokeWidth="1" />
        <line x1="108" y1="85" x2="108" y2="119" stroke="#fbbf24" strokeWidth="0.7" />
        <text x="76" y="136" fontSize="10" fill="#fbbf24">
          зазор 0,1–0,2
        </text>

        {/* Режим печати */}
        <rect x="208" y="23" width="100" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          печать и режим
        </text>
        <text x="218" y="56" fontSize="10" fontWeight="700" fill="#fbbf24">
          момент 2 Н·м
        </text>
        <text x="218" y="73" fontSize="10" fill="#6ee7b7">
          POM / PA
        </text>
        <text x="218" y="90" fontSize="10" fill="#cbd5e1">
          4 периметра
        </text>
        <text x="218" y="107" fontSize="10" fill="#cbd5e1">
          60 % куб
        </text>
        <text x="218" y="124" fontSize="10" fill="#cbd5e1">
          ≤ 60 °C
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          PLA — только тихоход, не для силовой пары
        </text>
      </svg>
    </VisualWrapper>
  );
}
