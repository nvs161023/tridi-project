import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Решётка всасывания на корпусе компрессора. */
const INTAKE = [26, 32, 38];

/** Шланг от регулятора к аэрографу: провисающая полилиния. */
const HOSE = [
  [120, 80],
  [138, 92],
  [162, 94],
  [184, 88],
  [204, 78],
];

/**
 * Аэрограф: схема обвязки слева направо — компрессор, регулятор с манометром,
 * шланг, аэрограф со стволом и факелом распыла, деталь под факелом; у сопла
 * маркеры 0,3 мм и 1,5–2,5 бар, внизу строками расходники.
 *
 * Ровно по content урока: «Аэрограф 0,3 мм + компрессор 1,5–2,5 бар. Для гладкой
 * покраски больших поверхностей» и по list: «Аэрограф 0,3–0,5 мм, компрессор
 * 1,5–2,5 бар, акрил для аэрографа, маскировочная лента, респиратор, камера для
 * покраски».
 *
 * От K2 (слои покрытия: грунт, краска, лак в разрезе) отличается тем, что это не
 * слои, а схема оборудования с параметрами: корпуса приборов, манометр и шланг.
 * Схема-обвязка с давлением в курсе впервые.
 */
export function ProMM6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Аэрограф и обвязка: компрессор с ресивером, регулятор с манометром и стрелкой, шланг к аэрографу, сопло 0,3 мм и факел распыла над деталью; у манометра подпись давления 1,5–2,5 бар, внизу строками расходники — акрил, лента, респиратор и камера для покраски"
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

        {/* Компрессор: корпус, решётка всасывания, ресивер на ножках */}
        <rect x="20" y="58" width="48" height="34" rx="4" fill="#334155" />
        {INTAKE.map((x) => (
          <line key={`intake-${x}`} x1={x} y1="66" x2={x} y2="82" stroke="#64748b" strokeWidth="1" />
        ))}
        <rect x="24" y="96" width="40" height="18" rx="8" fill="#334155" />
        <rect x="28" y="114" width="8" height="6" fill="#475569" />
        <rect x="52" y="114" width="8" height="6" fill="#475569" />

        {/* Регулятор давления с манометром */}
        <rect x="84" y="64" width="36" height="30" rx="3" fill="#334155" />
        <circle cx="102" cy="52" r="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
        <line x1="102" y1="52" x2="108" y2="46" stroke="#7dd3fc" strokeWidth="1.4" />
        <rect x="96" y="94" width="12" height="8" rx="2" fill="#334155" />

        {/* Шланг и аэрограф со стволом */}
        <polyline
          points={HOSE.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#475569"
          strokeWidth="3"
        />
        <rect x="214" y="52" width="18" height="16" rx="2" fill="#334155" stroke="#475569" />
        <rect x="204" y="68" width="44" height="12" rx="3" fill="#334155" stroke="#475569" />
        <polygon points="248,70 266,73 266,77 248,80" fill="#94a3b8" />
        <rect x="208" y="80" width="8" height="6" rx="1" fill="#334155" />

        {/* Факел распыла и деталь под ним */}
        <polygon points="266,68 300,110 300,120 266,82" fill="#38bdf8" fillOpacity="0.18" />
        <rect x="270" y="126" width="34" height="12" rx="2" fill="#475569" />

        {/* Подписи: параметры у приборов */}
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Аэрограф: обвязка и параметры
        </text>
        <text x="84" y="28" fontSize="7.5" fill="#7dd3fc">
          1,5–2,5 бар
        </text>
        <text x="248" y="44" fontSize="7.5" fill="#7dd3fc">
          0,3 мм
        </text>
        <text x="20" y="128" fontSize="7.5" fill="#e2e8f0">
          компрессор
        </text>
        <text x="84" y="128" fontSize="7.5" fill="#e2e8f0">
          регулятор
        </text>
        <text x="210" y="152" fontSize="7.5" fill="#e2e8f0">
          аэрограф
        </text>
        <text x="12" y="150" fontSize="7.5" fill="#94a3b8">
          акрил · лента · респиратор · камера
        </text>
        <text x="12" y="164" fontSize="7.5" fill="#94a3b8">
          расходники для покраски
        </text>
      </svg>
    </VisualWrapper>
  );
}
