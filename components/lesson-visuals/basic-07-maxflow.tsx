import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 7 · animation «Объёмный поток: предел скорости» (Модуль 2).
 *
 * Из описания блока: сопло 0,4 мм и слой 0,2 мм при 100 мм/с дают 8 мм³/с — пластик
 * успевает плавиться; при 150 мм/с это 12 мм³/с и в стенке появляются пропуски:
 * хотэнд не успевает отдавать тепло. Калибруется в Max Volumetric Speed.
 */
const GAPS = [232, 252, 272, 292];

export function Basic07Maxflow({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Формула 0,4 × 0,2 × 100 = 8 мм³/с; при 12 мм³/с в стенке появляются пропуски"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b7m-band{0%{transform:scaleX(0)}30%{transform:scaleX(1)}92%{opacity:1}100%{opacity:0}}@keyframes b7m-band2{0%,30%{transform:scaleX(0)}70%{transform:scaleX(1)}92%{opacity:1}100%{opacity:0}}@keyframes b7m-gap{0%,70%{opacity:0}85%,100%{opacity:1}}@keyframes b7m-flow{to{stroke-dashoffset:-16}}.b7m-band{animation:b7m-band 3.6s linear infinite;transform-box:fill-box;transform-origin:left center}.b7m-band2{animation:b7m-band2 3.6s linear infinite;transform-box:fill-box;transform-origin:left center}.b7m-gap{animation:b7m-gap 3.6s linear infinite}.b7m-flow{animation:b7m-flow 0.9s linear infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <rect x="10" y="14" width="300" height="28" rx="4" fill="#0b1220" stroke="#334155" />
        <text x="20" y="33" fontSize="10" fill="#e2e8f0">
          0,4 мм × 0,2 мм × 100 мм/с = 8 мм³/с
        </text>

        <rect x="10" y="50" width="146" height="94" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="20" y="66" fontSize="8.5" fill="#3b82f6">
          норма
        </text>
        <rect x="20" y="74" width="26" height="12" rx="2" fill="#334155" stroke="#475569" />
        <polygon points="26,86 40,86 37,100 29,100" fill="#64748b" />
        <line
          x1="44"
          y1="98"
          x2="56"
          y2="98"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeDasharray="4 4"
          className={animated ? "b7m-flow" : undefined}
        />
        <rect
          x="44"
          y="104"
          width="102"
          height="8"
          rx="4"
          fill="#1d4ed8"
          className={animated ? "b7m-band" : undefined}
        />
        <text x="44" y="126" fontSize="7" fill="#93c5fd">
          лента целая
        </text>
        <text x="20" y="140" fontSize="7.5" fill="#94a3b8">
          100 мм/с
        </text>

        <rect x="164" y="50" width="146" height="94" rx="4" fill="#0f172a" stroke="#ef4444" />
        <text x="174" y="66" fontSize="8.5" fill="#ef4444">
          перегруз
        </text>
        <rect x="174" y="74" width="26" height="12" rx="2" fill="#334155" stroke="#475569" />
        <polygon points="180,86 194,86 191,100 183,100" fill="#64748b" />
        <line
          x1="198"
          y1="98"
          x2="210"
          y2="98"
          stroke="#ef4444"
          strokeWidth="3"
          strokeDasharray="4 4"
          className={animated ? "b7m-flow" : undefined}
        />
        <rect
          x="198"
          y="104"
          width="102"
          height="8"
          rx="4"
          fill="#ef4444"
          className={animated ? "b7m-band2" : undefined}
        />
        {GAPS.map((x) => (
          <rect
            key={x}
            x={x}
            y="104"
            width="8"
            height="8"
            fill="#0f172a"
            className={animated ? "b7m-gap" : undefined}
          />
        ))}
        <text x="198" y="126" fontSize="7" fill="#fca5a5">
          пропуски в стенке
        </text>
        <text x="174" y="140" fontSize="7.5" fill="#94a3b8">
          150 мм/с
        </text>
        <text x="174" y="152" fontSize="6.5" fill="#fcd34d">
          хотэнд не успевает отдавать тепло
        </text>

        <text x="10" y="164" fontSize="7.5" fill="#cbd5e1">
          Скорость ограничена связкой «сопло × высота слоя × скорость»
        </text>
        <text x="10" y="176" fontSize="7.5" fill="#93c5fd">
          её калибруют в Max Volumetric Speed
        </text>
      </svg>
    </VisualWrapper>
  );
}
