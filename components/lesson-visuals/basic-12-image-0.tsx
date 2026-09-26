import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Плита печати: 292×134 в кадре, сетка шагом 40 px. */
const plate = { x: 14, y: 14, width: 292, height: 134 };

const gridVerticals = [34, 74, 114, 154, 194, 234, 274];
const gridHorizontals = [30, 60, 90, 120];

/** Модель 40×20 мм нарисована 164×80 — то же соотношение сторон. */
const model = { x: 78, y: 40, width: 164, height: 80 };

/** Brim — тонкая юбка по краю модели, ширина 5 мм из блока «Печатаем брелок». */
const brim = { left: 70, top: 32, right: 250, bottom: 128 };

/**
 * Модель брелока — вид сверху на плиту печати.
 *
 * Ровно по content урока: «плоский прямоугольник с отверстием и текстом». Brim
 * показан по краю модели, размеры и имя файла — из блока «Печатаем брелок»:
 * keychain.stl 40×20×3 мм, brim 5 мм.
 *
 * Отличается от окна слайсера в уроке 9: там интерфейс с профилем и кнопками, тут
 * только плита и деталь сверху — акцент на отверстии и юбке, из-за которых брелок
 * и держится на столе.
 */
export function Basic12Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Модель брелока вид сверху: плоская деталь 40 на 20 на 3 мм с отверстием и надписью, по краю тонкая юбка brim 5 мм"
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

        {/* Плита печати с разметкой */}
        <rect
          x={plate.x}
          y={plate.y}
          width={plate.width}
          height={plate.height}
          rx="10"
          fill="#0f172a"
          stroke="#334155"
        />
        {gridVerticals.map((x) => (
          <line key={`v${x}`} x1={x} y1={plate.y + 6} x2={x} y2={plate.y + plate.height - 6} stroke="#1e293b" />
        ))}
        {gridHorizontals.map((y) => (
          <line key={`h${y}`} x1={plate.x + 6} y1={y} x2={plate.x + plate.width - 6} y2={y} stroke="#1e293b" />
        ))}

        {/* Brim: четыре линии по краю — на чертеже это тонкая юбка вокруг детали */}
        <line x1={brim.left} y1={brim.top} x2={brim.right} y2={brim.top} stroke="#f97316" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={brim.left} y1={brim.bottom} x2={brim.right} y2={brim.bottom} stroke="#f97316" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={brim.left} y1={brim.top} x2={brim.left} y2={brim.bottom} stroke="#f97316" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={brim.right} y1={brim.top} x2={brim.right} y2={brim.bottom} stroke="#f97316" strokeWidth="1.6" strokeLinecap="round" />

        {/* Сама деталь: плоский прямоугольник с отверстием под кольцо и надписью */}
        <rect
          x={model.x}
          y={model.y}
          width={model.width}
          height={model.height}
          rx="5"
          fill="#334155"
          stroke="#64748b"
        />
        <circle cx="102" cy="80" r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
        <text x="181" y="94" fontSize="22" fontWeight="bold" fill="#0f172a" textAnchor="middle">
          ИМЯ
        </text>

        {/* Подписи: что в модели важно и в каком она размере */}
        <text x="70" y="26" fontSize="10" fill="#f97316">
          brim 5 мм
        </text>
        <line x1="102" y1="92" x2="102" y2="130" stroke="#38bdf8" />
        <text x="78" y="142" fontSize="10" fill="#38bdf8">
          отверстие 3 мм
        </text>
        <text x="14" y="166" fontSize="10" fill="#94a3b8">
          keychain.stl — 40×20×3 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
