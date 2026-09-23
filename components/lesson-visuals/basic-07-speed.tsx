import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 7 · image «Скорость: быстро и медленно» (Модуль 2: Настройка печати).
 *
 * Из описания блока: слева 80 мм/с — углы закруглены, слои расслоены;
 * справа 40 мм/с — поверхность гладкая, углы чёткие.
 */
export function Basic07Speed({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Два кубика: на 80 мм/с углы закруглены и слои расслоены, на 40 мм/с поверхность гладкая и углы чёткие"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="16" y="22" fontSize="8" fill="#cbd5e1">
          Одна и та же деталь на разной скорости
        </text>

        <path
          d="M30 130 L30 66 Q30 50 46 50 L124 50 Q140 50 140 66 L140 130 Z"
          fill="#7f1d1d"
          stroke="#ef4444"
          strokeWidth="1.5"
        />
        {[64, 76, 88, 100, 112, 124].map((y, i) => (
          <path
            key={y}
            d={`M32 ${y + (i % 2 ? -1 : 1)} Q85 ${y - 3} 138 ${y + (i % 2 ? 1 : -1)}`}
            fill="none"
            stroke="#fca5a5"
            strokeWidth="1.2"
          />
        ))}
        <text x="36" y="44" fontSize="7" fill="#fca5a5">
          углы закруглены
        </text>

        <rect x="180" y="50" width="110" height="80" rx="1" fill="#1d4ed8" stroke="#3b82f6" />
        {[62, 74, 86, 98, 110, 122].map((y) => (
          <line key={y} x1="180" y1={y} x2="290" y2={y} stroke="#93c5fd" />
        ))}
        <text x="196" y="44" fontSize="7" fill="#93c5fd">
          поверхность гладкая
        </text>

        <text x="85" y="152" fontSize="11" fill="#ef4444" textAnchor="middle" fontWeight="bold">
          80 мм/с
        </text>
        <text x="85" y="168" fontSize="7" fill="#94a3b8" textAnchor="middle">
          углы закруглены, слои расслоены
        </text>
        <text x="235" y="152" fontSize="11" fill="#3b82f6" textAnchor="middle" fontWeight="bold">
          40 мм/с
        </text>
        <text x="235" y="168" fontSize="7" fill="#94a3b8" textAnchor="middle">
          поверхность гладкая, углы чёткие
        </text>
      </svg>
    </VisualWrapper>
  );
}
