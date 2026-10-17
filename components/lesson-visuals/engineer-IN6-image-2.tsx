import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ALLOWANCES = [
  { name: "винт", value: "+0,2 мм", accent: "#fbbf24" },
  { name: "ось", value: "+0,1 мм", accent: "#38bdf8" },
  { name: "вал", value: "−0,1 мм", accent: "#a78bfa" },
  { name: "длинная", value: "+0,5 мм", accent: "#34d399" },
];

/**
 * Кадр блока 15 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_wear_shrink.png`: цепочка от номинала 100 мм через
 * усадку PLA 0,3 % и PETG 0,5 % к размеру в модели, ниже — четыре припуска из
 * блока 16 (винт, ось, вал и длинная деталь).
 */
export function EngineerIN6Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Номинал 100 миллиметров. Усадка PLA 0,3 процента, PETG 0,5 процента: это 0,3 и 0,5 миллиметра на сто. В модель идёт 100,3 или 100,5. Припуски: винт плюс 0,2, ось плюс 0,1, вал минус 0,1, длинная деталь плюс 0,5 миллиметра. Поправку подбирают на своём принтере"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in6-2-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          от номинала к размеру в модели
        </text>

        {/* Номинал */}
        <rect x="12" y="26" width="86" height="56" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="20" y="44" fontSize="10" fill="#94a3b8">
          номинал
        </text>
        <text x="20" y="64" fontSize="12" fontWeight="700" fill="#e2e8f0">
          100 мм
        </text>

        <line x1="100" y1="54" x2="108" y2="54" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in6-2-arrow)" />

        {/* Усадка */}
        <rect x="110" y="26" width="100" height="56" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="118" y="40" fontSize="10" fill="#fbbf24">
          PLA 0,3 %
        </text>
        <text x="118" y="54" fontSize="10" fill="#38bdf8">
          PETG 0,5 %
        </text>
        <text x="118" y="70" fontSize="10" fill="#e2e8f0">
          0,3 / 0,5 мм
        </text>

        <line x1="212" y1="54" x2="220" y2="54" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in6-2-arrow)" />

        {/* Размер в модели */}
        <rect x="222" y="26" width="86" height="56" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#34d399" strokeOpacity="0.5" />
        <text x="230" y="40" fontSize="10" fill="#94a3b8">
          в модель
        </text>
        <text x="230" y="62" fontSize="11" fontWeight="700" fill="#6ee7b7">
          100,3 / 100,5
        </text>

        <text x="12" y="96" fontSize="10" fill="#94a3b8">
          припуски на посадку
        </text>

        {ALLOWANCES.map((item, i) => {
          const x = 12 + i * 76;
          return (
            <g key={item.name}>
              <rect x={x} y="104" width="68" height="34" rx="6" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
              <text x={x + 8} y="117" fontSize="10" fill="#cbd5e1">
                {item.name}
              </text>
              <text x={x + 8} y="132" fontSize="11" fontWeight="700" fill={item.accent}>
                {item.value}
              </text>
            </g>
          );
        })}

        <text x="12" y="156" fontSize="10" fill="#cbd5e1">
          усадка + поток + кривой стол
        </text>
        <text x="12" y="170" fontSize="10" fill="#94a3b8">
          поправку подбирают на своём принтере
        </text>
      </svg>
    </VisualWrapper>
  );
}
