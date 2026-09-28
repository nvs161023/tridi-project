import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре дорожки: программа, характеристика работы, позиция «первой модели»
 * (чем ближе к старту — тем быстрее), X инструмента и время до модели.
 */
const TRACKS = [
  {
    y: 44,
    program: "Tinkercad · бытовое",
    tool: "shapes",
    modelX: 120,
    time: "15 мин",
    timeX: 148,
  },
  {
    y: 76,
    program: "OpenSCAD · точное",
    tool: "code",
    modelX: 156,
    time: "1 ч",
    timeX: 200,
  },
  {
    y: 108,
    program: "Fusion · инженерное",
    tool: "sketch",
    modelX: 192,
    time: "2–3 ч",
    timeX: 220,
  },
  {
    y: 140,
    program: "Blender · фигурки",
    tool: "mesh",
    modelX: 228,
    time: "4–5 ч",
    timeX: 256,
  },
];

/**
 * Сравнение интерфейсов: четыре дорожки к первой модели. Программа слева, на
 * дорожке — её «почерк» работы (примитивы, строки кода, размерный эскиз, меш с
 * кистью), а финишная модель стоит тем дальше от старта, чем дольше до неё
 * учиться: Tinkercad 15 минут, OpenSCAD час, Fusion 2–3 часа, Blender 4–5 часов.
 *
 * Ровно по content урока: «Скриншоты: Tinkercad, Fusion, Blender, OpenSCAD. Под
 * каждым — сложность и применение» и по list «Сложность»: Tinkercad 15 минут до
 * первой модели, OpenSCAD 1 час, Fusion 360 2–3 часа, Blender 4–5 часов.
 *
 * От «окон программ» (F-F1 — пять окон слайсеров в ряд, basic-13-image-0 — схема
 * экрана Tinkercad, F-F4-screenshot-0 — обрезанное окно Fusion) отличается тем,
 * что окон нет вовсе: это дорожки с дистанциями, а не витрина интерфейсов.
 * От «временной шкалы» D1-animation тоже: там строки кода едут по таймлайну
 * одной печати, здесь четыре независимые трассы и сравнение цены входа.
 */
export function ProLL1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение интерфейсов: четыре дорожки к первой модели — Tinkercad с примитивами (15 минут), OpenSCAD со строками кода (1 час), Fusion с размерным эскизом (2–3 часа) и Blender с мешем и кистью (4–5 часов); чем дальше от старта стоит модель, тем дольше до неё учиться"
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
          Сравнение интерфейсов: четыре дорожки
        </text>


        {/* Дорожки: линия трассы, модель-финиш и «почерк» программы */}
        {TRACKS.map((track) => (
          <g key={`track-${track.y}`}>
            <line x1="12" y1={track.y} x2="308" y2={track.y} stroke="#475569" strokeWidth="1.6" />
            <rect
              x={track.modelX}
              y={track.y - 10}
              width="26"
              height="16"
              rx="3"
              fill="#64748b"
            />
            <circle cx={track.modelX + 8} cy={track.y - 2} r="3" fill="#0f172a" />
          </g>
        ))}

        {/* «Почерк» работы: примитивы, строки кода, размерный эскиз, меш с кистью */}
        <g stroke="#94a3b8" strokeWidth="1.1">
          {/* Tinkercad: набор примитивов рядом с моделью */}
          <polygon points="146,50 153,46 160,50 160,54 153,58 146,54" fill="#94a3b8" />
          <rect x="164" y="47" width="8" height="10" fill="#94a3b8" stroke="none" />
          <ellipse cx="168" cy="47" rx="4" ry="2" fill="#cbd5e1" stroke="none" />
          <polygon points="176,57 181,47 186,57" fill="#94a3b8" />

          {/* OpenSCAD: строки кода */}
          <rect x="182" y="79" width="34" height="4" fill="#1e293b" />
          <rect x="182" y="85" width="26" height="4" fill="#1e293b" />
          <rect x="182" y="91" width="30" height="4" fill="#1e293b" />

          {/* Fusion: деталь с фасками и размерными линиями */}
          <polygon points="218,114 228,110 240,112 244,117 232,121 220,118" fill="#94a3b8" />
          <line x1="218" y1="127" x2="244" y2="127" />
          <line x1="218" y1="124" x2="218" y2="130" />
          <line x1="244" y1="124" x2="244" y2="130" />

          {/* Blender: меш и кисть скульптора */}
          <polygon points="254,148 266,141 278,148 266,155" fill="#94a3b8" />
          <line x1="254" y1="148" x2="278" y2="148" stroke="#1e293b" />
          <line x1="266" y1="141" x2="266" y2="155" stroke="#1e293b" />
          <line x1="254" y1="148" x2="266" y2="155" stroke="#1e293b" />
          <polygon points="284,145 290,141 292,147 286,151" fill="#cbd5e1" stroke="none" />
        </g>

        {/* Подписи дорожек: программа с применением и время до первой модели */}
        {TRACKS.map((track) => (
          <g key={`label-${track.y}`}>
            <text x="16" y={track.y - 10} fontSize="7.5" fill="#e2e8f0">
              {track.program}
            </text>
            <text x={track.timeX} y={track.y - 10} fontSize="7.5" fill="#7dd3fc">
              {track.time}
            </text>
          </g>
        ))}

        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          финиш — первая модель
        </text>
        <text x="120" y="172" fontSize="7.5" fill="#94a3b8">
          чем правее модель — тем дольше учиться
        </text>
      </svg>
    </VisualWrapper>
  );
}
