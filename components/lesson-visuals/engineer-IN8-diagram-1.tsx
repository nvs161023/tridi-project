import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BRANCHES = [
  { title: "габарит", values: "L · W · H", accent: "#38bdf8", y: 24 },
  { title: "база", values: "плоскость · ось", accent: "#34d399", y: 58 },
  { title: "посадки", values: "D1 · D2 · P · g", accent: "#a78bfa", y: 92 },
  { title: "толщины", values: "t · R", accent: "#fbbf24", y: 126 },
];

/**
 * Кадр блока 22 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Дерево параметров из описания `IN8_param_tree.png`: корень «деталь» и четыре
 * ветви — габарит, база, посадки, толщины, крепёж рядом. Справа — правило имён и
 * проверка, внизу — числа демонстрационной детали из блоков 23–24.
 */
export function EngineerIN8Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Дерево параметров детали: корень «деталь» и четыре ветви — габарит L, W, H, база с плоскостью и осью, посадки D1, D2, P и g, толщины t и R, крепёж рядом. Размеры задаются числами, имена параметров — D_patrubka, H_korpusa, P_otverstiy. Проверка — плюс десять миллиметров по габариту. Числа демонстрационной детали: D1 12, P 46, H 58, t 2,4, R 8, g 0,4"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          дерево параметров: четыре ветви
        </text>

        {/* Корень */}
        <rect x="12" y="76" width="54" height="32" rx="6" fill="#0f172a" fillOpacity="0.6" stroke="#64748b" />
        <text x="39" y="96" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          деталь
        </text>

        {/* Ствол и ветви */}
        <path d="M66 92 H84 V141 M84 39 H96 M84 73 H96 M84 107 H96 M84 141 H96" fill="none" stroke="#64748b" strokeWidth="1.1" />

        {BRANCHES.map((branch) => (
          <g key={branch.title}>
            <rect x="96" y={branch.y} width="100" height="30" rx="6" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
            <rect x="96" y={branch.y} width="2.5" height="30" rx="1.2" fill={branch.accent} fillOpacity="0.9" />
            <text x="106" y={branch.y + 13} fontSize="10" fontWeight="700" fill={branch.accent}>
              {branch.title}
            </text>
            <text x="106" y={branch.y + 26} fontSize="10" fill="#cbd5e1">
              {branch.values}
            </text>
          </g>
        ))}

        {/* Правила и проверка */}
        <rect x="204" y="26" width="104" height="138" rx="7" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="212" y="40" fontSize="10" fill="#94a3b8">
          крепёж рядом
        </text>
        <text x="212" y="54" fontSize="10" fontWeight="700" fill="#34d399">
          размеры числами
        </text>
        <text x="212" y="70" fontSize="10" fill="#94a3b8">
          имена:
        </text>
        <text x="212" y="84" fontSize="10" fill="#cbd5e1">
          D_patrubka
        </text>
        <text x="212" y="98" fontSize="10" fill="#cbd5e1">
          H_korpusa
        </text>
        <text x="212" y="112" fontSize="10" fill="#cbd5e1">
          P_otverstiy
        </text>
        <text x="212" y="128" fontSize="10" fill="#94a3b8">
          проверка:
        </text>
        <text x="212" y="142" fontSize="10" fill="#fbbf24">
          +10 мм
        </text>
        <text x="212" y="156" fontSize="10" fill="#cbd5e1">
          по габариту
        </text>

        <text x="12" y="172" fontSize="10" fill="#cbd5e1">
          D1 12 · P 46 · H 58 · t 2,4 · R 8 · g 0,4
        </text>
      </svg>
    </VisualWrapper>
  );
}
