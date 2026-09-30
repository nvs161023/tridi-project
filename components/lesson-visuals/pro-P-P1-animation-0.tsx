import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Восемь сегментов шкалы прогресса: горит один — это и есть 12 % (1/8 = 12,5 %). */
const PROGRESS_X = [26, 36, 46, 56, 66, 76, 86, 96];

/** Три слоя детали: лежат стопкой над столом, верхние проявляются по ходу печати. */
const LAYER_TOPS = [126, 124, 122];

/**
 * «Удалённое управление» — большой телефон с открытым OctoPrint: палец жмёт
 * зелёную кнопку «Печать», по кнопке расходится кружок нажатия, над антенной
 * принтера загораются дуги связи, голова едет по порталу, слои детали растут,
 * а счётчик на экране переключается с 0 % на 12 %.
 *
 * Ровно по content урока: «Телефон → OctoPrint → принтер. Печать запускается с
 * телефона» — это и есть сюжет кадра, а не подпись к нему. Число 12 % — шаг
 * шкалы: горит один сегмент из восьми (12,5 %), то есть начало печати; больше
 * никаких чисел в кадре нет.
 *
 * От C-пож1-animation (цепочка предметов, стрелки и телефон с карточкой тревоги
 * в конце) отличается тем, что здесь нет ни цепочки, ни стрелок, ни карточки:
 * телефон — герой кадра, а связь показана дугами над антенной. Дуги в C-пож1
 * стоят мелкой деталью над умной розеткой и ничего не значат; здесь связь —
 * сюжет. От O4-animation (панель сервера и очередь заказов) отличается тем, что
 * сервера в кадре нет вовсе: команда идёт из телефона прямо в принтер.
 *
 * Классы с префиксом v-pp1a: <style> внутри SVG действует на всю страницу.
 */
export function ProPP1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация удалённой печати: на большом экране телефона открыт OctoPrint, палец нажимает зелёную кнопку «Печать», по кнопке расходится кружок нажатия; над антенной принтера загораются дуги связи, голова едет по порталу, слои детали на столе растут один за другим, а счётчик прогресса на экране переключается с 0 на 12 процентов — горит один сегмент из восьми. Печать запускается с телефона, принтер рядом не нужен."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-pp1a-finger { animation: v-pp1a-press 8s linear infinite; }
          .v-pp1a-r1 { animation: v-pp1a-ripple 8s linear infinite; }
          .v-pp1a-r2 { animation: v-pp1a-ripple 8s linear -0.45s infinite; }
          .v-pp1a-arc1 { animation: v-pp1a-arc 8s linear infinite; }
          .v-pp1a-arc2 { animation: v-pp1a-arc 8s linear -0.5s infinite; }
          .v-pp1a-head { animation: v-pp1a-head 8s linear infinite; }
          .v-pp1a-l2 { animation: v-pp1a-l2 8s linear infinite; }
          .v-pp1a-l3 { animation: v-pp1a-l3 8s linear infinite; }
          .v-pp1a-s1 { animation: v-pp1a-s1 8s linear infinite; }
          .v-pp1a-val { animation: v-pp1a-val 8s linear infinite; }
          @keyframes v-pp1a-press {
            0%, 6% { transform: translateY(14px); }
            10%, 26% { transform: translateY(0); }
            34%, 100% { transform: translateY(14px); }
          }
          @keyframes v-pp1a-ripple {
            0%, 8% { r: 8; opacity: 0.85; }
            22% { r: 19; opacity: 0; }
            100% { r: 19; opacity: 0; }
          }
          @keyframes v-pp1a-arc {
            0%, 18% { opacity: 0.15; }
            28%, 88% { opacity: 1; }
            100% { opacity: 0.15; }
          }
          @keyframes v-pp1a-head {
            0%, 30% { transform: translateX(0); }
            58% { transform: translateX(68px); }
            86%, 100% { transform: translateX(0); }
          }
          @keyframes v-pp1a-l2 {
            0%, 46% { opacity: 0.15; }
            54%, 100% { opacity: 1; }
          }
          @keyframes v-pp1a-l3 {
            0%, 64% { opacity: 0.15; }
            72%, 100% { opacity: 1; }
          }
          @keyframes v-pp1a-s1 {
            0%, 30% { opacity: 0.2; }
            38%, 100% { opacity: 1; }
          }
          @keyframes v-pp1a-val {
            0%, 40% { transform: translateX(0); }
            48%, 92% { transform: translateX(-26px); }
            100% { transform: translateX(-26px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pp1a-finger { animation: none; transform: translateY(14px); }
            .v-pp1a-r1, .v-pp1a-r2 { animation: none; r: 19; opacity: 0; }
            .v-pp1a-arc1, .v-pp1a-arc2 { animation: none; opacity: 1; }
            .v-pp1a-head { animation: none; transform: translateX(68px); }
            .v-pp1a-l2, .v-pp1a-l3 { animation: none; opacity: 1; }
            .v-pp1a-s1 { animation: none; opacity: 1; }
            .v-pp1a-val { animation: none; transform: translateX(-26px); }
          }
        `}</style>

        {/* Окно счётчика прогресса: числа едут под неподвижным окном */}
        <defs>
          <clipPath id="v-pp1a-window">
            <rect x="26" y="112" width="26" height="12" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          печать запускается с телефона
        </text>

        {/* Телефон — герой кадра: корпус, экран с OctoPrint и кнопка запуска */}
        <rect x="14" y="26" width="104" height="134" rx="12" fill="#1e293b" stroke="#94a3b8" />
        <rect x="56" y="29" width="20" height="3" rx="1.5" fill="#475569" />
        <rect x="20" y="36" width="92" height="116" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="26" y="48" fontSize="8.5" fontWeight="bold" fill="#38bdf8">
          OctoPrint
        </text>
        <circle cx="104" cy="45" r="2.4" fill="#34d399" />

        {/* Экран телефона: маленькая камера с деталью — видно, что печать идёт */}
        <rect x="26" y="54" width="80" height="40" rx="3" fill="#0b1220" stroke="#334155" />
        <rect x="32" y="84" width="68" height="3" fill="#334155" />
        <path d="M 60,84 C 58,77 59,71 62,67 L 72,67 C 75,71 76,77 74,84 Z" fill="#6ee7b7" fillOpacity="0.9" />
        <polygon points="66,61 70,61 68,65" fill="#fbbf24" />
        <text x="30" y="66" fontSize="7.5" fill="#64748b">
          камера
        </text>

        {/* Прогресс: восемь сегментов, к концу цикла горит только первый */}
        {PROGRESS_X.map((x, index) => (
          <rect
            key={x}
            x={x}
            y="100"
            width="8"
            height="7"
            rx="2"
            fill="#334155"
            className={index === 0 ? "v-pp1a-s1" : undefined}
          />
        ))}

        {/* Счётчик прогресса: 0 % уезжает, 12 % встаёт под окно */}
        <rect x="26" y="112" width="26" height="12" rx="2" fill="#0b1220" stroke="#334155" />
        <g clipPath="url(#v-pp1a-window)">
          <g className="v-pp1a-val">
            <text x="39" y="121" fontSize="8" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
              0 %
            </text>
            <text x="65" y="121" fontSize="8" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
              12 %
            </text>
          </g>
        </g>

        {/* Кнопка «Печать», кружок нажатия и палец справа от надписи */}
        <rect x="32" y="128" width="68" height="16" rx="4" fill="#14532d" stroke="#34d399" />
        <text x="60" y="139.5" fontSize="9.5" fontWeight="bold" fill="#e2e8f0" textAnchor="middle">
          Печать
        </text>
        <circle cx="93" cy="138" r="8" fill="none" stroke="#6ee7b7" strokeWidth="1.5" className="v-pp1a-r1" />
        <circle cx="93" cy="138" r="8" fill="none" stroke="#6ee7b7" strokeWidth="1.5" className="v-pp1a-r2" />
        <g className="v-pp1a-finger">
          <rect x="88" y="132" width="10" height="22" rx="5" fill="#cbd5e1" fillOpacity="0.9" />
          <ellipse cx="93" cy="137" rx="3" ry="4" fill="#94a3b8" fillOpacity="0.6" />
        </g>

        {/* Принтер: антенна с дугами связи, портал, голова и растущие слои */}
        <rect x="196" y="44" width="112" height="100" rx="6" fill="#1e293b" fillOpacity="0.35" stroke="#475569" />
        <text x="204" y="58" fontSize="8.5" fontWeight="bold" fill="#e2e8f0">
          принтер
        </text>
        <line x1="292" y1="44" x2="292" y2="30" stroke="#94a3b8" />
        <circle cx="292" cy="29" r="2" fill="#94a3b8" />
        <path d="M 286,26 q 6,-8 12,0" fill="none" stroke="#6ee7b7" strokeWidth="1.2" className="v-pp1a-arc1" />
        <path d="M 281,27 q 11,-13 22,0" fill="none" stroke="#6ee7b7" strokeWidth="1.2" className="v-pp1a-arc2" />
        <text x="252" y="40" fontSize="7.5" fill="#6ee7b7">
          связь
        </text>
        <rect x="206" y="84" width="92" height="3" fill="#475569" />
        <g className="v-pp1a-head">
          <rect x="206" y="84" width="16" height="8" rx="1" fill="#334155" stroke="#94a3b8" />
          <polygon points="210,92 218,92 214,98" fill="#fbbf24" />
        </g>
        <line x1="214" y1="98" x2="214" y2="122" stroke="#6ee7b7" strokeDasharray="2 1.5" />
        <rect x="206" y="128" width="92" height="4" rx="1" fill="#334155" />
        {LAYER_TOPS.map((top, index) => (
          <rect
            key={top}
            x="200"
            y={top}
            width="40"
            height="2"
            fill="#6ee7b7"
            className={index === 0 ? undefined : `v-pp1a-l${index + 1}`}
          />
        ))}

        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          телефон → OctoPrint → принтер: печать идёт без тебя дома
        </text>
      </svg>
    </VisualWrapper>
  );
}
