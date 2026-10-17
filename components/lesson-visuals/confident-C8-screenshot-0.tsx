import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно шва: 12…308 по X, заголовок 16, четыре строки через 20. */
const WIN_Y = 18;
const WIN_H = 110;
const BAR_H = 16;
const ROW_TOP = 52;
const ROW_STEP = 20;
const LABEL_X = 196;
const VALUE_X = 304;

type Row = { label: string; value: string; key?: boolean };

/** Режим, точка, сдвиг и wipe on loop — блоки 6–8. */
const ROWS: Row[] = [
  { label: "Режим", value: "nearest", key: true },
  { label: "Точка", value: "back" },
  { label: "Сдвиг", value: "по слоям" },
  { label: "Wipe", value: "вкл" },
];

const NOTES = [
  "Nearest — шов в ребро, sharpest — в острый угол",
  "Сдвиг по слоям убирает столбик по высоте",
];

/**
 * Кадр блока 7 урока C8 «Окно шва: режим и положение точки».
 *
 * Макет окна из описания кадра `C8_seam_ui.png`: слева деталь со швом, ушедшим
 * в ребро, справа четыре поля — режим, точка старта, сдвиг по слоям и wipe on
 * loop. Режим nearest и точка back взяты из практики блока 8, сдвиг по слоям и
 * wipe on loop — из блока 6: первый не даёт шву сложиться в столбик, второй
 * размазывает точку старта по стенке.
 */
export function ConfidentC8Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно шва: режим и положение точки. Слева деталь, у которой шов уведён в ребро. Справа четыре поля: режим nearest, точка back, сдвиг по слоям и wipe on loop включён. Nearest уводит шов в ребро, sharpest — в острый угол. Сдвиг по слоям убирает столбик на высокой детали"
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

        {/* Окно с заголовком */}
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
          Шов — режим и положение
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль: PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Область предпросмотра */}
        <rect
          x="16"
          y="38"
          width="172"
          height="86"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />

        {/* Деталь с ребром: шов уходит в ребро, а не на лицо */}
        <rect x="52" y="52" width="74" height="68" rx="2" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
        <rect x="126" y="52" width="14" height="68" fill="#475569" fillOpacity="0.55" stroke="#64748b" />
        <line x1="126" y1="52" x2="126" y2="120" stroke="#f59e0b" strokeDasharray="3 3" />
        {[58, 70, 82, 94, 106].map((cy) => (
          <circle key={cy} cx="126" cy={cy} r="1.6" fill="#fcd34d" />
        ))}

        {/* Подписи: точка старта на слое и сам шов */}
        <text x="118" y="46" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="end">
          точка старта
        </text>
        <line x1="120" y1="49" x2="124" y2="57" stroke="#f59e0b" strokeOpacity="0.7" />
        <text x="118" y="112" fontSize="10" fill="#94a3b8" textAnchor="end">
          шов
        </text>
        <line x1="120" y1="108" x2="125" y2="96" stroke="#94a3b8" strokeOpacity="0.6" />

        {/* Поля окна; режим — ключевой */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="192"
                  y={y - 11}
                  width="114"
                  height="16"
                  rx="3"
                  fill="#f59e0b"
                  fillOpacity="0.12"
                  stroke="#f59e0b"
                  strokeOpacity="0.4"
                />
              ) : null}
              <text x={LABEL_X} y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#fcd34d" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Правила выбора */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={146 + index * 16}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
