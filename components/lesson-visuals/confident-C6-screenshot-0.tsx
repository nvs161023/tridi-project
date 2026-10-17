import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно слайсера: 18…150, строка заголовка 16, четыре строки через 20. */
const WIN_Y = 18;
const WIN_H = 132;
const BAR_H = 16;
const ROW_TOP = 54;
const ROW_STEP = 20;
const LABEL_X = 136;
const VALUE_X = 296;

/** Кронштейн в миниатюре: полка 62…76, стойка 26…42. */
const MODEL = "26,62 108,62 108,76 42,76 42,134 26,134";

type Row = { label: string; value: string; key?: boolean };

/** Четыре поля модификатора — шаги 2 и 4 из блока 9 и значения блоков 5 и 13. */
const ROWS: Row[] = [
  { label: "Fill density", value: "60 %", key: true },
  { label: "Wall loops", value: "4" },
  { label: "Nozzle temp", value: "−5 °C" },
  { label: "Support", value: "выкл." },
];

const NOTES = [
  "Правый клик по модели → Add modifier",
  "Остальные поля пустые — иначе каша",
];

/**
 * Кадр блока 8 урока C6 «Модификатор в слайсере».
 *
 * Макет окна из описания кадра `C6_interface.png`: Orca, профиль PLA, внутри
 * модели стоит цилиндр-модификатор с заполнением 60 %. Слева — дерево объектов
 * с миниатюрой детали и самим цилиндром, справа — четыре поля, которые реально
 * меняют (шаги 2 и 4 блока 9): заполнение 60 %, четыре стенки и температура
 * минус 5 °C (блоки 5 и 13). Низ кадра — правило того же шага: пустые поля
 * оставляют пустыми, иначе получается каша; а добавляется модификатор правым
 * кликом по модели.
 */
export function ConfidentC6Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Модификатор в слайсере Orca, профиль PLA. Внутри модели стоит цилиндр-модификатор. Слева дерево объектов с миниатюрой кронштейна и цилиндром, справа четыре поля: Fill density 60 процентов, Wall loops 4, Nozzle temp минус 5 градусов, Support выключен. Заполнение выделено как главное поле. Модификатор добавляют правым кликом по модели, остальные поля оставляют пустыми — иначе получается каша"
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
          Modifier — цилиндр
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль: PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Дерево объектов: миниатюра детали и сам цилиндр */}
        <rect
          x="16"
          y="40"
          width="112"
          height="100"
          rx="4"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="20" y="52" fontSize="10" fill="#64748b">
          Объекты
        </text>
        <polygon points={MODEL} fill="#334155" fillOpacity="0.6" stroke="#64748b" />
        <circle
          cx="96"
          cy="70"
          r="11"
          fill="#f59e0b"
          fillOpacity="0.22"
          stroke="#f59e0b"
          strokeDasharray="4 3"
        />
        <text x="96" y="96" fontSize="10" fontWeight="700" fill="#f59e0b" textAnchor="middle">
          60 %
        </text>

        {/* Поля модификатора; заполнение — ключевое */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="132"
                  y={y - 11}
                  width="168"
                  height="16"
                  rx="3"
                  fill="#10b981"
                  fillOpacity="0.12"
                  stroke="#10b981"
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
                fill={row.key ? "#10b981" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Как добавить и чего не трогать */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={162 + index * 12}
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
