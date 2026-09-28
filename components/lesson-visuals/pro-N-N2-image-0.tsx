import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Блики на блестящей детали: крестики-отсветы, которые уберёт матирование. */
const GLINTS: [number, number][] = [
  [52, 124],
  [68, 127],
  [58, 132],
];

/** Капли тумана от баллона: дорожка от сопла к детали. */
const DRIFT: [number, number][] = [
  [57, 94],
  [61, 101],
  [65, 107],
  [69, 112],
  [73, 116],
];

/** Три действия подготовки: зона кадра, заголовок шага и пояснение под ним. */
const STEPS = [
  { x: 14, name: "1 · матируем", note: "блестящее — матом" },
  { x: 110, name: "2 · закрепляем", note: "клипсы и скотч" },
  { x: 206, name: "3 · свет и фон", note: "две лампы, экран" },
];

/**
 * Подготовка к сканированию: фронтальная сцена на одном верстаке из трёх действий
 * слева направо — матирование детали спреем (блики-крестики на блестящей детали
 * гасит туман из баллона), крепление на подиум клипсами и малярным скотчем, свет
 * и фон из двух ламп и белого экрана. Верстак один на все три действия, между ними
 * только пунктирные разделители: это не три карточки, а один последовательный
 * рабочий стол.
 *
 * Ровно по content урока: «Фото: объект на вращающемся столе, матированный, с
 * подсветкой» и по list: «Матируй блестящее • Закрепи на столе • Свет и фон».
 *
 * От «фотограмметрии» M-M2-image-0 отличается ракурсом и предметом: там вид сверху,
 * сплющенный стол и орбита восьми камер, здесь — профиль верстака и руки-операции
 * подготовки. Вращающегося стола в кадре нет вовсе: это ещё не съёмка, а то, что
 * делают до неё.
 */
export function ProNN2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Подготовка к сканированию: фронтальная сцена из трёх действий на одном верстаке — деталь с бликами матируют спреем из баллона, крепят на подиум клипсами и малярным скотчем, ставят свет из двух ламп и белый экран-фон"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Подготовка к сканированию: три действия
        </text>

        {/* Верстак — один на все три действия */}
        <rect x="10" y="138" width="300" height="8" fill="#334155" stroke="#475569" />

        {/* Разделители между действиями */}
        <line x1="106" y1="26" x2="106" y2="134" stroke="#475569" strokeDasharray="4 4" />
        <line x1="204" y1="26" x2="204" y2="134" stroke="#475569" strokeDasharray="4 4" />

        {/* Действие 1: деталь блестит — гасим блики спреем */}
        <rect x="46" y="120" width="30" height="18" fill="#475569" stroke="#64748b" />
        <circle cx="61" cy="129" r="3.5" fill="#0f172a" />
        {GLINTS.map(([x, y]) => (
          <g key={`glint-${x}-${y}`} stroke="#e2e8f0" strokeWidth="0.9">
            <line x1={x - 2.5} y1={y} x2={x + 2.5} y2={y} />
            <line x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} />
          </g>
        ))}
        <g transform="rotate(26 40 84)">
          <rect x="30" y="56" width="18" height="52" rx="5" fill="#334155" stroke="#64748b" />
          <rect x="35" y="46" width="8" height="12" rx="2" fill="#475569" stroke="#64748b" />
        </g>
        <polygon points="52,52 58,118 76,110" fill="#e2e8f0" fillOpacity="0.14" />
        {DRIFT.map(([x, y]) => (
          <circle key={`drift-${x}-${y}`} cx={x} cy={y} r="1.3" fill="#e2e8f0" />
        ))}

        {/* Действие 2: деталь на подиуме, прижата клипсами и скотчем */}
        <rect x="132" y="126" width="48" height="12" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="138" y="106" width="36" height="20" fill="#475569" stroke="#64748b" />
        <circle cx="156" cy="116" r="4" fill="#0f172a" />
        <polyline
          points="133,106 133,114 139,114"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.4"
        />
        <polyline
          points="173,114 179,114 179,106"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.4"
        />
        <polygon points="133,138 139,126 145,126 139,138" fill="#cbd5e1" fillOpacity="0.35" />
        <polygon points="171,138 165,126 159,126 165,138" fill="#cbd5e1" fillOpacity="0.35" />

        {/* Действие 3: экран-фон и две лампы по краям */}
        <rect
          x="222"
          y="50"
          width="72"
          height="88"
          fill="#cbd5e1"
          fillOpacity="0.12"
          stroke="#64748b"
        />
        <rect x="248" y="120" width="30" height="18" fill="#475569" stroke="#64748b" />
        <circle cx="263" cy="129" r="3.5" fill="#0f172a" />
        <line x1="214" y1="138" x2="214" y2="80" stroke="#64748b" strokeWidth="1.2" />
        <polygon points="206,80 222,80 218,72 210,72" fill="#334155" stroke="#64748b" />
        <polygon points="210,80 218,80 240,116 226,120" fill="#fde68a" fillOpacity="0.14" />
        <line x1="302" y1="138" x2="302" y2="80" stroke="#64748b" strokeWidth="1.2" />
        <polygon points="294,80 310,80 306,72 298,72" fill="#334155" stroke="#64748b" />
        <polygon points="294,80 302,80 282,116 266,120" fill="#fde68a" fillOpacity="0.14" />

        {/* Подписи действий: шаг и что именно делают руками */}
        {STEPS.map((step) => (
          <g key={step.name}>
            <text x={step.x} y="160" fontSize="7.5" fill="#e2e8f0">
              {step.name}
            </text>
            <text x={step.x} y="175" fontSize="7.5" fill="#94a3b8">
              {step.note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
