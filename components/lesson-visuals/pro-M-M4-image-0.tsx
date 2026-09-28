import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Деления штанги штангенциркуля: 1 мм, шаг 11 единиц по X. */
const BEAM_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** Деления стебля микрометра: 0,5 мм, шаг 6 единиц. */
const SLEEVE_TICKS = [0, 1, 2, 3, 4];

/** Деления барабана микрометра: цена 0,01 мм, шаг 6 единиц. */
const THIMBLE_TICKS = [0, 1, 2, 3];

/** Деления нониуса: десять долей миллиметра, шаг 8 единиц. */
const VERNIER_TICKS = [0, 1, 2, 3, 4, 5];

/** Деления линейки: сантиметры, шаг 12 единиц. */
const RULER_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/** Дуга угломера: девять точек полукруга радиуса 30 вокруг (252, 70). */
const GON_ARC = [
  [222, 70],
  [224.3, 58.5],
  [230.8, 48.8],
  [240.5, 42.3],
  [252, 40],
  [263.5, 42.3],
  [273.2, 48.8],
  [279.7, 58.5],
  [282, 70],
];

/** Деления на линейке-основании угломера: каждые 15 градусов. */
const GON_TICKS = [228, 240, 252, 264, 276];

/**
 * Измерительный инструмент: крупный штангенциркуль в центре с рамкой-нониусом и
 * прутком между губками, слева микрометр (скоба, стебель, барабан, трещотка),
 * справа угломер с дугой и подвижной линейкой, внизу строкой линейка.
 *
 * Ровно по content урока: «Фото: штангенциркуль, микрометр, угломер. Под каждым —
 * для чего» и по list: «Штангенциркуль: 0,01 мм, для диаметра филамента и стенок
 * • Микрометр: 0,001 мм, для точных измерений • Угломер: для углов • Линейка: для
 * габаритов».
 *
 * Главное отличие от всех предметных кадров курса — видимые шкалы и цена деления:
 * деления штанги, стебля и барабана, нониуса, дуги и линейки нарисованы рисками.
 * От C1-C1-1 (две тубы с носиком и запретами) отличается и предметом, и вёрсткой:
 * там асимметрия предметов, здесь крупный прибор по центру и три спутника вокруг.
 */
export function ProMM4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Измерительный инструмент: крупный штангенциркуль в центре — штанга с делениями, рамка-нониус, губки с прутком; слева микрометр со скобой, стеблем и барабаном, справа угломер с дугой и подвижной линейкой, внизу строкой линейка с делениями; под каждым прибором его цена деления"
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
          Инструменты: что чем измеряют
        </text>


        {/* Микрометр: скоба, шпиндель, стебель со шкалой, барабан, трещотка */}
        <rect x="20" y="42" width="8" height="26" rx="2" fill="#475569" />
        <rect x="28" y="44" width="10" height="6" fill="#475569" />
        <rect x="28" y="60" width="10" height="6" fill="#475569" />
        <rect x="38" y="52" width="22" height="6" fill="#64748b" />
        <rect x="60" y="48" width="32" height="14" rx="2" fill="#334155" stroke="#475569" />
        {SLEEVE_TICKS.map((tick) => (
          <line
            key={`sleeve-${tick}`}
            x1={62 + tick * 6}
            y1="52"
            x2={62 + tick * 6}
            y2="56"
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <rect x="94" y="44" width="26" height="22" rx="4" fill="#334155" stroke="#475569" />
        {THIMBLE_TICKS.map((tick) => (
          <line
            key={`thimble-${tick}`}
            x1={98 + tick * 6}
            y1="47"
            x2={98 + tick * 6}
            y2="51"
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <rect x="122" y="50" width="10" height="10" rx="2" fill="#334155" stroke="#475569" />
        <text x="12" y="30" fontSize="7.5" fill="#e2e8f0">
          микрометр: 0,001 мм
        </text>

        {/* Угломер: дуга с делениями и подвижная линейка */}
        <polyline
          points={GON_ARC.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.3"
        />
        <rect x="222" y="70" width="60" height="6" fill="#334155" stroke="#475569" />
        {GON_TICKS.map((x) => (
          <line key={`gon-${x}`} x1={x} y1="70" x2={x} y2="64" stroke="#94a3b8" strokeWidth="0.9" />
        ))}
        <line x1="252" y1="70" x2="273" y2="49" stroke="#f59e0b" strokeWidth="1.4" />
        <polygon points="273,49 267,50 270,56" fill="#f59e0b" />
        <text x="222" y="30" fontSize="7.5" fill="#e2e8f0">
          угломер: углы, 1°
        </text>


        {/* Штангенциркуль крупно: штанга со шкалой, губки, пруток, рамка-нониус */}
        <rect x="40" y="98" width="240" height="16" rx="2" fill="#334155" stroke="#475569" />
        {BEAM_TICKS.map((tick) => (
          <line
            key={`beam-${tick}`}
            x1={44 + tick * 11}
            y1="98"
            x2={44 + tick * 11}
            y2={tick % 2 === 0 ? 107 : 104}
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <rect x="42" y="80" width="10" height="18" fill="#64748b" />
        <rect x="96" y="80" width="10" height="18" fill="#64748b" />
        <rect x="52" y="86" width="44" height="6" rx="3" fill="#f59e0b" fillOpacity="0.85" />
        <rect x="88" y="94" width="56" height="26" rx="3" fill="#334155" stroke="#475569" />
        {VERNIER_TICKS.map((tick) => (
          <line
            key={`vernier-${tick}`}
            x1={92 + tick * 8}
            y1="120"
            x2={92 + tick * 8}
            y2="114"
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <rect x="282" y="102" width="18" height="8" rx="2" fill="#64748b" />
        <text x="12" y="134" fontSize="7.5" fill="#e2e8f0">
          штангенциркуль: 0,01 мм
        </text>
        <text x="12" y="148" fontSize="7.5" fill="#94a3b8">
          нониус даёт 0,01 мм
        </text>

        {/* Линейка строкой внизу */}
        <rect x="12" y="158" width="190" height="10" rx="2" fill="#334155" stroke="#475569" />
        {RULER_TICKS.map((tick) => (
          <line
            key={`ruler-${tick}`}
            x1={16 + tick * 12}
            y1="158"
            x2={16 + tick * 12}
            y2={tick % 2 === 0 ? 164 : 161}
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <text x="212" y="164" fontSize="7.5" fill="#e2e8f0">
          линейка — габариты
        </text>
      </svg>
    </VisualWrapper>
  );
}
