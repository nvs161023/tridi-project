import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Где открыть калибровки — три крупных плана панели, а не три целых окна: в
 * каждом показана только та часть слайсера, где лежит вход в калибровки, рядом
 * лупа с увеличенным элементом, а под планом — цепочка из двух чипов: как
 * называется вход и как называется пункт.
 *
 * Ровно по content урока: «Orca Slicer: значок «Calibration» на панели. Bambu
 * Studio: вкладка «Calibration». FlashPrint: раздел «Tools → Calibration»».
 *
 * От «Где найти калибровки» в базовом уроке 8 отличается приёмом: там три
 * маленьких экрана целиком (вкладка, значок, меню в миниатюре), здесь — три
 * крупных фрагмента панели с лупой и цепочкой чипов, а от схем окна Orca
 * (уроки 3 и 9) — тем, что окна как такового в кадре нет вовсе.
 */
const columns = [
  { x: 8, name: "Bambu Studio", kind: "tab", how: "вкладка", item: "Calibration", accent: "#a78bfa" },
  { x: 110, name: "Orca Slicer", kind: "icon", how: "значок", item: "Calibration", accent: "#34d399" },
  { x: 212, name: "FlashPrint", kind: "menu", how: "раздел", item: "Tools → Calibration", accent: "#fbbf24" },
];

/** Крупный план панели: тот самый вход в калибровки и лупа с увеличением. */
function Fragment({ kind, x, accent }: { kind: string; x: number; accent: string }) {
  if (kind === "tab") {
    // Bambu Studio: вкладка Calibration в шапке окна, лупа над ней.
    return (
      <g>
        <rect x={x + 6} y="60" width="27" height="11" fill="#334155" stroke="#64748b" />
        <rect x={x + 37} y="60" width="27" height="11" fill="#334155" stroke={accent} />
        <rect x={x + 68} y="60" width="26" height="11" fill="#334155" stroke="#64748b" />
        <rect x={x + 6} y="80" width="24" height="8" fill="#334155" />
        <rect x={x + 6} y="92" width="18" height="8" fill="#334155" />
        <circle cx={x + 54} cy="80" r="16" fill="#0f172a" stroke={accent} strokeWidth="1.4" />
        <rect x={x + 44} y="75" width="20" height="10" fill="#334155" stroke={accent} />
        <line x1={x + 66} y1="91" x2={x + 74} y2="99" stroke={accent} strokeWidth="1.6" />
      </g>
    );
  }

  if (kind === "icon") {
    // Orca Slicer: значок калибровки на панели инструментов, лупа справа.
    return (
      <g>
        <rect x={x + 6} y="60" width="18" height="48" fill="#1e293b" />
        <rect x={x + 8} y="62" width="14" height="14" fill="#334155" stroke="#64748b" />
        <rect x={x + 8} y="79" width="14" height="14" fill="#334155" stroke={accent} />
        <rect x={x + 8} y="96" width="14" height="14" fill="#334155" stroke="#64748b" />
        <circle cx={x + 15} cy="86" r="4" fill="#0f172a" stroke={accent} />
        <line x1={x + 15} y1="80" x2={x + 15} y2="84" stroke={accent} />
        <line x1={x + 15} y1="88" x2={x + 15} y2="92" stroke={accent} />
        <line x1={x + 9} y1="86" x2={x + 13} y2="86" stroke={accent} />
        <line x1={x + 17} y1="86" x2={x + 21} y2="86" stroke={accent} />
        <line x1={x + 24} y1="83" x2={x + 30} y2="79" stroke={accent} strokeOpacity="0.7" />
        <circle cx={x + 42} cy="80" r="16" fill="#0f172a" stroke={accent} strokeWidth="1.4" />
        <rect x={x + 35} y="72" width="14" height="16" fill="#334155" stroke={accent} />
        <circle cx={x + 42} cy="80" r="5" fill="#0f172a" stroke={accent} />
        <line x1={x + 42} y1="73" x2={x + 42} y2="78" stroke={accent} />
        <line x1={x + 42} y1="82" x2={x + 42} y2="87" stroke={accent} />
        <line x1={x + 35} y1="80" x2={x + 40} y2="80" stroke={accent} />
        <line x1={x + 44} y1="80" x2={x + 49} y2="80" stroke={accent} />
        <line x1={x + 53} y1="91" x2={x + 61} y2="99" stroke={accent} strokeWidth="1.6" />
      </g>
    );
  }

  // FlashPrint: пункт Tools → Calibration в выпадающем меню, лупа справа.
  return (
    <g>
      <rect x={x + 6} y="62" width="30" height="11" fill="#334155" stroke="#64748b" />
      <rect x={x + 6} y="78" width="56" height="12" fill="#334155" stroke="#64748b" />
      <rect x={x + 6} y="92" width="56" height="12" fill="#334155" stroke={accent} />
      <line x1={x + 52} y1="96" x2={x + 55} y2="99" stroke={accent} />
      <line x1={x + 55} y1="99" x2={x + 59} y2="94" stroke={accent} />
      <circle cx={x + 64} cy="92" r="15" fill="#0f172a" stroke={accent} strokeWidth="1.4" />
      <rect x={x + 54} y="86" width="20" height="11" fill="#334155" stroke={accent} />
      <line x1={x + 60} y1="103" x2={x + 66} y2="109" stroke={accent} strokeWidth="1.6" />
    </g>
  );
}


/**
 * «Где найти калибровки» — три крупных плана панели с лупой и цепочкой чипов:
 * как называется вход и как называется пункт.
 */
export function ProFF1Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Где найти калибровки: в Bambu Studio вкладка Calibration, в Orca Slicer значок Calibration на панели, в FlashPrint раздел Tools — Calibration; в каждом слайсере показан крупный план панели с лупой и цепочкой из двух чипов"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          где открыть калибровки: три программы
        </text>
        <text x="12" y="32" fontSize="9" fill="#94a3b8">
          лупа — крупный план панели слайсера
        </text>

        {columns.map((column) => (
          <g key={column.name}>
            <rect
              x={column.x}
              y="42"
              width="100"
              height="70"
              rx="6"
              fill="#0f172a"
              stroke={column.accent}
              strokeOpacity="0.55"
            />
            <text
              x={column.x + 50}
              y="52"
              fontSize="10"
              fontWeight="bold"
              fill={column.accent}
              textAnchor="middle"
            >
              {column.name}
            </text>
            <Fragment kind={column.kind} x={column.x} accent={column.accent} />

            <rect
              x={column.x + 2}
              y="116"
              width="96"
              height="15"
              rx="7"
              fill="#0f172a"
              stroke={column.accent}
              strokeOpacity="0.55"
            />
            <text x={column.x + 8} y="127" fontSize="8.5" fill="#e2e8f0">
              {column.how}
            </text>
            <rect
              x={column.x + 2}
              y="136"
              width="96"
              height="15"
              rx="7"
              fill="#0f172a"
              stroke={column.accent}
            />
            <text x={column.x + 8} y="147" fontSize="8.5" fill="#cbd5e1">
              {column.item}
            </text>
          </g>
        ))}

        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          у Orca калибровки встроены в слайсер
        </text>
      </svg>
    </VisualWrapper>
  );
}
