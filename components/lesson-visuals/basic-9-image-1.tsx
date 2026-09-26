import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Что проверяют на готовом кубике (content урока, слово в слово). */
const checks = [
  { cy: 64, text: "углы прямые" },
  { cy: 96, text: "стенки гладкие" },
  { cy: 128, text: "верх ровный" },
];

/** Риски слоёв на гранях кубика. */
const layerRows = [90, 96, 102, 108, 114];

/** Уголки «фото»: четыре L-образные скобки. */
const corners = [
  { x: 28, y: 44, dx: 10, dy: 10 },
  { x: 182, y: 44, dx: -10, dy: 10 },
  { x: 28, y: 140, dx: 10, dy: -10 },
  { x: 182, y: 140, dx: -10, dy: -10 },
];

/**
 * Результат — схематичный кадр «фото» готового кубика и три галочки проверки.
 *
 * Ровно по content урока: «Фото готового кубика. Углы прямые, стенки гладкие, верх
 * ровный». Кубик стоит в рамке-фото (уголки кадра и блики), справа три пункта
 * проверки с галочками; внизу — совет из того же урока про фото в чат.
 *
 * От «Файла для печати» (тоже урок 9) отличается композицией: там окно слайсера с
 * профилем и числами, здесь рамка фотографии и чек-лист без интерфейса.
 */
export function Basic9Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Результат печати кубика: фото готовой детали — углы прямые, стенки гладкие, верх ровный; сфотографируй и покажи в чате"
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

        {/* Рамка фотографии */}
        <rect x="14" y="30" width="182" height="124" rx="8" fill="#0f172a" stroke="#475569" />
        <rect x="24" y="40" width="162" height="104" rx="4" fill="#1e293b" />
        {corners.map((corner) => (
          <polyline
            key={`${corner.x}-${corner.y}`}
            points={`${corner.x},${corner.y + corner.dy} ${corner.x},${corner.y} ${corner.x + corner.dx},${corner.y}`}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
          />
        ))}

        {/* Кубик: тени, грани и риски слоёв */}
        <polygon points="58,126 150,126 166,134 74,134" fill="#0f172a" fillOpacity="0.7" />
        <polygon points="77,84 105,74 133,84 105,94" fill="#334155" stroke="#475569" />
        <polygon points="77,84 105,94 105,128 77,118" fill="#1e293b" stroke="#475569" />
        <polygon points="105,94 133,84 133,118 105,128" fill="#0f172a" stroke="#475569" />
        {layerRows.map((y) => (
          <g key={y}>
            <line x1="77" y1={y} x2="105" y2={y + 10} stroke="#64748b" />
            <line x1="105" y1={y + 10} x2="133" y2={y} stroke="#64748b" />
          </g>
        ))}

        {/* Блики: кадр снят на камеру */}
        {[
          { x: 52, y: 58 },
          { x: 172, y: 52 },
        ].map((spot) => (
          <polygon
            key={spot.x}
            points={`${spot.x},${spot.y - 5} ${spot.x + 1.5},${spot.y - 1.5} ${spot.x + 5},${spot.y} ${spot.x + 1.5},${spot.y + 1.5} ${spot.x},${spot.y + 5} ${spot.x - 1.5},${spot.y + 1.5} ${spot.x - 5},${spot.y} ${spot.x - 1.5},${spot.y - 1.5}`}
            fill="#fbbf24"
            fillOpacity="0.8"
          />
        ))}

        {/* Три пункта проверки */}
        {checks.map((check) => (
          <g key={check.text}>
            <circle cx="210" cy={check.cy} r="6" fill="#34d399" />
            <polyline
              points={`207,${check.cy} 209,${check.cy + 3} 214,${check.cy - 4}`}
              fill="none"
              stroke="#052e16"
              strokeWidth="2"
            />
            <text x="222" y={check.cy + 4} fontSize="10" fill="#e2e8f0">
              {check.text}
            </text>
          </g>
        ))}

        <text x="14" y="170" fontSize="10" fill="#94a3b8">
          Сфотографируй кубик и покажи в чате
        </text>
      </svg>
    </VisualWrapper>
  );
}
