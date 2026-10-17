import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** График: 12…308 по X, 34…106 по Y, целевая линия на 70. */
const PLOT = { x: 12, y: 34, w: 296, h: 72 };
const TARGET_Y = 70;
const SPLIT_X = 160;

/** Волна до автоподбора: 36 точек через 4 px, амплитуда 12 px. */
const WAVE = Array.from({ length: 36 }, (_, index) => {
  const x = 16 + index * 4;
  const fade = 1 - index * 0.008;
  const y = TARGET_Y - 12 * Math.sin(index * 0.72) * fade;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");

/** Прямая после подбора: та же шкала, рябь ±1,2 px. */
const FLAT = Array.from({ length: 36 }, (_, index) => {
  const x = 164 + index * 4;
  const y = TARGET_Y - 1.2 * Math.sin(index * 1.1);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");

/**
 * Кадр блока 4 урока C9 «Температура сопла: волна и прямая».
 *
 * Макет из описания кадра `C9_pid_loop.png`: одна шкала времени с целевой
 * линией 210 °C, до автоподбора температура гуляет волной ±12 °C, после — идёт
 * почти прямой с разбросом ±1 °C. Разделитель показывает границу автоподбора,
 * числа взяты из блока 5: коэффициенты Kp, Ki и Kd подбираются тестом на восемь
 * циклов, а не берутся из интернета.
 */
export function ConfidentC9Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Температура сопла до и после автоподбора PID: одна шкала времени и целевая линия 210 °C. До подбора температура гуляет волной плюс-минус 12 °C, после подбора идёт почти прямой с разбросом плюс-минус 1 °C. Восемь циклов автоподбора — компромисс между точностью и временем, чужие Kp, Ki и Kd на другой принтер не переносятся"
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
          температура сопла: волна и прямая
        </text>

        {/* Подписи половин графика */}
        <text x="12" y="30" fontSize="10" fontWeight="700" fill="#f87171">
          до автоподбора
        </text>
        <text x="168" y="30" fontSize="10" fontWeight="700" fill="#10b981">
          после подбора
        </text>

        {/* Поле графика и целевая линия */}
        <rect
          x={PLOT.x}
          y={PLOT.y}
          width={PLOT.w}
          height={PLOT.h}
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <line
          x1="16"
          y1={TARGET_Y}
          x2="304"
          y2={TARGET_Y}
          stroke="#60a5fa"
          strokeOpacity="0.8"
          strokeDasharray="4 3"
        />
        <text x="304" y="64" fontSize="10" fill="#93c5fd" textAnchor="end">
          цель 210 °C
        </text>

        {/* Граница автоподбора */}
        <line
          x1={SPLIT_X}
          y1="40"
          x2={SPLIT_X}
          y2="100"
          stroke="#475569"
          strokeDasharray="2 3"
        />

        {/* Кривые до и после */}
        <polyline points={WAVE} fill="none" stroke="#f87171" strokeWidth="1.6" />
        <polyline points={FLAT} fill="none" stroke="#10b981" strokeWidth="1.8" />

        <text x="16" y="98" fontSize="10" fill="#fca5a5">
          волна ±12 °C
        </text>
        <text x="168" y="98" fontSize="10" fill="#6ee7b7">
          ±1 °C
        </text>

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          PID держит цель без волны
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Восемь циклов — компромисс точности и времени
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Чужие Kp, Ki и Kd на другой принтер не переносятся
        </text>
      </svg>
    </VisualWrapper>
  );
}
