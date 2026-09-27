import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Левая колонка: девять одинаковых слоёв — стенка получается гладкой. */
const evenLayers = Array.from({ length: 9 }, (_, index) => ({
  y: 111 - index * 7,
  height: 6.4,
}));

/** Правая колонка: чередование тонкого и толстого слоя — на краю выходит волна. */
const unevenLayers = [3, 9, 3, 9, 3, 9, 3, 9, 3, 9, 3].reduce<{ y: number; height: number }[]>(
  (acc, height) => {
    acc.push({ y: (acc[acc.length - 1]?.y ?? 118) - height, height });
    return acc;
  },
  [],
);

/**
 * Кадры роста: каждый следующий слой появляется чуть позже предыдущего. Свои
 * keyframes на каждый индекс — с общим animation-delay сдвинулся бы весь цикл,
 * и «стенка растёт снизу вверх» перестала бы читаться.
 */
const LAYER_STYLES = Array.from({ length: 12 }, (_, index) => {
  const start = 6 + index * 6;
  return `          .v-gg1a-s${index} { animation: v-gg1a-rise${index} 6s ease-out infinite; transform-box: fill-box; transform-origin: center bottom; }
          @keyframes v-gg1a-rise${index} {
            0%, ${start}% { opacity: 0; transform: translateY(4px) scaleY(0.5); }
            ${start + 8}%, 88% { opacity: 1; transform: none; }
            96%, 100% { opacity: 0; transform: translateY(2px) scaleY(0.7); }
          }`;
}).join("\n");

/**
 * Как из высоты слоя получается рельеф: две стенки в разрезе рядом — слева слои
 * одинаковой высоты и гладкая стенка, справа высота слоя чередуется (тонкий —
 * толстый), и на краю появляется волна текстуры.
 *
 * Ровно по content урока: «Сопло печатает с разной высотой слоя. Где выше —
 * текстура. Где ниже — гладко. Комбинация даёт рельеф» и по объяснению теста
 * «переменная высота слоя: тонкие слои на деталях, толстые на ровных участках».
 *
 * От «Сопло наращивает модель слой за слоем» из базового урока 1 отличается
 * предметом кадра: там весь процесс печати — сопло, стол, слои и решётка
 * заполнения в разрезе; здесь только профиль высоты по Z: ни сопла, ни стола,
 * ни заполнения, а сравниваются ровная стенка и стенка с рельефом.
 *
 * Анимация 6 с, по кругу: стенки растут снизу вверх, потом сбрасываются. При
 * prefers-reduced-motion показаны обе стенки целиком.
 *
 * Классы с префиксом v-gg1a: <style> внутри SVG действует на всю страницу.
 */
export function ProGG1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: две стенки в разрезе растут снизу вверх — у левой высота слоя одинаковая и стенка выходит гладкой, у правой высота чередуется с 0,1 на 0,3 мм, поэтому на краю появляется волна текстуры"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
${LAYER_STYLES}
          @media (prefers-reduced-motion: reduce) {
            .v-gg1a-layer { animation: none; opacity: 1; transform: none; }
          }
        `}</style>

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
          высота слоя по Z — текстура
        </text>

        {/* Ось Z: растёт вверх */}
        <line x1="30" y1="128" x2="30" y2="52" stroke="#64748b" />
        <polygon points="26,60 30,52 34,60" fill="#64748b" />

        <text x="78" y="32" fontSize="10" fill="#94a3b8" textAnchor="middle">
          одинаковая высота
        </text>
        <text x="218" y="32" fontSize="10" fill="#94a3b8" textAnchor="middle">
          разная высота
        </text>

        {evenLayers.map((layer, index) => (
          <rect
            key={`even-${layer.y}`}
            className={`v-gg1a-layer v-gg1a-s${index}`}
            x="60"
            y={layer.y}
            width="36"
            height={layer.height}
            fill="#334155"
            stroke="#64748b"
          />
        ))}
        {unevenLayers.map((layer, index) => (
          <rect
            key={`uneven-${layer.y}`}
            className={`v-gg1a-layer v-gg1a-s${index}`}
            x="200"
            y={layer.y}
            width={layer.height === 9 ? 44 : 36}
            height={layer.height}
            fill="#334155"
            stroke={layer.height === 9 ? "#38bdf8" : "#64748b"}
          />
        ))}

        <text x="252" y="70" fontSize="9" fill="#7dd3fc">
          0,1
        </text>
        <text x="252" y="88" fontSize="9" fill="#fbbf24">
          0,3
        </text>

        <text x="78" y="136" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          гладкая стенка
        </text>
        <text x="218" y="136" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          текстура
        </text>

        <text x="12" y="156" fontSize="10" fill="#e2e8f0">
          Variable Layer Height — тонкие слои на деталях
        </text>
        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          толстые — на ровных участках
        </text>
      </svg>
    </VisualWrapper>
  );
}
