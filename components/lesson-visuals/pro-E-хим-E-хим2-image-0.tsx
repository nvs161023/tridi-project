import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Утилизация из content урока: «Ацетон, IPA, эпоксидку нельзя сливать в раковину.
 * Это токсичные отходы. Собери в контейнер, засвети UV (если смола), сдай в
 * утилизацию» и список «PLA: компост (промышленный) | PETG: переработка | ABS:
 * растворение в ацетоне | Химия: контейнер для токсичных отходов | Смолы:
 * UV-засветка → контейнер».
 *
 * Форма — три вертикальные колонки-потока «отход → что делаем → контейнер», а не
 * ряд ёмкостей с подписями (это язык E1-1, B2, E2-3) и не горизонтальные цепочки
 * рамок со стрелками (схема вентиляции A-без2). Внизу слева — перечёркнутая
 * раковина: «в раковину нельзя» сказано и в этом уроке, и в правилах E-хим1.
 *
 * Подписи держат зазор ≥8 px от фигур, строки — шаг ≥14 px: проверено
 * check_visuals и check_text_bounds.
 */
const FLOWS = [
  {
    cx: 64,
    kind: "plastic",
    label: "пластик",
    step: "сортировка по типу",
    result: "переработка",
    accent: "#38bdf8",
  },
  {
    cx: 160,
    kind: "chem",
    label: "химия",
    step: "закрытая тара, этикетка",
    result: "токсичные отходы",
    accent: "#fbbf24",
  },
  {
    cx: 256,
    kind: "resin",
    label: "смолы",
    step: "UV-засветка",
    result: "контейнер смол",
    accent: "#a78bfa",
  },
];

/** «Контейнеры для отходов» — три маршрута и запрет раковины. */
export function ProEHimEHim2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Отходы тремя маршрутами: пластик — обрезки, сортировка по типу, переработка; химия — флакон, закрытая тара с этикеткой, контейнер токсичных отходов; смолы — жидкий фотополимер, UV-засветка, контейнер смол; внизу перечёркнутая раковина — сливать нельзя"
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
          отходы: три маршрута и чего делать нельзя
        </text>
        {FLOWS.map((flow) => (
          <g key={flow.kind}>
            <text x={flow.cx} y="29" fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
              {flow.label}
            </text>

            {/* Иконка отхода: обрезки, флакон, лужица смолы — привязана к колонке */}
            {flow.kind === "plastic" ? (
              <>
                <rect
                  x={flow.cx - 12}
                  y="42"
                  width="10"
                  height="6"
                  rx="1"
                  fill="#38bdf8"
                  fillOpacity="0.5"
                />
                <rect
                  x={flow.cx + 2}
                  y="44"
                  width="12"
                  height="5"
                  rx="1"
                  fill="#38bdf8"
                  fillOpacity="0.5"
                />
                <rect
                  x={flow.cx - 8}
                  y="50"
                  width="8"
                  height="5"
                  rx="1"
                  fill="#38bdf8"
                  fillOpacity="0.5"
                />
              </>
            ) : null}

            {flow.kind === "chem" ? (
              <>
                <rect x={flow.cx - 5} y="40" width="10" height="3" rx="1" fill="#64748b" />
                <rect x={flow.cx - 4} y="43" width="8" height="6" fill="#fbbf24" fillOpacity="0.6" />
                <rect
                  x={flow.cx - 8}
                  y="49"
                  width="16"
                  height="13"
                  rx="2"
                  fill="#fbbf24"
                  fillOpacity="0.45"
                  stroke="#fbbf24"
                />
              </>
            ) : null}

            {flow.kind === "resin" ? (
              <>
                <circle
                  cx={flow.cx}
                  cy="54"
                  r="8"
                  fill="#a78bfa"
                  fillOpacity="0.45"
                  stroke="#a78bfa"
                />
                <polygon
                  points={`${flow.cx - 6},48 ${flow.cx + 6},48 ${flow.cx},42`}
                  fill="#a78bfa"
                />
              </>
            ) : null}

            {/* Стрелка вниз: от отхода к шагу обработки */}
            <line x1={flow.cx} y1="62" x2={flow.cx} y2="68" stroke="#64748b" strokeWidth="1.6" />
            <polygon
              points={`${flow.cx - 4},64 ${flow.cx},74 ${flow.cx + 4},64`}
              fill="#64748b"
            />

            <text x={flow.cx} y="88" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
              {flow.step}
            </text>

            {/* Стрелка вниз: к контейнеру */}
            <line x1={flow.cx} y1="98" x2={flow.cx} y2="104" stroke="#64748b" strokeWidth="1.6" />
            <polygon
              points={`${flow.cx - 4},102 ${flow.cx},112 ${flow.cx + 4},102`}
              fill="#64748b"
            />

            <rect x={flow.cx - 41} y="114" width="82" height="4" rx="1" fill={flow.accent} />
            <rect
              x={flow.cx - 39}
              y="118"
              width="78"
              height="30"
              rx="3"
              fill="#0f172a"
              stroke="#64748b"
            />
            <text x={flow.cx} y="136" fontSize="8" fill={flow.accent} textAnchor="middle">
              {flow.result}
            </text>
          </g>
        ))}

        {/* Перечёркнутая раковина: сливать нельзя */}
        <rect x="26" y="150" width="14" height="3" rx="1" fill="#64748b" />
        <line x1="40" y1="153" x2="40" y2="157" stroke="#64748b" />
        <rect x="10" y="158" width="34" height="9" rx="2" fill="#475569" stroke="#64748b" />
        <circle cx="27" cy="162" r="2.5" fill="#0f172a" />
        <line x1="6" y1="152" x2="46" y2="172" stroke="#f87171" strokeWidth="2" />
        <text x="54" y="166" fontSize="8" fill="#f87171">
          не сливать в раковину
        </text>
      </svg>
    </VisualWrapper>
  );
}
