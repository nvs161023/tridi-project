import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Стойка: 5 полок по 2 принтера — ровно 10 машин из content урока. */
const SHELF_TOPS = [52, 71, 90, 109, 128];
const PRINTER_X = [18, 96];
const PRINTER_W = 76;
const PRINTER_H = 14;

/** Цвет детали в окне — по ряду стойки: ряды отличаются, машины внутри нет. */
const SHELF_COLORS = ["#38bdf8", "#38bdf8", "#34d399", "#34d399", "#fbbf24"];

/**
 * Софт фермы — list урока слово в слово: OctoPrint и OctoFarm делят «одним» и
 * «множеством», дальше Klipper, Obico, Spoolman и PrintNanny. Строк ровно шесть:
 * седьмой в подсказке нет, а панель кончается на 144 — под ней строка «начни с трёх».
 */
const SOFTWARE = [
  "OctoPrint — одним",
  "OctoFarm — множеством",
  "Klipper + Mainsail/Fluidd",
  "Obico — AI-мониторинг",
  "Spoolman — учёт пластика",
  "PrintNanny — автоматизация",
];

const SOFTWARE_X = 192;
const SOFTWARE_TOP = 68;
const SOFTWARE_STEP = 12;

/** Принтер в стойке: рамка, окно с деталью, зелёный статус и две кнопки. */
function RackPrinter({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={PRINTER_W} height={PRINTER_H} rx="2" fill="#1e293b" stroke="#475569" />
      <rect x={x + 5} y={y + 3.5} width="44" height="7" rx="1" fill="#0f172a" stroke="#334155" />
      <rect x={x + 16} y={y + 5} width="10" height="4" rx="1" fill={color} fillOpacity="0.85" />
      <circle cx={x + 56} cy={y + 7} r="2.6" fill="#34d399" />
      <rect x={x + 64} y={y + 4.5} width="5" height="2.6" rx="1" fill="#475569" />
      <rect x={x + 64} y={y + 8.4} width="5" height="2.6" rx="1" fill="#475569" />
    </g>
  );
}

/**
 * «Схема фермы» — стойка на десять принтеров, камера и датчик дыма над ней и
 * панель сервера со списком софта: кадр отвечает на два вопроса урока сразу —
 * «как всё связано» и «чем этим управляют».
 *
 * Ровно по content: «Схема: 10 принтеров, Raspberry Pi с OctoPrint, общий
 * мониторинг, камера, датчики дыма»; шесть строк софта — list «Софт для фермы»
 * слово в слово. Числа 5–50 принтеров и совет «начни с 3 принтеров» — из text и
 * tip, а «пожар — реальный риск» — из warning: в кадре риск стоит подписью под
 * стойкой, рядом с датчиком дыма, а не отдельным значком.
 *
 * От O3-image-0 (четыре квадранта с механизмами подачи нити) отличается тем, что
 * предмет один и он растиражирован: двадцать одинаковых ячеек, а не четыре разных
 * механизма. От U-U2-image-0 (коробки на прилавке) и U-U3-image-0 (платформы
 * полосами) — тем, что здесь нет ни полок с товаром, ни полос с числами: стойка
 * с окнами принтеров, панель сервера и два прибора присмотра. От M-M3-image-0
 * (сушилки на общей полке) — назначением: это не приборы одного участка, а цех.
 *
 * Кадр статичный: это image-блок, движения в нём нет.
 */
export function ProOO4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема печатной фермы: стойка из пяти полок по два принтера — десять машин, над стойкой камера и датчик дыма для общего присмотра, справа панель сервера Raspberry Pi с OctoPrint и списком софта: OctoPrint для управления одним принтером, OctoFarm — множеством, Klipper с Mainsail или Fluidd, Obico для AI-мониторинга, Spoolman для учёта пластика и PrintNanny для автоматизации. Внизу: десять принтеров в стойке и от пяти до пятидесяти машин у фермы, совет начать с трёх принтеров и напоминание, что ферму нельзя оставлять без присмотра — пожар реальный риск."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          ферма: 10 принтеров, Raspberry Pi и общий присмотр
        </text>

        {/* Камера и датчик дыма — присмотр из content урока */}
        <rect x="14" y="28" width="22" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        <circle cx="30" cy="34" r="3.4" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
        <rect x="20" y="25" width="10" height="3" rx="1" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="44" y="37" fontSize="7.5" fill="#94a3b8">
          камера
        </text>
        <circle cx="94" cy="33" r="7" fill="#334155" stroke="#f87171" />
        <circle cx="94" cy="33" r="2" fill="#f87171" />
        <text x="108" y="37" fontSize="7.5" fill="#94a3b8">
          датчик дыма
        </text>
        {/* Стойка: пять полок по два принтера — 10 машин урока */}
        <rect x="12" y="48" width="164" height="98" rx="4" fill="#1e293b" fillOpacity="0.4" stroke="#475569" />
        {SHELF_TOPS.map((top, shelf) => (
          <g key={top}>
            {PRINTER_X.map((x) => (
              <RackPrinter key={x} x={x} y={top} color={SHELF_COLORS[shelf]} />
            ))}
            <rect x="14" y={top + 16} width="160" height="2" fill="#475569" />
          </g>
        ))}

        {/* Панель сервера: Raspberry Pi с OctoPrint и шесть позиций софта */}
        <rect x="184" y="26" width="124" height="118" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="192" y="40" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          сервер: Raspberry Pi
        </text>
        <text x="192" y="54" fontSize="7.5" fill="#94a3b8">
          OctoPrint · мониторинг
        </text>
        {SOFTWARE.map((line, index) => (
          <g key={line}>
            <circle cx="186" cy={SOFTWARE_TOP + index * SOFTWARE_STEP - 3} r="1.6" fill="#34d399" />
            <text
              x={SOFTWARE_X}
              y={SOFTWARE_TOP + index * SOFTWARE_STEP}
              fontSize="7.5"
              fill="#e2e8f0"
            >
              {line}
            </text>
          </g>
        ))}

        <text x="12" y="158" fontSize="7.5" fill="#94a3b8">
          10 принтеров в стойке · 5–50 машин
        </text>
        <text x="186" y="158" fontSize="7.5" fill="#94a3b8">
          начни с трёх, потом расширяй
        </text>
        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          не оставляй ферму без присмотра: пожар — реальный риск
        </text>
      </svg>
    </VisualWrapper>
  );
}


