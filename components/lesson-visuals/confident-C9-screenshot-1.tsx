import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно таблицы: 12…308 по X, 20…130 по Y, заголовок 16. */
const WIN_Y = 20;
const WIN_H = 110;
const BAR_H = 16;
const HEAD_Y = 54;
const ROW_Y = [78, 100];
const NOTE_Y = 122;

type Axis = { axis: string; hz: string; shaper: string; error: string; key?: boolean };

/** Частоты и рекомендация из блоков 22–25: у X и Y они свои. */
const AXES: Axis[] = [
  { axis: "X", hz: "42 Гц", shaper: "mzv", error: "±0,06 мм", key: true },
  { axis: "Y", hz: "38 Гц", shaper: "ei", error: "±0,09 мм" },
];

/**
 * Кадр блока 25 урока C9 «Таблица резонансов и шейперов».
 *
 * Макет из описания кадра `C9_resonance_ui.png`: экран прошивки с частотами осей
 * X и Y и рекомендованным типом шейпера. Числа из блока 22 — частоты лежат в
 * диапазоне 30–60 Гц и у каждой оси свои. Строка X подсвечена: mzv гасит волну
 * сильнее, но чуть тормозит движение, ei точнее держит размер.
 */
export function ConfidentC9Screenshot1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Экран прошивки с таблицей резонансов: ось X — 42 Гц, рекомендован шейпер mzv с отклонением плюс-минус 0,06 мм; ось Y — 38 Гц, шейпер ei с отклонением плюс-минус 0,09 мм. Строка X подсвечена как выбранная. Частоты у каждого принтера свои, после смены стола или ремней тест повторяют. Для посадок важнее точность, для ваз — гладкость"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          таблица резонансов и шейперов
        </text>

        {/* Окно прошивки */}
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.8"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Резонансы — рекомендации
        </text>
        <text x="304" y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          Klipper
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Шапка таблицы */}
        <text x="24" y={HEAD_Y} fontSize="10" fill="#94a3b8">
          ось
        </text>
        <text x="92" y={HEAD_Y} fontSize="10" fill="#94a3b8">
          частота
        </text>
        <text x="168" y={HEAD_Y} fontSize="10" fill="#94a3b8">
          шейпер
        </text>
        <text x="304" y={HEAD_Y} fontSize="10" fill="#94a3b8" textAnchor="end">
          отклонение
        </text>
        <line x1="18" y1="60" x2="306" y2="60" stroke="#475569" strokeOpacity="0.7" />

        {/* Строки осей */}
        {AXES.map((row, index) => {
          const y = ROW_Y[index];
          return (
            <g key={row.axis}>
              {row.key ? (
                <rect
                  x="18"
                  y={y - 13}
                  width="288"
                  height="19"
                  rx="3"
                  fill="#f59e0b"
                  fillOpacity="0.1"
                  stroke="#f59e0b"
                  strokeOpacity="0.35"
                />
              ) : null}
              <text
                x="24"
                y={y}
                fontSize="10"
                fontWeight="700"
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
              >
                {row.axis}
              </text>
              <text x="92" y={y} fontSize="10" fill="#e2e8f0">
                {row.hz}
              </text>
              <text
                x="168"
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
              >
                {row.shaper}
              </text>
              <text x="304" y={y} fontSize="10" fill="#cbd5e1" textAnchor="end">
                {row.error}
              </text>
            </g>
          );
        })}

        <text x="24" y={NOTE_Y} fontSize="10" fill="#94a3b8">
          mzv гасит сильнее, ei точнее держит размер
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Частоты у каждого принтера свои
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Сменил стол или ремни — повтори тест
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Для посадок важна точность, для ваз — гладкость
        </text>
      </svg>
    </VisualWrapper>
  );
}
