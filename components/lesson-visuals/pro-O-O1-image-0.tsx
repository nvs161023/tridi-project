import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Узел принтера: цвет узла, строки легенды и полка — номера совпадают с точками схемы.
 * Полка у каждого узла своя: у «головы» и «электроники» строк две, у «стола» и «привода»
 * одна, а общий шаг между полками наехал бы заголовком на нижнюю строку соседа сверху.
 */
type Node = {
  name: string;
  color: string;
  /** Базовая линия заголовка полки: следующая полка — через 13 после последней строки. */
  y: number;
  lines: string[];
};

/**
 * Четыре узла — весь приём кадра: точки на принтере сгруппированы по узлам машины,
 * а не по периодичности обслуживания и не под лупой.
 *
 * Номера 1–10 — ровно перечень из content блока: директ, сопло, стол, ремни,
 * моторы, плата, прошивка, датчик, камера, корпус. BLTouch назван в группе головы
 * без номера: в схеме урока его нет, а в списке «Что менять» есть.
 */
const NODES: Node[] = [
  { name: "голова", color: "#38bdf8", y: 40, lines: ["1 директ · 2 сопло", "8 датчик · BLTouch"] },
  { name: "стол", color: "#34d399", y: 73, lines: ["3 PEI-пластина"] },
  { name: "привод", color: "#fbbf24", y: 96, lines: ["4 ремни · 5 моторы"] },
  { name: "электроника", color: "#c084fc", y: 119, lines: ["6 плата · 7 прошивка", "9 камера · 10 корпус"] },
];

/** Точка с номером; `to` — конец поводка, который ведёт к самому апгрейду. */
type Marker = { n: number; x: number; y: number; color: string; to: [number, number] };

const MARKERS: Marker[] = [
  { n: 1, x: 144, y: 62, color: "#38bdf8", to: [133, 69] },
  { n: 2, x: 128, y: 88, color: "#38bdf8", to: [114, 91] },
  { n: 8, x: 82, y: 48, color: "#38bdf8", to: [95, 59] },
  { n: 3, x: 178, y: 98, color: "#34d399", to: [160, 102] },
  { n: 4, x: 42, y: 56, color: "#fbbf24", to: [55, 54] },
  { n: 5, x: 192, y: 72, color: "#fbbf24", to: [184, 65] },
  { n: 6, x: 104, y: 146, color: "#c084fc", to: [112, 136] },
  { n: 7, x: 132, y: 146, color: "#c084fc", to: [130, 131] },
  { n: 9, x: 168, y: 28, color: "#c084fc", to: [180, 33] },
  { n: 10, x: 196, y: 150, color: "#c084fc", to: [202, 152] },
];

/** Легенда: левый край полок и шаг строки внутри полки. */
const LEGEND_X = 212;
const LEGEND_LINE_STEP = 10;

/**
 * «Топ-10 апгрейдов» — схема принтера с точками, сгруппированными по узлам:
 * голова (директ, сопло, датчик филамента, BLTouch), стол (PEI), привод (ремни,
 * моторы) и электроника (плата, прошивка, камера, корпус). Слева от легенды —
 * фронтальный вид принтера, справа — четыре полки с номерами точек, внизу — вывод
 * из warning урока: ставь по одному и тестируй.
 *
 * Полки легенды стоят каждая на своей базовой линии: у «головы» и «электроники» по две
 * строки, и общий шаг 24 поднимал заголовок «стол» до y=55.33, пока нижняя строка
 * «8 датчик · BLTouch» спускалась до y=62.13 — наложение 6.8 по вертикали (мобильный
 * S: 6.32). Теперь полки идут по данным узла: следующая — через 13 после последней
 * строки, то есть между нижней строкой и следующим заголовком всегда 2.2 единицы
 * (строка 7.5px занимает 10.13, заголовок 8px — 10.67).
 *
 * Четыре ракурса принтера в курсе уже заняты, поэтому отличается приёмом, а не
 * взглядом: от C1-2 (вид сверху, восемь меток периодичности и легенда к ним) — тем,
 * что это фронтальный вид, а цвет точки значит узел, а не срок обслуживания; от
 * basic-14 (принтер сбоку, нумерованные метки и лупа с крупным узлом) — тем, что
 * лупы нет вовсе, а метки сгруппированы по узлам; от basic-1 (изометрия с выносками
 * «что это») — фронтальным видом и номерами из списка урока. Пунктирная рамка вокруг
 * машины — это десятый пункт списка, корпус; она же отделяет схему от легенды.
 *
 * Кадр статичный: это image-блок, движения в нём нет.
 */
export function ProOO1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема принтера спереди с десятью номерными метками, сгруппированными по узлам: голова — 1 директ, 2 сопло, 8 датчик филамента и BLTouch без номера; стол — 3 PEI-пластина; привод — 4 ремни, 5 моторы; электроника — 6 плата, 7 прошивка, 9 камера, 10 корпус. Корпус обведён пунктиром вокруг всей машины, справа четыре полки легенды по узлам, внизу вывод: ставь по одному и тестируй."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Топ-10 апгрейдов: точки по узлам машины
        </text>

        {/* Корпус вокруг машины — десятый пункт списка; пунктир отделяет схему от легенды */}
        <rect
          x="32"
          y="20"
          width="172"
          height="136"
          rx="8"
          fill="#c084fc"
          fillOpacity="0.03"
          stroke="#c084fc"
          strokeOpacity="0.35"
          strokeDasharray="5 4"
        />

        {/* Рама: верхняя перекладина и две стойки */}
        <rect x="52" y="38" width="120" height="9" rx="1" fill="#334155" stroke="#475569" />
        <rect x="52" y="38" width="11" height="58" rx="1" fill="#334155" stroke="#475569" />
        <rect x="161" y="38" width="11" height="58" rx="1" fill="#334155" stroke="#475569" />

        {/* Ремень по перекладине и два шкива */}
        <line x1="58" y1="54" x2="166" y2="54" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="2" />
        <circle cx="58" cy="54" r="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />
        <circle cx="166" cy="54" r="3" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />

        {/* Голова: датчик филамента, хотэнд, мотор директ-экструдера, сопло, BLTouch */}
        <rect x="96" y="58" width="14" height="9" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.1" />
        <rect x="100" y="68" width="20" height="20" rx="2" fill="#1e293b" stroke="#94a3b8" />
        <line x1="102" y1="72" x2="118" y2="72" stroke="#475569" />
        <line x1="102" y1="76" x2="118" y2="76" stroke="#475569" />
        <line x1="102" y1="80" x2="118" y2="80" stroke="#475569" />
        <rect x="120" y="64" width="12" height="16" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.1" />
        <polygon points="108,88 112,88 110,95" fill="#fbbf24" />
        <rect x="87" y="80" width="5" height="14" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />
        <line x1="89.5" y1="94" x2="89.5" y2="97" stroke="#38bdf8" />

        {/* X-мотор у правой стойки — узел привода */}
        <rect x="174" y="48" width="12" height="16" rx="2" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.1" />

        {/* Камера на штанге от перекладины — удалённый мониторинг */}
        <line x1="168" y1="42" x2="186" y2="42" stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="186" y1="42" x2="186" y2="40" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="178" y="28" width="16" height="11" rx="1.5" fill="#1e293b" stroke="#c084fc" strokeWidth="1.1" />
        <circle cx="186" cy="33.5" r="2.6" fill="#c084fc" fillOpacity="0.55" />

        {/* Стол с PEI-пластиной и каретка под ним */}
        <rect x="64" y="98" width="96" height="8" rx="1" fill="#1e293b" stroke="#34d399" strokeWidth="1.2" />
        <line x1="66" y1="100" x2="158" y2="100" stroke="#34d399" strokeWidth="1.4" />
        <rect x="68" y="106" width="88" height="4" fill="#334155" />

        {/* Основание: блок питания, плата с прошивкой, дисплей */}
        <rect x="56" y="112" width="112" height="26" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="60" y="116" width="26" height="18" rx="1" fill="#1e293b" stroke="#94a3b8" />
        <line x1="64" y1="120" x2="82" y2="120" stroke="#475569" />
        <line x1="64" y1="124" x2="82" y2="124" stroke="#475569" />
        <line x1="64" y1="128" x2="82" y2="128" stroke="#475569" />
        <rect x="94" y="116" width="42" height="18" rx="1" fill="#0f172a" stroke="#c084fc" strokeWidth="1.2" />
        <rect x="112" y="121" width="14" height="8" rx="1" fill="#c084fc" fillOpacity="0.35" stroke="#c084fc" />
        <rect x="142" y="118" width="22" height="14" rx="1" fill="#0f172a" stroke="#475569" />

        {/* Y-мотор под основанием */}
        <circle cx="62" cy="143" r="5.5" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.1" />

        {/* Точки с номерами: поводок к апгрейду, кружок и номер */}
        {MARKERS.map((marker) => (
          <g key={marker.n}>
            <line
              x1={marker.x}
              y1={marker.y}
              x2={marker.to[0]}
              y2={marker.to[1]}
              stroke={marker.color}
              strokeWidth="0.9"
            />
            <circle cx={marker.x} cy={marker.y} r="6" fill="#0f172a" stroke={marker.color} strokeWidth="1.1" />
            <text
              x={marker.x}
              y={marker.y + 2.4}
              fontSize="7.5"
              fontWeight="bold"
              fill={marker.color}
              textAnchor="middle"
            >
              {marker.n}
            </text>
          </g>
        ))}

        {/* Легенда: четыре узла, у каждого — цвет и номера точек */}
        {NODES.map((node) => (
          <g key={node.name}>
            <circle cx={LEGEND_X + 2} cy={node.y - 3} r="2.5" fill={node.color} />
            <text
              x={LEGEND_X + 8}
              y={node.y}
              fontSize="8"
              fontWeight="bold"
              fill={node.color}
            >
              {node.name}
            </text>
            {node.lines.map((line, lineIndex) => (
              <text
                key={line}
                x={LEGEND_X + 8}
                y={node.y + LEGEND_LINE_STEP + lineIndex * LEGEND_LINE_STEP}
                fontSize="7.5"
                fill="#e2e8f0"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        <text x="12" y="170" fontSize="8" fill="#94a3b8">
          ставь по одному и тестируй: апгрейд может ухудшить печать
        </text>
      </svg>
    </VisualWrapper>
  );
}
