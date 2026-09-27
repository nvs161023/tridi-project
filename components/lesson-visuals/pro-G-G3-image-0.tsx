import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Девять линий-бороздок верхнего слоя на левой половине. */
const grooves = [48, 54, 60, 66, 72, 78, 84, 90, 96];

/** Три блика «как стекло» на правой половине. */
const gloss = [
  "M196,86 L232,58",
  "M216,98 L262,58",
  "M244,102 L278,74",
];

/**
 * Ironing: верх верхней поверхности детали до и после — слева видны бороздки
 * слоёв, справа поверхность гладкая, «как стекло», а под каждой половиной стоят
 * её настройки (Ironing выключен против Flow 10% и Speed 20).
 *
 * Ровно по content урока: «Фото: верх без Ironing — видны линии. С Ironing —
 * гладкая, как стекло. Настройки: Flow 10%, Speed 20 мм/с».
 *
 * От «До и после шкурки» из базового урока 11 отличается предметом кадра: там
 * две детали целиком и руки со шкуркой, лаком и грунтом; здесь только верхняя
 * плоскость крупным планом в двух состояниях — ни деталей целиком, ни рук,
 * ни обработки инструментом.
 */
export function ProGG3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Верх верхней поверхности детали до и после Ironing: слева видны бороздки слоёв при выключенном Ironing, справа поверхность гладкая как стекло при Flow 10 процентов и Speed 20 миллиметров в секунду"
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
          верх детали крупным планом
        </text>

        {/* До: бороздки слоёв */}
        <rect x="20" y="40" width="120" height="66" rx="4" fill="#334155" stroke="#64748b" />
        {grooves.map((y) => (
          <line key={`groove-${y}`} x1="20" y1={y} x2="140" y2={y} stroke="#94a3b8" strokeOpacity="0.55" />
        ))}

        {/* После: гладкая поверхность с бликами */}
        <rect x="180" y="40" width="120" height="66" rx="4" fill="#334155" stroke="#64748b" />
        {gloss.map((d) => (
          <path key={d} d={d} fill="none" stroke="#e2e8f0" strokeOpacity="0.35" strokeWidth="2" />
        ))}

        <text x="80" y="126" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          бороздки слоёв
        </text>
        <text x="240" y="126" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          гладкая, как стекло
        </text>

        <text x="80" y="144" fontSize="9" fill="#94a3b8" textAnchor="middle">
          Ironing выключен
        </text>
        <text x="240" y="144" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          Flow 10% · Speed 20
        </text>

        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          сопло проходит без подачи и затирает бороздки
        </text>
      </svg>
    </VisualWrapper>
  );
}
