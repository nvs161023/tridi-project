import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре маркера на крышке — по одному на каждый соединитель. */
const MARKERS = [
  { x: 44, n: 1, accent: "#34d399" },
  { x: 74, n: 3, accent: "#fbbf24" },
  { x: 104, n: 4, accent: "#f472b6" },
  { x: 134, n: 2, accent: "#38bdf8" },
];

/** Назначение соединителей — из content урока и блока «Допуски для соединений». */
const NOTES = [
  { n: 1, name: "1. шип-паз", use: "неразъёмно, + клей", y: 30, accent: "#34d399" },
  { n: 2, name: "2. ласточкин хвост", use: "держит сдвиг", y: 68, accent: "#38bdf8" },
  { n: 3, name: "3. штифты", use: "выравнивают до склейки", y: 106, accent: "#fbbf24" },
  { n: 4, name: "4. магниты", use: "крышка снимается", y: 144, accent: "#f472b6" },
];

/**
 * Соединения из content урока: «шип-паз, ласточкин хвост, штифты, магниты. Под
 * каждым — применение» и допуски: «Шип-паз: зазор 0,2–0,3 мм. Для клея: 0,1 мм.
 * Для магнитов: +0,1 мм. Для резьбы: M3 — 2,9 мм. Для штифтов: 0,1 мм».
 *
 * Формат — ОДНА деталь из двух частей (корпус и крышка), на которой все четыре
 * соединителя стоят на своих местах: шип-паз по стыку, ласточкин хвост на торце,
 * штифты рядом, магниты в карманах. Номера на детали совпадают с номерами в
 * списке справа, а внизу — врезка с зазором 0,2–0,3 мм.
 *
 * От «Типов соединений» в F3 отличается тем, что там каталог: пять абстрактных
 * разрезов стыка в столбик, каждый со своим допуском. Здесь одна деталь, и видно,
 * ГДЕ на узле применён каждый соединитель. Допуски тоже не повторяются: в F3 они
 * подписаны под разрезами, здесь только зазор шип-паза во врезке.
 */
export function ProII3Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна деталь из корпуса и крышки с четырьмя соединителями: шип-паз по стыку для неразъёмного соединения с клеем, ласточкин хвост на торце держит сдвиг, штифты выравнивают части до склейки, магниты в карманах делают крышку съёмной; внизу врезка с зазором 0,2–0,3 мм"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          один узел: где применён каждый соединитель
        </text>

        {/* Деталь: крышка сверху, корпус снизу, стык между ними */}
        <rect x="34" y="52" width="118" height="26" fill="#475569" stroke="#94a3b8" />
        <rect x="34" y="86" width="118" height="40" fill="#475569" stroke="#94a3b8" />

        {/* Шип-паз по длинному стыку */}
        <rect x="46" y="80" width="16" height="6" rx="1" fill="#cbd5e1" />
        {/* Штифты: два тонких цилиндрика */}
        <rect x="74" y="80" width="3" height="6" fill="#e2e8f0" />
        <rect x="81" y="80" width="3" height="6" fill="#e2e8f0" />
        {/* Магниты: пара в карманах крышки и корпуса */}
        <circle cx="111" cy="76" r="3.5" fill="#f87171" />
        <circle cx="111" cy="90" r="3.5" fill="#60a5fa" />
        {/* Ласточкин хвост на торце */}
        <polygon points="144,80 152,83 144,86" fill="#cbd5e1" />

        {MARKERS.map((marker) => (
          <g key={`marker-${marker.n}`}>
            <rect
              x={marker.x}
              y="52"
              width="14"
              height="12"
              rx="4"
              fill="#0f172a"
              stroke={marker.accent}
            />
            <text
              x={marker.x + 7}
              y="61"
              fontSize="8.5"
              fontWeight="bold"
              fill={marker.accent}
              textAnchor="middle"
            >
              {marker.n}
            </text>
          </g>
        ))}

        {/* Список справа: номер, название и назначение соединителя */}
        {NOTES.map((note) => (
          <g key={`note-${note.n}`}>
            <text x="176" y={note.y} fontSize="8.5" fontWeight="bold" fill={note.accent}>
              {note.name}
            </text>
            <text x="176" y={note.y + 18} fontSize="8.5" fill="#e2e8f0">
              {note.use}
            </text>
          </g>
        ))}

        {/* Врезка: разрез стыка с зазором */}
        <rect x="24" y="138" width="128" height="36" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="46" y="144" width="28" height="16" fill="#475569" stroke="#94a3b8" />
        <rect x="80" y="144" width="28" height="16" fill="#475569" stroke="#94a3b8" />
        <line x1="74" y1="142" x2="74" y2="162" stroke="#fbbf24" strokeDasharray="3 3" />
        <line x1="80" y1="142" x2="80" y2="162" stroke="#fbbf24" strokeDasharray="3 3" />
        <text x="88" y="170" fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
          зазор 0,2–0,3 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}

