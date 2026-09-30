import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Четыре кнопки-макроса: те самые имена, которые урок предлагает выучить. */
const MACROS = [
  { label: "START_PRINT", top: 62, fill: "#0f2e22", stroke: "#34d399" },
  { label: "PAUSE", top: 80, fill: "#2e2506", stroke: "#fbbf24" },
  { label: "RESUME", top: 98, fill: "#0b2534", stroke: "#38bdf8" },
  { label: "END_PRINT", top: 116, fill: "#2e0f13", stroke: "#f87171" },
];

/**
 * «Mainsail» — тёмное окно веб-интерфейса Klipper: сверху строка состояния
 * «Klipper · печать», слева камера, температуры и шкала прогресса, а герой
 * кадра — справа: пульт макросов из четырёх кнопок START_PRINT, PAUSE, RESUME
 * и END_PRINT.
 *
 * Имена макросов и их порядок взяты прямо из keyPoints урока. Температуры
 * 210/60 — сквозные числа курса, 500 мм/с — из items урока («Скорость —
 * 500 мм/с»), своё число одно: полоса прогресса доведена до 70 % как индикация
 * середины печати (числовой подписи у неё нет).
 *
 * От P1-image-0 отличается тем, что у этого окна нет браузерной рамки: ни
 * адресной строки, ни вкладки — это не браузер, а панель на экране. От
 * D-D3-screenshot-0 (printer.cfg) отличается предметом: там строки конфига и
 * роли секций, здесь кнопки-макросы, то есть то, чем макросы запускают. От
 * окна слайсера (basic-8, G2) отличается тем, что там центр кадра — модель на
 * столе, а здесь — панель запуска.
 *
 * Кадр статичный: движение показано в P2-animation.
 */
export function ProPP2Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно Mainsail — веб-интерфейса Klipper: сверху строка состояния «Klipper · печать», слева плитка камеры с деталью на столе, температуры сопла 210 °C и стола 60 °C, шкала прогресса и подпись про скорость 500 мм в секунду; справа пульт макросов из четырёх кнопок — START_PRINT, PAUSE, RESUME и END_PRINT — с подписью «вызов с параметрами». Внизу подпись, что Mainsail — как OctoPrint, но для Klipper."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Mainsail: окно Klipper без браузера
        </text>

        {/* Окно панели: без адресной строки — это не браузер, а само приложение */}
        <rect x="8" y="22" width="304" height="138" rx="8" fill="#0f172a" stroke="#334155" />
        <rect x="8" y="22" width="304" height="17" rx="8" fill="#1e293b" />
        <circle cx="19" cy="30.5" r="3" fill="#34d399" />
        <text x="26" y="34" fontSize="8.5" fill="#e2e8f0">
          Klipper · печать
        </text>
        <text x="303" y="34" fontSize="7.5" fill="#64748b" textAnchor="end">
          Mainsail
        </text>
        <line x1="8" y1="39" x2="312" y2="39" stroke="#334155" />

        {/* Слева: камера, температуры, прогресс и скорость — состояние печати */}
        <rect x="18" y="46" width="64" height="38" rx="3" fill="#0b1220" stroke="#334155" />
        <rect x="24" y="74" width="52" height="3" fill="#334155" />
        <path d="M 44,74 C 42,66 43,60 46,56 L 56,56 C 59,60 60,66 58,74 Z" fill="#6ee7b7" fillOpacity="0.9" />
        <polygon points="49,50 53,50 51,54" fill="#fbbf24" />
        <text x="18" y="94" fontSize="7.5" fill="#94a3b8">
          камера
        </text>

        <text x="88" y="56" fontSize="7.5" fill="#94a3b8">
          сопло
        </text>
        <text x="120" y="57" fontSize="10" fontWeight="bold" fill="#fbbf24">
          210 °C
        </text>
        <text x="88" y="76" fontSize="7.5" fill="#94a3b8">
          стол
        </text>
        <text x="120" y="77" fontSize="10" fontWeight="bold" fill="#38bdf8">
          60 °C
        </text>

        <text x="18" y="108" fontSize="7.5" fill="#94a3b8">
          прогресс
        </text>
        <rect x="18" y="112" width="110" height="8" rx="4" fill="#1e293b" stroke="#334155" />
        <rect x="19" y="113" width="70" height="6" rx="3" fill="#38bdf8" />
        <text x="18" y="128" fontSize="7.5" fill="#94a3b8">
          скорость
        </text>
        <text x="18" y="145" fontSize="10" fontWeight="bold" fill="#6ee7b7">
          500 мм/с
        </text>

        {/* Герой кадра: пульт макросов — четыре кнопки, каждая со своим цветом */}
        <rect x="158" y="46" width="148" height="104" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="166" y="58" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          пульт макросов
        </text>
        {MACROS.map((macro) => (
          <g key={macro.label}>
            <rect x="166" y={macro.top} width="132" height="17" rx="4" fill={macro.fill} stroke={macro.stroke} />
            <text x="172" y={macro.top + 11} fontSize="8" fontFamily={MONO} fill="#e2e8f0">
              {macro.label}
            </text>
          </g>
        ))}
        <text x="166" y="141" fontSize="7.5" fill="#94a3b8">
          вызов с параметрами
        </text>

        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          как OctoPrint, но для Klipper
        </text>
      </svg>
    </VisualWrapper>
  );
}
