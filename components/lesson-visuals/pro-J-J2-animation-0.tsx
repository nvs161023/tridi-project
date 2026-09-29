import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Строка сравнения: одна и та же нагрузка, один и тот же материал. */
type Strip = {
  y: number;
  /** Заголовок строки — слово из content блока. */
  label: string;
  /** Итог строки — тоже слово из content блока. */
  caption: string;
  accent: string;
  /** Без рёбер пластина гнётся, с рёбрами — держит. */
  bent: boolean;
  /** Куда смотрит стрелка нагрузки (смещение от верха строки). */
  arrowTip: number;
};

const STRIPS: Strip[] = [
  { y: 26, label: "без рёбер", caption: "гнётся", accent: "#f87171", bent: true, arrowTip: 38 },
  { y: 90, label: "с рёбрами", caption: "держит", accent: "#34d399", bent: false, arrowTip: 34 },
];

const STRIP_W = 296;
const STRIP_H = 56;

/** Плашка счётчика прогиба в нижнем правом углу кадра: подложка 80×30. */
const METER = { x: 196, y: 148, w: 80, h: 30 };

/** Прогиб падает с 4 до 1 мм, когда в пластине появляются рёбра. */
const DEFLECTION_STEPS = ["4 мм", "3 мм", "2 мм", "1 мм"];

/** Значения стоят в ряд с шагом 28 px: окно 30 px показывает одно значение. */
const DEFLECTION_STEP_X = 28;
const DEFLECTION_X = 210;

/** Рёбра под пластиной во второй строке: пять штук по всей длине. */
const RIB_POSITIONS = [78, 120, 162, 204, 246];

/** Пластина под нагрузкой: без рёбер прогибается дугой, с рёбрами стоит прямой. */
function Plate({ strip }: { strip: Strip }) {
  const { y, accent, bent, arrowTip } = strip;

  return (
    <g>
      {bent ? (
        <g className="v-jj2a-plate-a">
          {/* Два прогиба одной пластины: дуга дышит, когда стрелка давит сильнее. */}
          <path
            className="v-jj2a-sag-base"
            d={`M62,${y + 34} Q160,${y + 42} 258,${y + 34} L258,${y + 41} Q160,${y + 49} 62,${y + 41} Z`}
            fill="#475569"
            stroke="#64748b"
          />
          <path
            className="v-jj2a-sag-deep"
            d={`M62,${y + 34} Q160,${y + 49} 258,${y + 34} L258,${y + 41} Q160,${y + 56} 62,${y + 41} Z`}
            fill="#475569"
            stroke="#64748b"
          />
          <polygon points={`52,${y + 41} 68,${y + 41} 60,${y + 48}`} fill="#64748b" />
          <polygon points={`252,${y + 41} 268,${y + 41} 260,${y + 48}`} fill="#64748b" />
        </g>
      ) : (
        <g className="v-jj2a-plate-b">
          <rect x="62" y={y + 30} width="196" height="8" fill="#475569" stroke="#64748b" />
          <g className="v-jj2a-ribs">
            {RIB_POSITIONS.map((x) => (
              <rect
                key={`rib-${x}`}
                x={x}
                y={y + 38}
                width="4"
                height="12"
                fill={accent}
                fillOpacity="0.55"
              />
            ))}
          </g>
        </g>
      )}

      {/* Нагрузка та же в обеих строках: та же стрелка, тот же груз. */}
      <g className="v-jj2a-load">
        <line x1="160" y1={y + 22} x2="160" y2={y + arrowTip - 8} stroke="#94a3b8" strokeWidth="1.2" />
        <polygon
          points={`154,${y + arrowTip - 8} 166,${y + arrowTip - 8} 160,${y + arrowTip}`}
          fill="#94a3b8"
        />
      </g>
    </g>
  );
}

/**
 * Прочность с рёбрами, по контенту урока: «Пластина без рёбер гнётся. С рёбрами —
 * держит. Толщина та же, прочность выше». Две широкие строки вместо двух узких
 * панелей: сверху та же пластина без рёбер прогибается дугой под стрелкой нагрузки,
 * снизу пластина той же толщины с пятью рёбрами стоит прямой. Нагрузка нарисована
 * одинаково, отличается только наличие рёбер — это и есть вывод «толщина та же».
 *
 * Числа из правил блока (0,8–1,2 мм, 2–3 толщины, 5–10 мм) в рамку не дублируются:
 * они идут списком сразу после этого блока.
 *
 * Анимация 8 с, по кругу: у пластины без рёбер прогиб дышит — дуга то глубже, то
 * мельче, стрелка нагрузки качает её вниз, — а нижняя пластина с рёбрами в это
 * время подсвечивается, когда верхняя гаснет. Два состояния пульсируют по
 * очереди: сначала работает строка «без рёбер», потом «с рёбрами». Счётчик внизу
 * справа показывает прогиб: 4 мм без рёбер и 1 мм с рёбрами. К концу цикла кадр
 * возвращается в начало. При prefers-reduced-motion показан финал: подсвечена
 * пластина с рёбрами, прогиб 1 мм.
 *
 * Числа прогиба в блоке не названы: счётчик показывает разницу состояний наглядно,
 * а не повторяет параметр печати.
 *
 * Счётчик устроен как окно: значения стоят в ряд с шагом 28 px и ползут влево, в
 * окне 30 px видно только текущее. Окно — clipPath, само оно в кадре не рисуется.
 * Клип висит на неподвижной обёртке, едет внутренняя группа: иначе окно уезжало бы
 * вместе со строкой значений.
 *
 * От pro-J-J1-animation-0 отличается тем, что там про ориентацию слоёв и трещину
 * вдоль слоя, а здесь про рёбра и прогиб. От pro-F-F2-animation-0 — тем, что там
 * две ориентации одной детали и расслоение по границе слоёв, а здесь одна
 * ориентация и разница только в рёбрах.
 *
 * Классы с префиксом v-jj2a: <style> внутри SVG действует на всю страницу.
 */
export function ProJJ2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: пластина без рёбер прогибается дугой под качающейся стрелкой нагрузки, а пластина той же толщины с пятью рёбрами остаётся прямой; два состояния пульсируют по очереди, счётчик внизу показывает, что прогиб падает с 4 до 1 мм; внизу вывод урока: толщина та же, а прочность выше"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-jj2a-sag-base { animation: v-jj2a-sag-base 8s ease-in-out infinite; }
          @keyframes v-jj2a-sag-base {
            0%, 10% { opacity: 1; }
            22% { opacity: 0; }
            34%, 55% { opacity: 1; }
            67% { opacity: 0; }
            79%, 100% { opacity: 1; }
          }
          .v-jj2a-sag-deep { animation: v-jj2a-sag-deep 8s ease-in-out infinite; }
          @keyframes v-jj2a-sag-deep {
            0%, 10% { opacity: 0; }
            22% { opacity: 1; }
            34%, 55% { opacity: 0; }
            67% { opacity: 1; }
            79%, 100% { opacity: 0; }
          }
          .v-jj2a-load { animation: v-jj2a-press 8s ease-in-out infinite; }
          @keyframes v-jj2a-press {
            0%, 10% { transform: translateY(0); }
            22% { transform: translateY(2px); }
            34%, 55% { transform: translateY(0); }
            67% { transform: translateY(2px); }
            79%, 100% { transform: translateY(0); }
          }
          .v-jj2a-note-a, .v-jj2a-plate-a { animation: v-jj2a-state-a 8s ease-in-out infinite; }
          @keyframes v-jj2a-state-a {
            0%, 30% { opacity: 1; }
            55%, 90% { opacity: 0.45; }
            100% { opacity: 1; }
          }
          .v-jj2a-note-b, .v-jj2a-plate-b, .v-jj2a-ribs {
            animation: v-jj2a-state-b 8s ease-in-out infinite;
          }
          @keyframes v-jj2a-state-b {
            0%, 30% { opacity: 0.45; }
            55%, 90% { opacity: 1; }
            100% { opacity: 0.45; }
          }
          .v-jj2a-value { animation: v-jj2a-value 8s linear infinite; }
          @keyframes v-jj2a-value {
            0%, 30% { transform: translateX(0); }
            38%, 44% { transform: translateX(-28px); }
            52%, 58% { transform: translateX(-56px); }
            66%, 94% { transform: translateX(-84px); }
            100% { transform: translateX(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-jj2a-sag-base { animation: none; opacity: 1; }
            .v-jj2a-sag-deep { animation: none; opacity: 0; }
            .v-jj2a-load { animation: none; transform: none; }
            .v-jj2a-note-a, .v-jj2a-plate-a { animation: none; opacity: 0.45; }
            .v-jj2a-note-b, .v-jj2a-plate-b, .v-jj2a-ribs { animation: none; opacity: 1; }
            .v-jj2a-value { animation: none; transform: translateX(-84px); }
          }
        `}</style>

        {/* Окно счётчика: clipPath в кадре не рисуется, rect задаёт видимую рамку окна. */}
        <defs>
          <clipPath id="v-jj2a-window">
            <rect x="195" y="163" width="30" height="13" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          одна толщина, разный результат
        </text>

        {STRIPS.map((strip) => (
          <g key={strip.label}>
            <rect x="12" y={strip.y} width={STRIP_W} height={STRIP_H} rx="8" fill="#0f172a" stroke="#475569" />
            <text x="20" y={strip.y + 13} fontSize="10" fontWeight="bold" fill={strip.accent}>
              {strip.label}
            </text>
            <text
              className={strip.bent ? "v-jj2a-note-a" : "v-jj2a-note-b"}
              x="296"
              y={strip.y + 16}
              fontSize="10"
              fontWeight="bold"
              fill={strip.accent}
              textAnchor="end"
            >
              {strip.caption}
            </text>
            <Plate strip={strip} />
          </g>
        ))}

        <text x="12" y="164" fontSize="9" fill="#94a3b8">
          толщина та же, а прочность выше
        </text>

        {/* Счётчик прогиба: с рёбрами прогиб падает с 4 мм до 1 мм */}
        <rect x={METER.x} y={METER.y} width={METER.w} height={METER.h} rx="6" fill="#0f172a" stroke="#334155" />
        <text x="204" y="158" fontSize="8.5" fill="#94a3b8">
          прогиб
        </text>
        <g clipPath="url(#v-jj2a-window)">
          <g className="v-jj2a-value">
            {DEFLECTION_STEPS.map((value, index) => (
              <text
                key={`deflection-${value}`}
                x={DEFLECTION_X + index * DEFLECTION_STEP_X}
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
