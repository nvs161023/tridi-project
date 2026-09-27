import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять вертикальных волн-штрихов «дерева» внутри вазы. */
const woodLines = [48, 57, 66, 75, 84];

/** Крап «камня» по поверхности подставки. */
const stoneSpots = [
  [136, 88, 1.4],
  [148, 95, 1.1],
  [160, 86, 1.5],
  [172, 99, 1.2],
  [184, 90, 1.4],
  [130, 98, 1.1],
  [140, 105, 1.3],
  [156, 103, 1.2],
  [170, 107, 1.4],
  [186, 103, 1.1],
];

/** Четыре волны «ткани» на чехле. */
const clothLines = [70, 82, 94, 104];

/**
 * Рельефная печать — три разных предмета с разными текстурами: ваза с текстурой
 * дерева, подставка с текстурой камня и чехол с текстурой ткани. Текстура не
 * сравнивается по свойствам — она показана как рисунок поверхности, который
 * получается из разной высоты слоя.
 *
 * Ровно по content урока: «Фото: ваза с текстурой дерева, подставка с текстурой
 * камня, чехол с текстурой ткани» и по тексту «для декоративных моделей —
 * идеально, для функциональных — не нужно».
 *
 * От «рядов однотипных образцов» в других уроках (таблица пяти филаментов,
 * пять покрытий стола, пять слайсеров в ряд, карта десяти дефектов) отличается
 * предметом: там сравниваются свойства одинаковых объектов, здесь три РАЗНЫХ
 * предмета и у каждого свой рисунок рельефа, а не характеристики.
 */
export function ProGG1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Примеры рельефной печати: ваза с текстурой дерева, подставка с текстурой камня и чехол с текстурой ткани — рельеф получается из разной высоты слоя и подходит для декоративных моделей, а функциональным деталям он не нужен"
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
          три предмета — три текстуры
        </text>

        {/* Ваза: силуэт с бороздками дерева */}
        <path
          d="M54,44 h20 v7 c11,7 17,19 17,31 c0,17 -9,24 -9,30 h-36 c0,-6 -9,-13 -9,-30 c0,-12 6,-24 17,-31 z"
          fill="#f59e0b"
          fillOpacity="0.16"
          stroke="#f59e0b"
        />
        {woodLines.map((x) => (
          <path
            key={`wood-${x}`}
            d={`M${x},62 q-3,11 0,22 q3,11 0,22`}
            fill="none"
            stroke="#fbbf24"
            strokeOpacity="0.75"
          />
        ))}

        {/* Подставка: плита с крапом камня */}
        <rect
          x="126"
          y="78"
          width="68"
          height="34"
          rx="4"
          fill="#64748b"
          fillOpacity="0.35"
          stroke="#94a3b8"
        />
        {stoneSpots.map(([cx, cy, r]) => (
          <circle
            key={`stone-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="#cbd5e1"
            fillOpacity="0.75"
          />
        ))}

        {/* Чехол: полотно с переплетением ткани */}
        <rect
          x="228"
          y="60"
          width="56"
          height="52"
          rx="10"
          fill="#38bdf8"
          fillOpacity="0.2"
          stroke="#7dd3fc"
        />
        {clothLines.map((y) => (
          <path
            key={`cloth-${y}`}
            d={`M232,${y} q7,-5 14,0 q7,5 14,0 q7,-5 14,0`}
            fill="none"
            stroke="#7dd3fc"
            strokeOpacity="0.8"
          />
        ))}

        <text x="64" y="134" fontSize="10" fontWeight="bold" fill="#fbbf24" textAnchor="middle">
          дерево
        </text>
        <text x="160" y="134" fontSize="10" fontWeight="bold" fill="#cbd5e1" textAnchor="middle">
          камень
        </text>
        <text x="256" y="134" fontSize="10" fontWeight="bold" fill="#7dd3fc" textAnchor="middle">
          ткань
        </text>

        <text x="12" y="152" fontSize="10" fill="#e2e8f0">
          для декора — идеально, для функциональных — нет
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          текстура получается из разной высоты слоя
        </text>
      </svg>
    </VisualWrapper>
  );
}
