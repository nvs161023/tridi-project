import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Шесть площадок из content урока (блок «Где брать модели») и что на каждой есть.
 * Строки — из того же урока: 3MF сохраняет цвет, лицензии надо уважать.
 */
const sites = [
  { badge: "P", name: "Printables", note: "бесплатно, профили печати", accent: "#f97316" },
  { badge: "T", name: "Thingiverse", note: "самая большая база", accent: "#3b82f6" },
  { badge: "C", name: "Cults3D", note: "платные и бесплатные", accent: "#ec4899" },
  { badge: "M", name: "MakerWorld", note: "профили для Bambu", accent: "#22c55e" },
  { badge: "T", name: "Thangs", note: "поиск по всем сайтам", accent: "#14b8a6" },
  { badge: "M", name: "MyMiniFactory", note: "проверенные модели", accent: "#a855f7" },
];

/** Строки списка: карточка 21 px, шаг 24 px — шесть штук в кадр и подпись внизу. */
const rows = [12, 36, 60, 84, 108, 132];

/**
 * Сайты — вертикальный список карточек: логотип-буква, имя площадки и что там есть.
 *
 * Ровно по content урока: «Логотипы + что там есть», список площадок — из блока
 * «Где брать модели»: Thingiverse, Printables, Cults3D, MakerWorld, Thangs,
 * MyMiniFactory. Подпись внизу — подсказка из того же урока про форматы.
 *
 * От остальных визуализаций отличается форматом: единственный список карточек.
 * Тут нечего печатать и настраивать — это справочная страница «куда идти за
 * моделями», поэтому каждая строка выглядит как ссылка, а буква заменяет логотип.
 */
export function Basic11Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Где брать модели: Printables — бесплатные с профилями печати, Thingiverse — самая большая база, Cults3D — платные и бесплатные, MakerWorld — профили для Bambu, Thangs — поиск по всем сайтам, MyMiniFactory — проверенные модели"
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

        {sites.map((site, index) => {
          const y = rows[index];

          return (
            <g key={site.name}>
              <rect
                x="14"
                y={y}
                width="292"
                height="21"
                rx="6"
                fill="#0f172a"
                stroke="#334155"
              />
              <rect
                x="20"
                y={y + 3}
                width="15"
                height="15"
                rx="4"
                fill="#1e293b"
                stroke={site.accent}
                strokeWidth="1.4"
              />
              <text
                x="27.5"
                y={y + 14}
                fontSize="9.5"
                fontWeight="bold"
                fill={site.accent}
                textAnchor="middle"
              >
                {site.badge}
              </text>
              <text x="42" y={y + 14} fontSize="10.5" fontWeight="bold" fill="#e2e8f0">
                {site.name}
              </text>
              <text x="152" y={y + 14} fontSize="10" fill="#94a3b8">
                {site.note}
              </text>
              <polyline
                points={`298,${y + 6} 303,${y + 10.5} 298,${y + 15}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.6"
              />
            </g>
          );
        })}

        <text x="14" y="170" fontSize="10" fill="#94a3b8">
          Бери STL или 3MF: 3MF сохраняет цвет
        </text>
      </svg>
    </VisualWrapper>
  );
}
