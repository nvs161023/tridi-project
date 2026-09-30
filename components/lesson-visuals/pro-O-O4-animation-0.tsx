import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Два свободных принтера: панель 172×48, статус-точка и деталь на столе. */
type Printer = {
  /** Верхний край панели: 34 у первого, 92 у второго. */
  y: number;
  name: string;
  /** Класс статус-точки и класс детали. */
  status: string;
  part: string;
};

const PRINTERS: Printer[] = [
  { y: 34, name: "принтер 1", status: "v-oo4a-st1", part: "v-oo4a-part1" },
  { y: 92, name: "принтер 2", status: "v-oo4a-st2", part: "v-oo4a-part2" },
];

/** Три ячейки очереди: верхний заказ уходит на принтер первым. */
const SLOT_TOPS = [62, 86, 110];

/** Полёт заказа: из очереди в стол принтера — 192 px вправо. */
const FLIGHT = 192;

/** Три состояния принтера из кадра: печатает, готово, свободен. */
const STATES: Array<{ label: string; x: number; color: string }> = [
  { label: "печатает", x: 138, color: "#fbbf24" },
  { label: "готово", x: 192, color: "#34d399" },
  { label: "свободен", x: 238, color: "#64748b" },
];

/**
 * Заказ в очереди: подсвеченный прямоугольник с «швом» пластины — движется он,
 * а не подпись, поэтому у заказа нет ни номера, ни имени: их негде взять в тексте
 * урока, а бегущий текст наложился бы на чужие подписи.
 */
function Order({ y, fill, className }: { y: number; fill: string; className: string }) {
  return (
    <g className={className}>
      <rect x="24" y={y} width="76" height="12" rx="3" fill={fill} fillOpacity="0.4" stroke={fill} />
      <line x1="38" y1={y} x2="38" y2={y + 12} stroke={fill} strokeWidth="0.8" strokeOpacity="0.8" />
      <line x1="86" y1={y} x2="86" y2={y + 12} stroke={fill} strokeWidth="0.8" strokeOpacity="0.8" />
    </g>
  );
}

/**
 * «Очередь» — цикл заказа: заказ появляется в очереди на сервере, уходит на
 * свободный принтер, принтер печатает, деталь готова, её забирают — и принтер
 * снова свободен. Статус принтера показан цветом точки: серый «свободен»,
 * жёлтый «печатает», зелёный «готово»; расшифровка идёт легендой под машинами.
 *
 * Ровно по content урока: «Заказ приходит на сервер. Распределяется на свободный
 * принтер. Оператор снимает, ставит новое». Имена софта не подписаны нарочно:
 * очередь урок называет сервером и свободным принтером, а OctoFarm и Obico стоят
 * отдельным list и уже подписаны в кадре O4-image-0. Ни номеров заказов, ни
 * сроков в тексте нет, поэтому заказы — безымянные плитки: подпись заказа летела
 * бы сквозь подписи принтеров.
 *
 * Тот же приём смены цвета точки (анимация fill) и окна очереди в курсе не занят:
 * у O2-animation две полосы времени, у O3-animation отрез и промывочная башня.
 * От O4-image-0 отличается предметом: там статичная стойка и панель софта, тут —
 * движение заказов между сервером и двумя машинами.
 *
 * Классы с префиксом v-oo4a: <style> внутри SVG действует на всю страницу.
 */
export function ProOO4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация очереди печатной фермы: слева панель сервера с очередью из трёх заказов, справа два принтера. Заказ прилетает в очередь, верхний заказ уходит на свободный первый принтер, точка статуса желтеет и он печатает, потом зеленеет — деталь готова, деталь уезжает вправо, её забирает оператор, и принтер снова свободен. Так же заказ уходит на второй принтер. Легенда внизу: печатает, готово, свободен. Оператор только снимает готовую деталь и ставит новую — очередь ждёт свободный принтер."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-oo4a-arrive { animation: v-oo4a-arrive 8s linear infinite; }
          .v-oo4a-t1 { animation: v-oo4a-t1 8s linear infinite; }
          .v-oo4a-t2 { animation: v-oo4a-t2 8s linear infinite; }
          .v-oo4a-st1 { animation: v-oo4a-st1 8s linear infinite; }
          .v-oo4a-st2 { animation: v-oo4a-st2 8s linear infinite; }
          .v-oo4a-part1 { animation: v-oo4a-part1 8s linear infinite; }
          .v-oo4a-part2 { animation: v-oo4a-part2 8s linear infinite; }
          @keyframes v-oo4a-arrive {
            0%, 2% { opacity: 0; transform: translateY(18px); }
            10%, 100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes v-oo4a-t1 {
            0%, 20% { opacity: 1; transform: translateX(0); }
            34%, 100% { opacity: 0; transform: translateX(${FLIGHT}px); }
          }
          @keyframes v-oo4a-st1 {
            0%, 24% { fill: #64748b; }
            30%, 56% { fill: #fbbf24; }
            60%, 72% { fill: #34d399; }
            78%, 100% { fill: #64748b; }
          }
          @keyframes v-oo4a-part1 {
            0%, 58% { opacity: 0; transform: translateX(0); }
            62%, 72% { opacity: 1; transform: translateX(0); }
            82%, 100% { opacity: 0; transform: translateX(64px); }
          }
          @keyframes v-oo4a-t2 {
            0%, 44% { opacity: 1; transform: translateX(0); }
            56%, 100% { opacity: 0; transform: translate(${FLIGHT}px, 31px); }
          }
          @keyframes v-oo4a-st2 {
            0%, 48% { fill: #64748b; }
            54%, 74% { fill: #fbbf24; }
            78%, 86% { fill: #34d399; }
            92%, 100% { fill: #64748b; }
          }
          @keyframes v-oo4a-part2 {
            0%, 76% { opacity: 0; transform: translateX(0); }
            80%, 88% { opacity: 1; transform: translateX(0); }
            96%, 100% { opacity: 0; transform: translateX(64px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-oo4a-arrive { animation: none; opacity: 1; transform: translateY(0); }
            .v-oo4a-t1, .v-oo4a-t2 { animation: none; opacity: 1; transform: translateX(0); }
            .v-oo4a-st1, .v-oo4a-st2 { animation: none; fill: #64748b; }
            .v-oo4a-part1, .v-oo4a-part2 { animation: none; opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          очередь: заказ → свободный принтер → снял деталь
        </text>

        {/* Связь сервера с машинами: заказ уходит по этим двум трактам */}
        <line x1="112" y1="60" x2="128" y2="60" stroke="#475569" strokeDasharray="3 2" />
        <line x1="112" y1="118" x2="128" y2="118" stroke="#475569" strokeDasharray="3 2" />

        {/* Панель сервера: три ячейки очереди, верхний заказ уходит первым */}
        <rect x="12" y="26" width="100" height="106" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="20" y="40" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          сервер · OctoFarm
        </text>
        <text x="20" y="54" fontSize="7.5" fill="#94a3b8">
          очередь заказов
        </text>
        {SLOT_TOPS.map((top) => (
          <rect
            key={top}
            x="20"
            y={top}
            width="84"
            height="18"
            rx="3"
            fill="none"
            stroke="#475569"
            strokeDasharray="3 2"
          />
        ))}
        <Order y={65} fill="#38bdf8" className="v-oo4a-t1" />
        <Order y={89} fill="#34d399" className="v-oo4a-t2" />
        <Order y={113} fill="#fbbf24" className="v-oo4a-arrive" />
        {/* Две машины фермы: статус-точка, портал, стол и деталь на нём */}
        {PRINTERS.map((printer) => (
          <g key={printer.name}>
            <rect
              x="128"
              y={printer.y}
              width="172"
              height="48"
              rx="6"
              fill="#1e293b"
              fillOpacity="0.35"
              stroke="#475569"
            />
            <text x="136" y={printer.y + 12} fontSize="8.5" fontWeight="bold" fill="#e2e8f0">
              {printer.name}
            </text>
            <circle cx="146" cy={printer.y + 26} r="3.2" fill="#64748b" className={printer.status} />
            <rect x="160" y={printer.y + 18} width="124" height="4" rx="1" fill="#334155" />
            <rect x="160" y={printer.y + 38} width="124" height="3" fill="#475569" />
            <rect
              x="216"
              y={printer.y + 28}
              width="16"
              height="10"
              rx="1"
              fill="#6ee7b7"
              className={printer.part}
            />
          </g>
        ))}

        {/* Легенда статусов: цвет точки — состояние машины из кадра */}
        {STATES.map((state) => (
          <g key={state.label}>
            <circle cx={state.x - 6} cy="149" r="3.2" fill={state.color} />
            <text x={state.x} y="152" fontSize="7.5" fill="#94a3b8">
              {state.label}
            </text>
          </g>
        ))}

        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          сервер держит очередь: заказ ждёт свободный принтер
        </text>
      </svg>
    </VisualWrapper>
  );
}



