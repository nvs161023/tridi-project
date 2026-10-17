import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Нить: 28…208 по X, масштаб 1,5 px на миллиметр. */
const FILAMENT = { x: 28, y: 50, w: 180, h: 5 };
/** Метка 120 мм на правом конце нити. */
const MARK_120 = FILAMENT.x + FILAMENT.w;
/** Остаток после команды: 32 мм — 48 px, с губками штангенциркуля. */
const REST = { x: 28, y: 88, w: 48, h: 5 };
const JAW_LEFT = 20;
const JAW_RIGHT = REST.x + REST.w + 1;

type Row = { label: string; value: string; key?: boolean };

/** Расчёт из блока 13: просили 100 мм, осталось 32 мм, выдал 88 мм. */
const ROWS: Row[] = [
  { label: "просили", value: "100 мм" },
  { label: "осталось", value: "32 мм" },
  { label: "выдал", value: "88 мм" },
  { label: "множитель", value: "1,14", key: true },
];

/**
 * Кадр блока 12 урока C9 «Разметка и замер остатка».
 *
 * Макет из описания кадра `C9_esteps_measure.png` и шагов блока 13: на нити
 * стоит метка 120 мм, после команды на 100 мм остаётся 32 мм, значит мотор выдал
 * 88 мм. Штангенциркуль меряет остаток от метки до входа, а множитель считается
 * как 100 / 88 = 1,14 — это и есть поправка E-steps.
 */
export function ConfidentC9Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Замер E-steps: на нити метка 120 мм, после команды на 100 мм остаётся 32 мм. Значит мотор выдал 88 мм, а множитель для E-steps равен 100 делить на 88, то есть 1,14. Остаток меряют штангенциркулем от метки до входа, а не всю нить. Ошибка в четыре процента уже заметна на стенке 0,45 мм"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          разметка 120 мм и остаток после команды
        </text>

        {/* Нить с метками 0 и 120 мм */}
        <text x="28" y="40" fontSize="10" fill="#94a3b8" textAnchor="middle">
          0
        </text>
        <text x={MARK_120} y="40" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          120 мм
        </text>
        <rect
          x={FILAMENT.x}
          y={FILAMENT.y}
          width={FILAMENT.w}
          height={FILAMENT.h}
          rx="2"
          fill="#64748b"
        />
        {[FILAMENT.x, MARK_120].map((x) => (
          <line
            key={x}
            x1={x}
            y1="42"
            x2={x}
            y2="62"
            stroke="#94a3b8"
            strokeDasharray="3 2"
          />
        ))}

        {/* Остаток и губки штангенциркуля */}
        <text x="28" y="82" fontSize="10" fill="#94a3b8">
          остаток
        </text>
        <rect x={REST.x} y={REST.y} width={REST.w} height={REST.h} rx="2" fill="#f59e0b" />
        <rect x={JAW_LEFT} y="78" width="5" height="24" rx="1" fill="#cbd5e1" />
        <rect x={JAW_RIGHT} y="78" width="5" height="24" rx="1" fill="#cbd5e1" />
        <line x1="16" y1="104" x2="84" y2="104" stroke="#94a3b8" strokeWidth="2" />
        <text x="50" y="118" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          32 мм
        </text>

        {/* Расчёт множителя */}
        {ROWS.map((row, index) => {
          const y = 52 + index * 20;
          return (
            <g key={row.label}>
              <text x="220" y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x="304"
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

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          E-steps = текущие × 100 / 88
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Остаток меряют от метки до входа, а не всю нить
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Ошибка 4 % уже заметна на стенке 0,45 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
