import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const SKIN = "#475569";
const SKIN_LINE = "#64748b";

/** Ладонь и четыре пальца: рука держит кольцо брелока снизу. */
const palm = { x: 56, y: 44, width: 54, height: 52 };

/** Пальцы разной длины, как у настоящей руки: средний самый длинный. */
const fingers = [
  { y: 46, width: 44 },
  { y: 59, width: 50 },
  { y: 72, width: 44 },
  { y: 85, width: 46 },
];

/** Кольцо проходит через отверстие и висит на нижнем пальце. */
const ring = { cx: 166, cy: 106, r: 11 };

/** Сам брелок: та же деталь 40×20 мм, что на схеме плиты в прошлом блоке. */
const keychain = { x: 150, y: 102, width: 88, height: 42 };

/**
 * Результат — кадр «фото»: брелок висит на кольце в руке.
 *
 * Ровно по content урока: «Фото готового брелока в руке. Подпись: „Ты сделал это
 * сам. Можно дарить“». Кольцо продето в отверстие и висит на пальце — видно, что
 * деталь уже готовая вещь, а не заготовка.
 *
 * От схемы плиты (соседний блок) отличается ракурсом: там вид сверху и brim,
 * тут композиция с рукой. От «фото кубика» в уроке 9 — формой: кубик стоял в
 * изометрии, здесь плоский брелок висит и кадр держит рука.
 */
export function Basic12Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Результат: готовый брелок с надписью висит на кольце в руке; подпись «Ты сделал это сам. Можно дарить»"
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
        <rect x="14" y="14" width="292" height="134" rx="10" fill="#0f172a" stroke="#334155" />

        {/* Рука: ладонь, четыре пальца и большой палец слева */}
        <rect
          x={palm.x}
          y={palm.y}
          width={palm.width}
          height={palm.height}
          rx="16"
          fill={SKIN}
          stroke={SKIN_LINE}
        />
        <rect x="42" y="70" width="24" height="11" rx="5.5" fill={SKIN} stroke={SKIN_LINE} />
        {fingers.map((finger) => (
          <rect
            key={finger.y}
            x="106"
            y={finger.y}
            width={finger.width}
            height="10"
            rx="5"
            fill={SKIN}
            stroke={SKIN_LINE}
          />
        ))}

        {/* Кольцо и брелок на нём */}
        <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        <rect
          x={keychain.x}
          y={keychain.y}
          width={keychain.width}
          height={keychain.height}
          rx="5"
          fill="#334155"
          stroke="#64748b"
        />
        <circle cx="166" cy="114" r="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.6" />
        <text x="204" y="128" fontSize="13" fontWeight="bold" fill="#e2e8f0" textAnchor="middle">
          ИМЯ
        </text>

        <text x="14" y="170" fontSize="10" fill="#e2e8f0">
          Ты сделал это сам. Можно дарить
        </text>
      </svg>
    </VisualWrapper>
  );
}
