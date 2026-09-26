import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Крупный план: деталь занимает почти весь кадр, буквы в высоту детали. */
const keychain = { x: 30, y: 40, width: 260, height: 80 };

/** Кольцо, продетое в отверстие: почти всё выше детали, низ заходит в отверстие. */
const ring = { cx: 58, cy: 64, r: 14 };

/** Размытые пятна фона — признак макро-съёмки, не часть модели. */
const bokeh = [
  { cx: 250, cy: 30, r: 8 },
  { cx: 42, cy: 132, r: 6 },
  { cx: 150, cy: 28, r: 4 },
];

/**
 * Результат — макро-кадр брелока с именем из Tinkercad.
 *
 * Ровно по content урока: «Фото брелока с именем. Подпись: „Сделал сам за 25
 * минут“». Буквы показаны крупно — на них и смотрит человек, когда проверяет
 * свою первую модель.
 *
 * Третий «результат» в курсе и отличается рамкой кадра: кубик в уроке 9 стоял в
 * изометрии на столе, брелок в уроке 12 висел в руке — здесь деталь лежит
 * вплотную, видно только её саму и кольцо.
 */
export function Basic13Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Результат: макро-фото брелока с именем — крупные буквы на детали, кольцо в отверстии; подпись «Сделал сам за 25 минут»"
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

        {/* Кадр «фото» */}
        <rect x="14" y="14" width="292" height="130" rx="10" fill="#0f172a" stroke="#334155" />

        {bokeh.map((spot) => (
          <circle
            key={`${spot.cx}-${spot.cy}`}
            cx={spot.cx}
            cy={spot.cy}
            r={spot.r}
            fill="#1e293b"
          />
        ))}

        {/* Деталь с именем */}
        <rect
          x={keychain.x}
          y={keychain.y}
          width={keychain.width}
          height={keychain.height}
          rx="8"
          fill="#334155"
          stroke="#64748b"
        />
        <text
          x="186"
          y="100"
          fontSize="44"
          fontWeight="bold"
          letterSpacing="3"
          fill="#e2e8f0"
          textAnchor="middle"
        >
          ИМЯ
        </text>
        <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        <circle cx="58" cy="80" r="11" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />

        <text x="14" y="170" fontSize="10" fill="#e2e8f0">
          Сделал сам за 25 минут
        </text>
      </svg>
    </VisualWrapper>
  );
}
