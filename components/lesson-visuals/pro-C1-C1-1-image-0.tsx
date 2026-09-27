import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Смазка из content урока: «Фото: литиевая смазка для валов, PTFE для винта Z.
 * Не смешивай» и warning «Не лей смазку на ремни — начнут проскальзывать».
 *
 * В кадре две тубы с носиком: литиевая (янтарная этикетка) для валов и PTFE
 * (голубая) для винта Z. Это предметы с носиком, а не катушки (E1) и не ванны
 * (H2[1]) — поэтому и форма, и подписи другие. Справа точки нанесения из списка
 * урока: вал с подшипниками и резьба винта Z, на каждой — капля своей смазки.
 *
 * Два запрета стоят отдельными знаками: красный круг с крестом между тубами
 * («не смешивать» — из content) и перечёркнутая капля над ремнём («на ремни
 * нельзя» — из warning). Подписи держат зазор ≥8 px от фигур, строки — ≥14 px.
 */
const BELT_TEETH = [24, 42, 60, 78, 96];

/** «Смазка» — какие смазки куда и чего делать нельзя. */
export function ProC1C11Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Смазка: две тубы с носиком — литиевая для валов и PTFE для винта Z, справа точки нанесения на вал и на резьбу, между тубами красный круг с крестом «не смешивать», внизу перечёркнутая капля над ремнём"
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
          Смазка: что куда и чего нельзя
        </text>

        {/* Туба 1: литиевая смазка — валы X и Y */}
        <rect x="20" y="48" width="34" height="56" rx="5" fill="#334155" stroke="#475569" />
        <rect
          x="26"
          y="64"
          width="22"
          height="18"
          rx="3"
          fill="#fbbf24"
          fillOpacity="0.35"
          stroke="#fbbf24"
          strokeOpacity="0.7"
        />
        <polygon points="32,48 42,48 40,34 34,34" fill="#475569" />
        <rect x="33" y="26" width="8" height="8" rx="2" fill="#64748b" />

        {/* Туба 2: PTFE — винт Z */}
        <rect x="70" y="48" width="34" height="56" rx="5" fill="#334155" stroke="#475569" />
        <rect
          x="76"
          y="64"
          width="22"
          height="18"
          rx="3"
          fill="#93c5fd"
          fillOpacity="0.35"
          stroke="#93c5fd"
          strokeOpacity="0.7"
        />
        <polygon points="82,48 92,48 90,34 84,34" fill="#475569" />
        <rect x="83" y="26" width="8" height="8" rx="2" fill="#64748b" />

        <text x="37" y="120" fontSize="9" fill="#e2e8f0" textAnchor="middle">
          литиевая
        </text>
        <text x="37" y="134" fontSize="8.5" fill="#94a3b8" textAnchor="middle">
          валы X / Y
        </text>
        <text x="87" y="120" fontSize="9" fill="#e2e8f0" textAnchor="middle">
          PTFE
        </text>
        <text x="87" y="134" fontSize="8.5" fill="#94a3b8" textAnchor="middle">
          винт Z
        </text>

        {/* Запрет из content: две смазки не смешивать */}
        <circle cx="134" cy="64" r="10" fill="none" stroke="#f87171" strokeWidth="1.6" />
        <line x1="127" y1="57" x2="141" y2="71" stroke="#f87171" strokeWidth="1.6" />
        <line x1="141" y1="57" x2="127" y2="71" stroke="#f87171" strokeWidth="1.6" />
        <text x="134" y="90" fontSize="8.5" fill="#f87171" textAnchor="middle">
          не смешивать
        </text>

        {/* Точка нанесения: вал с каплей литиевой */}
        <circle cx="196" cy="40" r="4.5" fill="#fbbf24" />
        <polygon points="191,38 201,38 196,30" fill="#fbbf24" />
        <line x1="182" y1="50" x2="262" y2="50" stroke="#64748b" strokeWidth="2" />
        <rect x="182" y="44" width="9" height="12" rx="2" fill="#334155" stroke="#475569" />
        <rect x="253" y="44" width="9" height="12" rx="2" fill="#334155" stroke="#475569" />
        <text x="176" y="70" fontSize="8.5" fill="#e2e8f0">
          валы X / Y — литиевая
        </text>

        {/* Точка нанесения: резьба винта Z с каплей PTFE */}
        <rect x="182" y="84" width="12" height="48" rx="3" fill="#334155" stroke="#475569" />
        <polyline
          points="186,88 190,94 186,100 190,106 186,112 190,118 186,124"
          fill="none"
          stroke="#64748b"
        />
        <circle cx="200" cy="108" r="4.5" fill="#93c5fd" />
        <polygon points="195,106 205,106 200,98" fill="#93c5fd" />
        <text x="176" y="152" fontSize="8.5" fill="#e2e8f0">
          винт Z — PTFE, тонким слоем
        </text>

        {/* Запрет из warning: смазка на ремни */}
        <rect x="18" y="148" width="110" height="10" rx="2" fill="#334155" stroke="#64748b" />
        {BELT_TEETH.map((x) => (
          <rect key={`tooth-${x}`} x={x} y="158" width="6" height="4" fill="#64748b" />
        ))}
        <circle cx="118" cy="138" r="5" fill="#fbbf24" />
        <polygon points="113,136 123,136 118,128" fill="#fbbf24" />
        <line x1="109" y1="129" x2="127" y2="147" stroke="#f87171" strokeWidth="2" />
        <text x="140" y="167" fontSize="9" fill="#f87171">
          на ремни — нельзя
        </text>
      </svg>
    </VisualWrapper>
  );
}
