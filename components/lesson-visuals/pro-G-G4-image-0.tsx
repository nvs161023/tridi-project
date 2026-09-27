import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Точки правильного многоугольника — так видно, из скольких граней состоит круг. */
function polygon(cx: number, cy: number, radius: number, sides: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    const x = (cx + radius * Math.cos(angle)).toFixed(1);
    const y = (cy + radius * Math.sin(angle)).toFixed(1);
    return `${x},${y}`;
  }).join(" ");
}

/**
 * Три окружности одного вида с разным разрешением: 0,1 мм — видна огранка,
 * 0,05 мм — заметно лучше, 0,01 мм — гладко. Ни моделей, ни сопла: сравниваются
 * только сами контуры, как их строит слайсер.
 *
 * Ровно по content урока: «Фото: окружность с разрешением 0,1 мм (грани),
 * 0,05 мм (лучше), 0,01 мм (гладко)».
 *
 * От «Рядов однотипных образцов» в других уроках отличается предметом: там
 * сравниваются свойства пяти объектов, здесь один и тот же контур при трёх
 * значениях параметра, и видно, как грани превращаются в гладкую окружность.
 * От «Видов шва» в G2 — тем, что там деталь и линии шва, а здесь чистая
 * геометрия контура без детали.
 */
export function ProGG4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение разрешения окружностей: при 0,1 миллиметра видна огранка из двенадцати граней, при 0,05 миллиметра контур лучше, при 0,01 миллиметра окружность гладкая"
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
          Resolution: три окружности — три результата
        </text>

        <polygon points={polygon(64, 74, 34, 12)} fill="#334155" stroke="#f87171" />
        <polygon points={polygon(160, 74, 34, 24)} fill="#334155" stroke="#fbbf24" />
        <polygon points={polygon(256, 74, 34, 48)} fill="#334155" stroke="#6ee7b7" />

        <text x="64" y="126" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          0,1 мм
        </text>
        <text x="160" y="126" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          0,05 мм
        </text>
        <text x="256" y="126" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          0,01 мм
        </text>

        <text x="64" y="144" fontSize="9" fill="#f87171" textAnchor="middle">
          видна огранка
        </text>
        <text x="160" y="144" fontSize="9" fill="#fbbf24" textAnchor="middle">
          лучше
        </text>
        <text x="256" y="144" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          гладко
        </text>

        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          чем мельче сегменты, тем глаже и больше G-кода
        </text>
      </svg>
    </VisualWrapper>
  );
}
