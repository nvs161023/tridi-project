import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 29 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_outdoor.png`: три детали на улице — качели из PA/PETG,
 * бак из PETG/PA и держатель из ASA. Внизу — предел PLA 40–60 °C
 * и обязательный запас прочности ×2 из блока 23.
 */
export function EngineerIN5Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Улица: солнце, мороз и вода. Слева качели из PA или PETG, в центре бак из PETG или PA, справа держатель из ASA. Внизу предупреждение: PLA ползёт при 40–60 градусах, нужен запас прочности в два раза"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <linearGradient id="in5-5-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          улица: солнце, мороз и вода
        </text>

        <rect x="12" y="23" width="296" height="121" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />

        {/* Солнце */}
        <circle cx="286" cy="40" r="10" fill="#fbbf24" fillOpacity="0.2" stroke="#fbbf24" strokeWidth="0.9" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={`in5-5-sun-${i}`}
              x1={286 + Math.cos(a) * 13}
              y1={40 + Math.sin(a) * 13}
              x2={286 + Math.cos(a) * 17}
              y2={40 + Math.sin(a) * 17}
              stroke="#fbbf24"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
          );
        })}

        {/* Земля */}
        <line x1="20" y1="123" x2="300" y2="123" stroke="#64748b" strokeWidth="1.1" />
        <path d="M24 123 Q34 118 44 123 T64 123" fill="none" stroke="#94a3b8" strokeWidth="0.7" strokeOpacity="0.5" />

        {/* Качели */}
        <line x1="34" y1="54" x2="90" y2="54" stroke="#94a3b8" strokeWidth="1.6" />
        <line x1="34" y1="54" x2="24" y2="123" stroke="#94a3b8" strokeWidth="1.3" />
        <line x1="34" y1="54" x2="44" y2="123" stroke="#94a3b8" strokeWidth="1.3" />
        <line x1="90" y1="54" x2="80" y2="123" stroke="#94a3b8" strokeWidth="1.3" />
        <line x1="90" y1="54" x2="100" y2="123" stroke="#94a3b8" strokeWidth="1.3" />
        <line x1="58" y1="54" x2="56" y2="91" stroke="#cbd5e1" strokeWidth="0.7" />
        <line x1="66" y1="54" x2="68" y2="91" stroke="#cbd5e1" strokeWidth="0.7" />
        <rect x="52" y="91" width="20" height="3" rx="1" fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.5" />

        {/* Бак */}
        <rect x="124" y="80" width="48" height="43" rx="4" fill="#334155" stroke="#94a3b8" />
        <ellipse cx="148" cy="80" rx="24" ry="5" fill="#475569" stroke="#94a3b8" />
        <rect x="128" y="72" width="40" height="8" rx="2" fill="#334155" stroke="#94a3b8" />
        <rect x="128" y="98" width="40" height="21" rx="2" fill="url(#in5-5-water)" />
        <path d="M128 98 Q136 94 144 98 T160 98 T168 98" fill="none" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1="124" y1="92" x2="172" y2="92" stroke="#64748b" strokeWidth="0.6" />
        <line x1="124" y1="106" x2="172" y2="106" stroke="#64748b" strokeWidth="0.6" />
        <rect x="170" y="108" width="5" height="3" rx="1" fill="#94a3b8" />

        {/* Держатель на стене */}
        <line x1="218" y1="50" x2="218" y2="124" stroke="#94a3b8" strokeWidth="1.4" />
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`in5-5-wall-${i}`}
            x1="218"
            y1={52 + i * 9}
            x2="210"
            y2={46 + i * 9}
            stroke="#94a3b8"
            strokeWidth="0.7"
            strokeOpacity="0.6"
          />
        ))}
        <line x1="218" y1="92" x2="244" y2="92" stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points="238,84 278,62 292,80 252,102" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.1" />
        <line x1="246" y1="82" x2="282" y2="63" stroke="#60a5fa" strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="250" y1="89" x2="286" y2="70" stroke="#60a5fa" strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="254" y1="96" x2="290" y2="77" stroke="#60a5fa" strokeWidth="0.7" strokeOpacity="0.7" />
        <circle cx="238" cy="84" r="2" fill="#cbd5e1" />
        <circle cx="252" cy="102" r="2" fill="#cbd5e1" />

        {/* Подписи материалов */}
        <text x="20" y="138" fontSize="10" fontWeight="700" fill="#fbbf24">
          качели · PA/PETG
        </text>
        <text x="124" y="138" fontSize="10" fontWeight="700" fill="#7dd3fc">
          бак · PETG/PA
        </text>
        <text x="224" y="138" fontSize="10" fontWeight="700" fill="#6ee7b7">
          держатель · ASA
        </text>

        <text x="160" y="162" fontSize="10" fill="#f87171" textAnchor="middle">
          PLA ползёт 40–60 °C · запас ×2
        </text>
      </svg>
    </VisualWrapper>
  );
}
