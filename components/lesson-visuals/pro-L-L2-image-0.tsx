import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Силуэт органической фигурки: плавная форма из восьми точек. */
const FIGURE = "118,92 130,76 144,72 156,80 160,94 152,106 132,108 120,100";

/** Ярусы архитектурного макета и окна-ниши на них. */
const MACETTE = [
  { x: 266, y: 106, width: 34, height: 10, windows: [270, 280, 290] },
  { x: 270, y: 92, width: 26, height: 14, windows: [274, 284] },
  { x: 274, y: 78, width: 18, height: 14, windows: [278, 286] },
];

/**
 * Примеры моделей: на столе мастера четыре предмета разной природы — инженерный
 * кронштейн с рёбрами и отверстиями, органическая фигурка плавной формы,
 * ювелирное кольцо с бликом и многоуровневый архитектурный макет с окнами.
 * Под каждым — что это и чем такое делают.
 *
 * Ровно по content урока: «Фото: инженерная деталь, органическая фигурка,
 * ювелирное кольцо, архитектурный макет» и по list «Соответствие»: инженерные —
 * Fusion 360, органические — Blender, ювелирные — Rhino 3D, архитектурные — Rhino.
 *
 * От каталога приборов M-M3-image-0 отличается построением: там полка и три
 * аппарата одной природы с тремя строками ТТХ, здесь диорама — предметы разных
 * классов, материалов и масштабов стоят на столе на разной глубине и высоте, и
 * вместо ТТХ у каждого одна строка «что это и чем делают». Ряда и сетки плиток
 * тоже нет.
 */
export function ProLL2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Примеры моделей на столе мастера: инженерный кронштейн с рёбрами и отверстиями, органическая фигурка плавной формы, крупное ювелирное кольцо с бликом и многоуровневый архитектурный макет с окнами; подписи — что это и в какой программе такое делают"
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
          Примеры моделей: что делают в программах
        </text>

        {/* Стол мастера */}
        <rect x="12" y="104" width="296" height="30" rx="8" fill="#334155" />

        {/* Инженерный кронштейн: плита с рёбрами и отверстиями */}
        <polygon points="36,98 70,86 96,100 62,112" fill="#94a3b8" />
        <line x1="46" y1="95" x2="60" y2="105" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="66" y1="91" x2="80" y2="101" stroke="#e2e8f0" strokeWidth="1" />
        <circle cx="52" cy="99" r="3" fill="#0f172a" />
        <circle cx="84" cy="100" r="3" fill="#0f172a" />

        {/* Органическая фигурка: плавная форма без граней */}
        <polygon points={FIGURE} fill="#64748b" />

        {/* Ювелирное кольцо: крупнее остальных, с бликом */}
        <circle cx="222" cy="86" r="26" fill="none" stroke="#fbbf24" strokeWidth="4" />
        <circle cx="222" cy="86" r="15" fill="#1e293b" />
        <polygon points="248,70 251,76 257,79 251,82 248,88 245,82 239,79 245,76" fill="#fde68a" />

        {/* Архитектурный макет: ярусы с окнами-нишами */}
        {MACETTE.map((tier) => (
          <g key={`tier-${tier.y}`}>
            <rect
              x={tier.x}
              y={tier.y}
              width={tier.width}
              height={tier.height}
              fill="#cbd5e1"
              fillOpacity="0.75"
            />
            {tier.windows.map((wx) => (
              <rect key={`window-${wx}-${tier.y}`} x={wx} y={tier.y + 3} width="3" height="4" fill="#0f172a" />
            ))}
          </g>
        ))}

        <text x="12" y="152" fontSize="7.5" fill="#e2e8f0">
          инженерный кронштейн — Fusion
        </text>
        <text x="12" y="166" fontSize="7.5" fill="#e2e8f0">
          органическая фигурка — Blender
        </text>
        <text x="176" y="152" fontSize="7.5" fill="#e2e8f0">
          ювелирное кольцо — Rhino
        </text>
        <text x="176" y="166" fontSize="7.5" fill="#e2e8f0">
          архитектурный макет — Rhino
        </text>
      </svg>
    </VisualWrapper>
  );
}
