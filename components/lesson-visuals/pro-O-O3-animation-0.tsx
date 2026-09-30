import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Полоса промывочной башни: 8 слоёв по 8 px от низа (140) вверх. */
type Band = {
  y: number;
  fill: string;
  opacity: number;
  /** Смешанный слой — старый цвет, выдавленный новым: внутрь кладём чужую полоску. */
  stripe?: { y: number; fill: string };
  /** Класс появления: синие слои, смешанные, оранжевые. */
  className: string;
};

/** Башня 38×64, верх на 76, низ на 140 — ровно под соплом головы (192…218). */
const TOWER_X = 182;
const TOWER_W = 38;
const TOWER_BAND_H = 8;

/**
 * Слои башни снизу вверх: два синих (старый цвет), два смешанных (промывка) и
 * четыре оранжевых (новый цвет). Промывочная башня описана в content блока
 * «Как это работает»: «принтер печатает специальную промывочную башню, куда
 * сбрасывается старый цвет»; 20–40 г пластика и flush volume 100–200 мм³ — из
 * блока «Что нужно знать».
 */
const BANDS: Band[] = [
  { y: 132, fill: "#38bdf8", opacity: 0.75, className: "v-oo3a-p1" },
  { y: 124, fill: "#38bdf8", opacity: 0.55, className: "v-oo3a-p1" },
  {
    y: 116,
    fill: "#38bdf8",
    opacity: 0.5,
    stripe: { y: 119, fill: "#fb923c" },
    className: "v-oo3a-p2",
  },
  {
    y: 108,
    fill: "#fb923c",
    opacity: 0.45,
    stripe: { y: 111, fill: "#38bdf8" },
    className: "v-oo3a-p2",
  },
  { y: 100, fill: "#fb923c", opacity: 0.55, className: "v-oo3a-p3" },
  { y: 92, fill: "#fb923c", opacity: 0.65, className: "v-oo3a-p3" },
  { y: 84, fill: "#fb923c", opacity: 0.75, className: "v-oo3a-p3" },
  { y: 76, fill: "#fb923c", opacity: 0.85, className: "v-oo3a-p3" },
];

/** Окно счётчика flush: 58×16, окно — clipPath, числа идут вправо с шагом 58. */
const FLUSH_X = 240;
const FLUSH_Y = 52;
const FLUSH_W = 58;
const FLUSH_H = 16;
const FLUSH_STEP = 58;
const FLUSH_VALUES = ["0", "100", "200"];
const FLUSH_CENTER = FLUSH_X + FLUSH_W / 2;

/** Катушки AMS: 4 штуки в коробке 84×84, активную обводит рамка. */
const REELS: Array<[number, number]> = [
  [34, 62],
  [74, 62],
  [34, 96],
  [74, 96],
];

/**
 * «Смена цвета» — один цикл смены материала целиком: печать старым цветом, отрез,
 * откат старого отреза назад в AMS, переезд рамки активной катушки, проход новой
 * нити до сопла и промывочная башня, которая набирает слои старого, смешанного и
 * нового цвета. Счётчик flush идёт 0 → 100 → 200 мм³.
 *
 * Ровно по content урока: «Принтер печатает специальную промывочную башню, куда
 * сбрасывается старый цвет» и «AMS автоматически отрезает нить, втягивает её
 * обратно, а потом подаёт следующую»; числа 20–40 г, flush 100–200 мм³, ooze
 * shield — из «Что нужно знать». Внутренности AMS в тексте урока не описаны,
 * поэтому коробка и катушки нарисованы условно: урок называет число катушек
 * (4 цвета) и ролик с автоматическим ножом, а не схему их привода.
 *
 * Ни один элемент кадра не повторяет кадры соседей: у O1-animation рельс и
 * дрожащий шлейф, у O2-animation циклограмма из двух полос времени. Приёмы
 * «нить прорисовывается по мере прохода» (анимация stroke-dashoffset) и
 * «окно-счётчик со сдвигом» (clipPath, как у счётчика времени в O1) в модуле
 * применяются впервые, но предмет у них свой: отрез, откат и промывка.
 *
 * Классы с префиксом v-oo3a: <style> внутри SVG действует на всю страницу.
 */
export function ProOO3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация смены цвета в AMS: принтер печатает синим, потом нож в тракте закрывается и отрезает нить, старый отрез уходит назад в коробку, рамка активной катушки переезжает с первой катушки на вторую, оранжевая нить проходит путь от катушки до сопла, а промывочная башня набирает снизу вверх слои старого цвета, смешанные слои и слои нового цвета — счётчик flush идёт от нуля до ста миллиметров кубических и до двухсот, башня забирает 20–40 граммов пластика, ooze shield защищает от капель."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-oo3a-ring { animation: v-oo3a-ring 8s linear infinite; }
          .v-oo3a-cut1 { animation: v-oo3a-cut1 8s linear infinite; }
          .v-oo3a-cut2 { animation: v-oo3a-cut2 8s linear infinite; }
          .v-oo3a-olda { animation: v-oo3a-olda 8s linear infinite; }
          .v-oo3a-oldb { animation: v-oo3a-oldb 8s linear infinite; }
          .v-oo3a-new { stroke-dasharray: 94 200; stroke-dashoffset: 94; animation: v-oo3a-new 8s linear infinite; }
          .v-oo3a-p1 { animation: v-oo3a-p1 8s linear infinite; }
          .v-oo3a-p2 { animation: v-oo3a-p2 8s linear infinite; }
          .v-oo3a-p3 { animation: v-oo3a-p3 8s linear infinite; }
          .v-oo3a-flush { animation: v-oo3a-flush 8s linear infinite; }
          @keyframes v-oo3a-ring {
            0%, 28% { transform: translateX(0); }
            36%, 100% { transform: translateX(40px); }
          }
          @keyframes v-oo3a-cut1 {
            0%, 15% { transform: translateY(0); }
            18%, 26% { transform: translateY(2px); }
            30%, 100% { transform: translateY(0); }
          }
          @keyframes v-oo3a-cut2 {
            0%, 15% { transform: translateY(0); }
            18%, 26% { transform: translateY(-2px); }
            30%, 100% { transform: translateY(0); }
          }
          @keyframes v-oo3a-olda {
            0%, 18% { opacity: 1; transform: translateX(0); }
            26%, 100% { opacity: 0; transform: translateX(-16px); }
          }
          @keyframes v-oo3a-oldb {
            0%, 32% { opacity: 0.85; }
            42%, 100% { opacity: 0; }
          }
          @keyframes v-oo3a-new {
            0%, 32% { stroke-dashoffset: 94; }
            44%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes v-oo3a-p1 {
            0%, 4% { opacity: 0; }
            14%, 100% { opacity: 1; }
          }
          @keyframes v-oo3a-p2 {
            0%, 44% { opacity: 0; }
            54%, 100% { opacity: 1; }
          }
          @keyframes v-oo3a-p3 {
            0%, 68% { opacity: 0; }
            78%, 100% { opacity: 1; }
          }
          @keyframes v-oo3a-flush {
            0%, 56% { transform: translateX(0); }
            60%, 74% { transform: translateX(58px); }
            78%, 100% { transform: translateX(116px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-oo3a-ring { animation: none; transform: translateX(40px); }
            .v-oo3a-cut1 { animation: none; transform: translateY(0); }
            .v-oo3a-cut2 { animation: none; transform: translateY(0); }
            .v-oo3a-olda { animation: none; opacity: 0; transform: translateX(-16px); }
            .v-oo3a-oldb { animation: none; opacity: 0.3; }
            .v-oo3a-new { animation: none; stroke-dashoffset: 0; }
            .v-oo3a-p1, .v-oo3a-p2, .v-oo3a-p3 { animation: none; opacity: 1; }
            .v-oo3a-flush { animation: none; transform: translateX(116px); }
          }
        `}</style>
        {/* Окно счётчика flush: clipPath в кадре не рисуется, рамку задаёт rect */}
        <defs>
          <clipPath id="v-oo3a-window">
            <rect x={FLUSH_X} y={FLUSH_Y} width={FLUSH_W} height={FLUSH_H} />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          смена цвета: отрез, загрузка, промывка
        </text>

        {/* Коробка AMS: четыре катушки, активную обводит переезжающая рамка */}
        <rect x="12" y="30" width="84" height="84" rx="4" fill="#1e293b" stroke="#475569" />
        <text x="18" y="42" fontSize="7.5" fill="#94a3b8">
          AMS · 4 катушки
        </text>
        {REELS.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="9" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r="2.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.6" />
          </g>
        ))}
        <circle
          cx="34"
          cy="62"
          r="12"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.4"
          strokeDasharray="3 2"
          className="v-oo3a-ring"
        />

        {/* Тракт до головы: старый отрез (100…130) уходит назад, за ножом остаток
            старого цвета, поверх идёт новая нить от катушки до сопла */}
        <line x1="100" y1="60" x2="130" y2="60" stroke="#38bdf8" strokeWidth="2" className="v-oo3a-olda" />
        <line x1="130" y1="60" x2="190" y2="60" stroke="#38bdf8" strokeWidth="2" className="v-oo3a-oldb" />
        <line x1="100" y1="60" x2="190" y2="60" stroke="#fb923c" strokeWidth="2" className="v-oo3a-new" />
        <polygon points="132,50 140,50 136,58" fill="#94a3b8" className="v-oo3a-cut1" />
        <polygon points="132,70 140,70 136,62" fill="#94a3b8" className="v-oo3a-cut2" />
        <text x="100" y="48" fontSize="7.5" fill="#38bdf8">
          старый отрез назад
        </text>
        <text x="100" y="80" fontSize="7.5" fill="#fb923c">
          новая нить из AMS
        </text>

        {/* Голова над башней: нить приходит в каретку, сопло смотрит вниз */}
        <rect x="192" y="46" width="26" height="14" rx="2" fill="#334155" stroke="#94a3b8" />
        <polygon points="200,60 210,60 205,70" fill="#fbbf24" />
        {/* Промывочная башня: слои появляются снизу вверх по мере промывки */}
        <rect x="176" y="140" width="48" height="3" fill="#475569" />
        {["v-oo3a-p1", "v-oo3a-p2", "v-oo3a-p3"].map((className) => (
          <g key={className} className={className}>
            {BANDS.filter((band) => band.className === className).map((band) => (
              <g key={band.y}>
                <rect
                  x={TOWER_X}
                  y={band.y}
                  width={TOWER_W}
                  height={TOWER_BAND_H}
                  fill={band.fill}
                  fillOpacity={band.opacity}
                />
                {band.stripe ? (
                  <rect
                    x={TOWER_X}
                    y={band.stripe.y}
                    width={TOWER_W}
                    height="2"
                    fill={band.stripe.fill}
                    fillOpacity="0.9"
                  />
                ) : null}
              </g>
            ))}
          </g>
        ))}
        <text x="136" y="98" fontSize="7.5" fill="#fb923c">
          новый цвет
        </text>
        <text x="130" y="136" fontSize="7.5" fill="#38bdf8">
          старый цвет
        </text>
        <text x="160" y="156" fontSize="7.5" fill="#94a3b8">
          промывочная башня
        </text>

        {/* Счётчик flush: окно показывает одно число, ряд ползёт вправо */}
        <rect x="232" y="34" width="74" height="44" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="240" y="46" fontSize="7.5" fill="#94a3b8">
          flush, мм³
        </text>
        <rect
          x={FLUSH_X}
          y={FLUSH_Y}
          width={FLUSH_W}
          height={FLUSH_H}
          rx="2"
          fill="#0f172a"
          stroke="#334155"
        />
        <g clipPath="url(#v-oo3a-window)">
          <g className="v-oo3a-flush">
            {FLUSH_VALUES.map((value, index) => (
              <text
                key={value}
                x={FLUSH_CENTER - index * FLUSH_STEP}
                y="64"
                fontSize="10"
                fontWeight="bold"
                fill="#fb923c"
                textAnchor="middle"
              >
                {value}
              </text>
            ))}
          </g>
        </g>
        <text x="232" y="96" fontSize="7.5" fill="#94a3b8">
          башня: 20–40 г
        </text>
        <text x="232" y="110" fontSize="7.5" fill="#94a3b8">
          ooze shield — капли
        </text>

        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          снизу — старый цвет, сверху — новый
        </text>
      </svg>
    </VisualWrapper>
  );
}



