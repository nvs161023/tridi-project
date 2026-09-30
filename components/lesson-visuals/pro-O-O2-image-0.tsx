import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Система: имя, пометка из tip и две строки чисел урока.
 * Третьей строки нет ни у кого: у Swapmod «для дома» упиралась в заголовок
 * «Autoswap» (наложение 0.66), а у VT CRO пунктир от каретки шёл сквозь «для фермы».
 */
type System = {
  name: string;
  /** Пометка из tip — текст и левый край сразу за именем; у APS пометки нет. */
  note: { text: string; x: number } | null;
  lines: string[];
  /** Левый край подписей: слева от детали — 12, справа — 212. */
  x: number;
  /** Базовая линия имени: верхние блоки — 60, нижние — 100. */
  y: number;
};

/** Все числа — из list и tip блока «Системы»: ничего не додумано. */
const SYSTEMS: System[] = [
  {
    name: "Swapmod",
    note: { text: "для дома", x: 53 },
    lines: ["10 пластин · 24/7", "Bambu A1 Mini"],
    x: 12,
    y: 60,
  },
  {
    name: "APS FlyingBear",
    note: null,
    lines: ["7 пластин · Ghost 7", "встроенная в принтер"],
    x: 212,
    y: 60,
  },
  {
    name: "Autoswap",
    note: { text: "для дома", x: 55 },
    lines: ["10+1 пластина", "$35 за STL, Bambu A1"],
    x: 12,
    y: 100,
  },
  {
    name: "VT CRO",
    note: { text: "для фермы", x: 246 },
    lines: ["~$3000 за каретку", "переход до 5 мин"],
    x: 212,
    y: 100,
  },
];

/** Стрелки от механизмов к пластине: линия и голова, чтобы цель была одна. */
const ARROWS = [
  { line: "76,44 120,59", head: "122,60 115.5,61.5 116.5,54.5" },
  { line: "244,44 200,59", head: "198,60 203.5,61.5 204.5,54.5" },
  { line: "60,132 137,116", head: "140,116 134.7,120.4 133.3,113.6" },
  { line: "260,132 183,116", head: "180,116 186.7,120.4 185.3,113.6" },
];

/**
 * «Системы» — пластина-герой в центре, четыре съёмника по углам и стрелки к
 * пластине: кадр отвечает на вопрос урока «кто снимает деталь и ставит новую».
 *
 * Подписи — только числа урока: 10 пластин и 24/7 у Swapmod, 7 пластин у APS,
 * 10+1 и $35 за STL у Autoswap, ~$3000 и переход до 5 мин у VT CRO. Пометки
 * «для дома» и «для фермы» — из tip и стоят серыми после имени, а не третьей
 * строкой: у Swapmod третья строка спускалась до y=92.13 и наезжала на заголовок
 * «Autoswap» (0.66), а у VT CRO до y=130 — и пунктир от каретки (260,132 → 183,116)
 * шёл прямо сквозь неё. Теперь нижние блоки кончаются на 122.13, а пунктир в том же
 * месте идёт по 122.0: рамки строк касаются на 0.13, но чернила «переход до 5 мин»
 * выше линии на 2.6 — на глаз коридор стрелок пуст.
 *
 * От каталогов курса отличается композицией, а не списком: у M-M3 и U-U2 предметы
 * стоят в ряд (сетка карточек) и ничем не связаны; здесь четыре механизма
 * тянутся стрелками к одной пластине в центре. От M-M2 (деталь в центре и кольцо
 * камер вокруг) — тем, что кольца нет: механизмы стоят по углам, а в центре не
 * деталь с орбитой, а пластина с напечатанной деталью и ручкой. От C-пож1-image-0
 * (план комнаты сверху) — предметом: тут не помещение, а машина с пластиной.
 *
 * Кадр статичный: это image-блок, движения в нём нет.
 */
export function ProOO2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Схема про системы непрерывной печати: в центре печатная пластина с напечатанной деталью и ручкой, к ней ведут четыре пунктирные стрелки от четырёх механизмов по углам — кассета Swapmod для дома с 10 пластинами для Bambu A1 Mini, встроенная APS FlyingBear на 7 пластин для Ghost 7, напечатанный крюк Autoswap для дома на 10+1 пластину за 35 долларов и промышленная каретка VT CRO для фермы за 3000 долларов с переходом до 5 минут."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          системы непрерывной печати: кто меняет пластину
        </text>

        {/* Стрелки: четыре разных механизма, а цель у них одна — пластина */}
        {ARROWS.map((arrow) => (
          <g key={arrow.line}>
            <polyline points={arrow.line} fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="5 3" />
            <polygon points={arrow.head} fill="#64748b" />
          </g>
        ))}

        {/* Пластина-герой: PEI-поверхность, напечатанная деталь и ручка для съёма */}
        <rect x="128" y="56" width="64" height="52" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.4" />
        <rect x="132" y="60" width="56" height="44" fill="#38bdf8" fillOpacity="0.12" />
        <rect x="142" y="68" width="36" height="28" rx="2" fill="#334155" stroke="#94a3b8" />
        <rect x="147" y="73" width="26" height="18" fill="none" stroke="#64748b" strokeWidth="0.8" />
        <rect x="152" y="78" width="16" height="8" fill="none" stroke="#64748b" strokeWidth="0.8" />
        <rect x="150" y="108" width="20" height="8" rx="2" fill="#334155" stroke="#38bdf8" />
        <text x="160" y="130" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          печатная пластина
        </text>

        {/* Swapmod: кассета с пластинами и мотор привода */}
        <rect x="14" y="26" width="4" height="24" rx="1" fill="#334155" />
        <rect x="18" y="28" width="44" height="4" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.9" />
        <rect x="18" y="34.5" width="44" height="4" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.9" />
        <rect x="18" y="41" width="44" height="4" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.9" />
        <rect x="18" y="47.5" width="44" height="4" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.9" />
        <circle cx="66" cy="44" r="4" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />
        <line x1="66" y1="40" x2="66" y2="28" stroke="#fbbf24" />

        {/* APS: механизм внутри корпуса принтера, пластины выезжают из щели */}
        <rect x="252" y="26" width="56" height="24" rx="2" fill="#1e293b" stroke="#94a3b8" />
        <rect x="258" y="30" width="26" height="4" rx="1" fill="none" stroke="#38bdf8" strokeWidth="0.9" />
        <rect x="258" y="36" width="26" height="4" rx="1" fill="none" stroke="#38bdf8" strokeWidth="0.9" />
        <rect x="258" y="42" width="26" height="4" rx="1" fill="none" stroke="#38bdf8" strokeWidth="0.9" />
        <line x1="290" y1="27" x2="290" y2="49" stroke="#475569" />
        <line x1="296" y1="38" x2="302" y2="38" stroke="#34d399" strokeWidth="1.2" />
        <polygon points="305,38 300,35.5 300,40.5" fill="#34d399" />

        {/* Autoswap: напечатанный крюк на рельсе, рядом значок напечатанной детали */}
        <rect x="12" y="149" width="58" height="3" rx="1" fill="#334155" />
        <rect x="28" y="140" width="14" height="9" rx="1" fill="#1e293b" stroke="#34d399" strokeWidth="1" />
        <path d="M42,149 q0,6 -6,6" fill="none" stroke="#34d399" strokeWidth="1.2" />
        <line x1="20" y1="141" x2="28" y2="143" stroke="#94a3b8" />
        <path d="M52,147 l3,-4 l3,4 l3,-4" fill="none" stroke="#fbbf24" strokeWidth="1.1" />

        {/* VT CRO: промышленная каретка с захватом над конвейером */}
        <line x1="252" y1="158" x2="306" y2="158" stroke="#475569" strokeWidth="1.2" />
        <rect x="292" y="136" width="5" height="22" rx="1" fill="#334155" stroke="#475569" />
        <rect x="262" y="140" width="30" height="5" rx="1" fill="#334155" />
        <rect x="256" y="136" width="7" height="3" rx="1" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.9" />
        <rect x="256" y="146" width="7" height="3" rx="1" fill="#1e293b" stroke="#fbbf24" strokeWidth="0.9" />

        {/* Подписи: имя системы, пометка из tip («для дома»/«для фермы») и числа урока */}
        {SYSTEMS.map((system) => (
          <g key={system.name}>
            <text x={system.x} y={system.y} fontSize="8" fontWeight="bold" fill="#38bdf8">
              {system.name}
            </text>
            {system.note ? (
              <text x={system.note.x} y={system.y} fontSize="7.5" fill="#94a3b8">
                {system.note.text}
              </text>
            ) : null}
            {system.lines.map((line, index) => (
              <text key={line} x={system.x} y={system.y + 10 + index * 10} fontSize="7.5" fill="#e2e8f0">
                {line}
              </text>
            ))}
          </g>
        ))}

        <text x="12" y="170" fontSize="8" fill="#94a3b8">
          деталь снимается сама — печать не останавливается
        </text>
      </svg>
    </VisualWrapper>
  );
}
