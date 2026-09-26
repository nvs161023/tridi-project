import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три схемы кинематики из content урока: Cartesian (стол по Y, голова по X и Z),
 * CoreXY (голова по X и Y, стол только Z) и Delta (три рычага, круглый стол).
 *
 * Панели — вид сверху, а не корпуса принтеров: так видно, кто и куда едет. От
 * «Точек обслуживания» и «Устройства принтера» в базовом курсе отличается и
 * ракурсом, и задачей: там узлы настоящей машины, здесь три схемы движения,
 * по одной на панель, плюс примеры и цифры из урока под каждой.
 */
export function ProAA2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три схемы кинематики вида сверху: Cartesian — стол едет по Y, голова по X и Z, это Ender-3 и Prusa; CoreXY — голова по X и Y, стол только по Z, это Voron и Bambu; Delta — три рычага и круглый стол, это Flsun"
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

        {/* --- Панель 1: Cartesian --- */}
        <text x="58" y="20" fontSize="10" fontWeight="bold" fill="#7dd3fc" textAnchor="middle">
          Cartesian
        </text>
        <rect x="12" y="34" width="92" height="92" rx="8" fill="#0f172a" stroke="#38bdf8" />
        <text x="16" y="42" fontSize="10" fill="#cbd5e1">
          голова: X, Z
        </text>
        <text x="16" y="56" fontSize="10" fill="#94a3b8">
          стол: Y
        </text>
        <line x1="26" y1="68" x2="84" y2="68" stroke="#94a3b8" strokeWidth="2.5" />
        <rect x="44" y="58" width="16" height="12" rx="2" fill="#1e293b" stroke="#38bdf8" />
        <polygon points="48,70 56,70 52,77" fill="#38bdf8" />
        <line x1="26" y1="82" x2="60" y2="82" stroke="#38bdf8" strokeWidth="1.2" />
        <polygon points="60,79 68,82 60,85" fill="#38bdf8" />
        <rect x="30" y="90" width="44" height="16" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="42" y="84" width="20" height="6" rx="1" fill="#93c5fd" />
        <line x1="52" y1="108" x2="52" y2="112" stroke="#38bdf8" strokeWidth="1.2" />
        <polygon points="48,112 56,112 52,119" fill="#38bdf8" />
        <line x1="92" y1="104" x2="92" y2="82" stroke="#38bdf8" strokeWidth="1.2" />
        <polygon points="88,82 96,82 92,75" fill="#38bdf8" />
        <text x="58" y="142" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          Ender-3, Prusa
        </text>
        <text x="58" y="158" fontSize="10" fill="#94a3b8" textAnchor="middle">
          просто, дёшево
        </text>

        {/* --- Панель 2: CoreXY --- */}
        <text x="160" y="20" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          CoreXY
        </text>
        <rect x="114" y="34" width="92" height="92" rx="8" fill="#0f172a" stroke="#34d399" />
        <text x="118" y="42" fontSize="10" fill="#cbd5e1">
          голова: X, Y
        </text>
        <text x="118" y="56" fontSize="10" fill="#94a3b8">
          стол: Z
        </text>
        <rect x="126" y="72" width="68" height="46" fill="#1e293b" stroke="#475569" />
        <line x1="126" y1="72" x2="194" y2="118" stroke="#94a3b8" />
        <line x1="194" y1="72" x2="126" y2="118" stroke="#94a3b8" />
        <circle cx="126" cy="72" r="3.5" fill="#334155" />
        <circle cx="194" cy="72" r="3.5" fill="#334155" />
        <circle cx="126" cy="118" r="3.5" fill="#334155" />
        <circle cx="194" cy="118" r="3.5" fill="#334155" />
        <rect x="118" y="64" width="12" height="10" fill="#475569" />
        <rect x="190" y="64" width="12" height="10" fill="#475569" />
        <rect x="152" y="88" width="16" height="14" rx="2" fill="#334155" stroke="#34d399" />
        <line x1="172" y1="95" x2="182" y2="95" stroke="#34d399" strokeWidth="1.2" />
        <polygon points="182,92 190,95 182,98" fill="#34d399" />
        <line x1="160" y1="80" x2="160" y2="76" stroke="#34d399" strokeWidth="1.2" />
        <polygon points="157,76 163,76 160,68" fill="#34d399" />
        <text x="160" y="142" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          Voron, Bambu
        </text>
        <text x="160" y="158" fontSize="10" fill="#94a3b8" textAnchor="middle">
          до 500 мм/с
        </text>

        {/* --- Панель 3: Delta --- */}
        <text x="262" y="20" fontSize="10" fontWeight="bold" fill="#c4b5fd" textAnchor="middle">
          Delta
        </text>
        <rect x="216" y="34" width="92" height="92" rx="8" fill="#0f172a" stroke="#a78bfa" />
        <text x="238" y="42" fontSize="10" fill="#cbd5e1">
          3 рычага
        </text>
        <text x="238" y="56" fontSize="10" fill="#94a3b8">
          стол: Z
        </text>
        <line x1="228" y1="70" x2="258" y2="82" stroke="#94a3b8" />
        <line x1="262" y1="70" x2="262" y2="82" stroke="#94a3b8" />
        <line x1="296" y1="70" x2="266" y2="82" stroke="#94a3b8" />
        <circle cx="262" cy="86" r="4" fill="#334155" stroke="#a78bfa" />
        <circle cx="262" cy="108" r="14" fill="#334155" stroke="#a78bfa" />
        <line x1="290" y1="120" x2="290" y2="108" stroke="#a78bfa" strokeWidth="1.2" />
        <polygon points="286,108 294,108 290,101" fill="#a78bfa" />
        <text x="262" y="142" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          Flsun
        </text>
        <text x="262" y="158" fontSize="10" fill="#94a3b8" textAnchor="middle">
          быстро, круглый
        </text>
      </svg>
    </VisualWrapper>
  );
}
