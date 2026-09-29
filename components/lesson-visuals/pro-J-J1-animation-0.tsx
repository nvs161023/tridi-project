import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Panel = {
  /** Левый верхний угол панели 145×118. */
  x: number;
  y: number;
  /** Заголовок панели — слова из контента блока: «нагрузка по слоям». */
  header: string;
  accent: string;
  /** У сломанной детали слои стоят вдоль нагрузки, у целой — поперёк. */
  broken: boolean;
  /** Подпись под схемой: что стало с деталью. */
  caption: string;
};

/** Одна и та же пластина в двух панелях: поворот на 90° меняет только слои. */
const PANELS: Panel[] = [
  {
    x: 12,
    y: 26,
    header: "нагрузка по слоям",
    accent: "#f87171",
    broken: true,
    caption: "ломается по слою",
  },
  {
    x: 163,
    y: 26,
    header: "нагрузка поперёк слоёв",
    accent: "#34d399",
    broken: false,
    caption: "поворот на 90° — держит",
  },
];

const PANEL_W = 145;
const PANEL_H = 118;

/** Плашка счётчика напряжения в нижнем правом углу кадра: подложка 86×30. */
const METER = { x: 196, y: 148, w: 86, h: 30 };

/** Шаги счётчика — по 10 МПа до предела PLA из блока «Формулы» урока: 50 МПа. */
const STRESS_STEPS = [0, 10, 20, 30, 40, 50];

/** Числа счётчика стоят в ряд с шагом 17 px: окно 17 px показывает одно значение. */
const STRESS_STEP_X = 17;
const STRESS_X = 210;

/** Пластина: одна и та же деталь в обеих панелях, меняется только рисунок слоёв. */
const PLATE = { dx: 48, dy: 33, w: 52, h: 56 };

/** Слои сломанной пластины: линии стоят вдоль нагрузки. */
const VERTICAL_LAYERS = [54, 60, 66, 72, 78, 84, 90];

/** Слои целой пластины: после поворота линии стоят поперёк нагрузки. */
const HORIZONTAL_LAYERS = [39, 45, 51, 57, 63, 69, 75, 81];

/** Трещина идёт вдоль слоя: зигзаг на всю высоту сломанной пластины. */
const CRACK = "l-3,8 l3,8 l-3,8 l3,8 l-3,8 l3,8 l-3,8";

/** Пластина со слоями и стрелками разрыва: слева добавляется трещина. */
function Plate({ panel }: { panel: Panel }) {
  const { x, y, accent, broken } = panel;
  const plateX = x + PLATE.dx;
  const plateY = y + PLATE.dy;

  return (
    <g>
      <rect x={plateX} y={plateY} width={PLATE.w} height={PLATE.h} fill="#475569" stroke="#64748b" />
      {broken
        ? VERTICAL_LAYERS.map((offset) => (
            <line
              key={`vertical-${offset}`}
              x1={x + offset}
              y1={plateY + 1}
              x2={x + offset}
              y2={plateY + PLATE.h - 1}
              stroke="#94a3b8"
              strokeOpacity="0.35"
            />
          ))
        : HORIZONTAL_LAYERS.map((offset) => (
            <line
              key={`horizontal-${offset}`}
              x1={plateX + 1}
              y1={y + offset}
              x2={plateX + PLATE.w - 1}
              y2={y + offset}
              stroke="#94a3b8"
              strokeOpacity="0.35"
            />
          ))}
      {broken ? (
        <path
          className="v-jj1a-crack"
          d={`M${x + 72},${plateY} ${CRACK}`}
          pathLength={1}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="1"
        />
      ) : null}
      <line x1={x + 26} y1={plateY} x2={x + 26} y2={plateY + PLATE.h} stroke="#94a3b8" strokeWidth="1.4" />
      <polygon points={`${x + 21},${plateY + 11} ${x + 31},${plateY + 11} ${x + 26},${plateY}`} fill="#94a3b8" />
      <polygon points={`${x + 21},${plateY + 45} ${x + 31},${plateY + 45} ${x + 26},${plateY + PLATE.h}`} fill="#94a3b8" />
    </g>
  );
}

/**
 * Как ломается деталь, по контенту урока: «Деталь с нагрузкой по слоям ломается.
 * Повёрнутая на 90° — держит. Ориентация важнее заполнения». Диптих одной и той
 * же пластины: слева слои стоят вдоль нагрузки и трещина идёт вдоль слоя, справа
 * деталь повёрнута на 90° — слои идут поперёк нагрузки, и пластина держит.
 * Внизу — вывод урока. Стрелки разрыва в обеих панелях одинаковые: меняется
 * только ориентация слоёв.
 *
 * Анимация 8 с, по кругу: трещина на левой пластине растёт сверху вниз вдоль
 * границы слоя, счётчик внизу справа отсчитывает напряжение от 0 до 50 МПа —
 * предел PLA из блока «Формулы» этого же урока, — а после четвёртой секунды в
 * правой панели проявляется врезка «держит». К концу цикла кадр возвращается в
 * начало: трещины нет, счётчик на нуле. При prefers-reduced-motion показан финал:
 * трещина доросла, счётчик стоит на 50 МПа, врезка видна.
 *
 * Счётчик устроен как окно: числа стоят в ряд с шагом 17 px и ползут влево, в
 * окне 17 px видно только текущее значение. Окно — clipPath, само оно в кадре не
 * рисуется. Клип висит на неподвижной обёртке, едет внутренняя группа: иначе окно
 * уезжало бы вместе со строкой чисел.
 *
 * От pro-J-J1-image-0 отличается тем, что там четыре схемы нагрузки и правила к
 * ним, а здесь одна деталь до и после поворота — с трещиной и без.
 *
 * Классы с префиксом v-jj1a: <style> внутри SVG действует на всю страницу.
 */
export function ProJJ1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: трещина растёт вдоль границы слоя и ломает деталь, счётчик напряжения поднимается с нуля до 50 МПа, а после четвёртой секунды появляется врезка «держит» — та же деталь, повёрнутая на 90 градусов, держит нагрузку; внизу вывод: ориентация важнее заполнения, поворот на 90 градусов меняет всё"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-jj1a-crack { animation: v-jj1a-crack 8s linear infinite; }
          @keyframes v-jj1a-crack {
            0%, 6% { stroke-dashoffset: 1; }
            50%, 96% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 1; }
          }
          .v-jj1a-hold { animation: v-jj1a-hold 8s linear infinite; }
          @keyframes v-jj1a-hold {
            0%, 48% { opacity: 0.25; }
            52%, 94% { opacity: 1; }
            100% { opacity: 0.25; }
          }
          .v-jj1a-value { animation: v-jj1a-value 8s linear infinite; }
          @keyframes v-jj1a-value {
            0%, 6% { transform: translateX(0); }
            12%, 17% { transform: translateX(-17px); }
            23%, 28% { transform: translateX(-34px); }
            34%, 39% { transform: translateX(-51px); }
            45%, 49% { transform: translateX(-68px); }
            54%, 94% { transform: translateX(-85px); }
            100% { transform: translateX(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-jj1a-crack { animation: none; stroke-dashoffset: 0; }
            .v-jj1a-hold { animation: none; opacity: 1; }
            .v-jj1a-value { animation: none; transform: translateX(-85px); }
          }
        `}</style>

        {/* Окно счётчика: clipPath в кадре не рисуется, rect задаёт видимую рамку окна. */}
        <defs>
          <clipPath id="v-jj1a-window">
            <rect x="202" y="163" width="17" height="13" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          одна и та же деталь, две ориентации
        </text>

        {PANELS.map((panel) => (
          <g key={panel.header}>
            <rect x={panel.x} y={panel.y} width={PANEL_W} height={PANEL_H} rx="8" fill="#0f172a" stroke="#475569" />
            <text x={panel.x + 8} y={panel.y + 14} fontSize="10" fontWeight="bold" fill={panel.accent}>
              {panel.header}
            </text>
            <Plate panel={panel} />
            <text
              className={panel.broken ? undefined : "v-jj1a-hold"}
              x={panel.x + 72}
              y={panel.y + 106}
              fontSize="10"
              fontWeight="bold"
              fill={panel.accent}
              textAnchor="middle"
            >
              {panel.caption}
            </text>
          </g>
        ))}

        <text x="12" y="156" fontSize="9" fill="#94a3b8">
          ориентация важнее заполнения —
        </text>
        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          поворот на 90° меняет всё
        </text>

        {/* Счётчик напряжения: число ползёт от 0 до 50 МПа по мере роста трещины */}
        <rect x={METER.x} y={METER.y} width={METER.w} height={METER.h} rx="6" fill="#0f172a" stroke="#334155" />
        <text x="204" y="158" fontSize="8.5" fill="#94a3b8">
          напряжение, МПа
        </text>
        <g clipPath="url(#v-jj1a-window)">
          <g className="v-jj1a-value">
            {STRESS_STEPS.map((value, index) => (
              <text
                key={`stress-${value}`}
                x={STRESS_X + index * STRESS_STEP_X}
                y="173"
                fontSize="10"
                fontWeight="bold"
                fill="#6ee7b7"
                textAnchor="middle"
              >
                {value}
              </text>
            ))}
          </g>
        </g>
      </svg>
    </VisualWrapper>
  );
}
