import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре плитки-ступени и задержки подсветки: по 1,6 с в цикле 8 с. */
const STAGES = [
  { x: 12, label: "дефект", sub: "спагетти", delay: "0s" },
  { x: 88, label: "камера", sub: "следит за печатью", delay: "-1.6s" },
  { x: 164, label: "AI", sub: "определяет дефект", delay: "-3.2s" },
  { x: 240, label: "уведомление", sub: "и остановка", delay: "-4.8s" },
];

/**
 * «AI в действии» — четыре ступени в один ряд: принтер печатает и у комка
 * пластика появляется дефект, камера смотрит на стол, модуль AI находит дефект,
 * на телефон приходит уведомление и печать останавливается. Ступени
 * подсвечиваются по очереди, стрелки между ними загораются вслед за светом.
 *
 * Ровно по content урока: «Дефект → камера → AI → уведомление + остановка. Ты
 * спасаешь пластик и время» — это четыре ступени кадра и нижняя подпись. Слова
 * «следит за печатью» — из блока урока («AI следит за печатью через камеру»),
 * «но AI не идеален — проверяй уведомления» — из врезки warning урока. Чисел в
 * кадре нет: в уроке P4 нет ни процентов, ни секунд.
 *
 * От P1-animation (телефон управляет печатью) отличается тем, что там сюжет —
 * нажатие кнопки и растущая деталь, а здесь цепочку ступеней и остановку по
 * дефекту; от P2-animation (окно просчёта) — тем, что там движения головы и
 * бегущие огоньки, а здесь подсветка ступеней и появление дефекта. От C-пож1
 * animation (цепочка предметов без рамок и телефон в конце) — тем, что там
 * причина пожара и обесточивание, здесь камера с AI, а ступени стоят в рамках.
 *
 * Классы с префиксом v-pp4a: <style> внутри SVG действует на всю страницу.
 */
export function ProPP4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация работы AI-мониторинга: четыре ступени подсвечиваются по очереди — на столе у принтера появляется комок запутавшегося пластика, камера следит за печатью, модуль AI определяет дефект, на телефон приходит уведомление и печать останавливается красным значком стоп; стрелки между ступенями загораются по ходу. Внизу подписи: ты спасаешь пластик и время, но AI не идеален — проверяй уведомления."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-pp4a-hi { animation: v-pp4a-hi 8s linear infinite; }
          .v-pp4a-spag { animation: v-pp4a-spag 8s linear infinite; }
          .v-pp4a-head { animation: v-pp4a-head 8s linear infinite; }
          .v-pp4a-beam { animation: v-pp4a-beam 8s linear infinite; }
          .v-pp4a-ai { animation: v-pp4a-ai 8s ease-in-out infinite; }
          .v-pp4a-bubble { opacity: 0.3; animation: v-pp4a-bubble 8s linear infinite; }
          .v-pp4a-stop { opacity: 0.3; animation: v-pp4a-stop 8s linear infinite; }
          .v-pp4a-a1 { animation: v-pp4a-a1 8s linear infinite; }
          .v-pp4a-a2 { animation: v-pp4a-a2 8s linear infinite; }
          .v-pp4a-a3 { animation: v-pp4a-a3 8s linear infinite; }
          @keyframes v-pp4a-hi {
            0%, 2% { stroke: #334155; stroke-width: 1; }
            6%, 20% { stroke: #38bdf8; stroke-width: 1.4; }
            26%, 100% { stroke: #334155; stroke-width: 1; }
          }
          @keyframes v-pp4a-spag {
            0%, 4% { opacity: 0; }
            10%, 72% { opacity: 1; }
            82%, 100% { opacity: 0; }
          }
          @keyframes v-pp4a-head {
            0% { transform: translateX(0); }
            8%, 94% { transform: translateX(20px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-pp4a-beam {
            0%, 22% { opacity: 0; }
            30%, 50% { opacity: 1; }
            58%, 100% { opacity: 0; }
          }
          @keyframes v-pp4a-ai {
            0%, 38% { opacity: 0.45; }
            46%, 72% { opacity: 1; }
            80%, 100% { opacity: 0.45; }
          }
          @keyframes v-pp4a-bubble {
            0%, 58% { opacity: 0.3; }
            68%, 92% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @keyframes v-pp4a-stop {
            0%, 62% { opacity: 0.3; }
            72%, 92% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @keyframes v-pp4a-a1 {
            0%, 6% { opacity: 0; }
            12%, 100% { opacity: 1; }
          }
          @keyframes v-pp4a-a2 {
            0%, 24% { opacity: 0; }
            30%, 100% { opacity: 1; }
          }
          @keyframes v-pp4a-a3 {
            0%, 60% { opacity: 0; }
            68%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pp4a-hi { animation: none; stroke: #38bdf8; stroke-width: 1.4; }
            .v-pp4a-spag { animation: none; opacity: 1; }
            .v-pp4a-head { animation: none; transform: translateX(20px); }
            .v-pp4a-beam { animation: none; opacity: 1; }
            .v-pp4a-ai { animation: none; opacity: 1; }
            .v-pp4a-bubble { animation: none; opacity: 1; }
            .v-pp4a-stop { animation: none; opacity: 1; }
            .v-pp4a-a1, .v-pp4a-a2, .v-pp4a-a3 { animation: none; opacity: 1; }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          AI в действии: дефект → камера → AI → стоп
        </text>

        {/* Ступень 1: принтер печатает, у детали появляется комок пластика */}
        <rect x="12" y="30" width="64" height="70" rx="5" fill="#0f172a" stroke="#334155" className="v-pp4a-hi" />
        <line x1="20" y1="48" x2="68" y2="48" stroke="#475569" />
        <rect x="20" y="86" width="48" height="4" rx="1" fill="#334155" />
        <path d="M 40,86 C 37,77 39,70 42,64 L 54,64 C 57,70 59,77 56,86 Z" fill="#6ee7b7" fillOpacity="0.85" />
        <path d="M 44,62 C 50,54 58,64 64,56 C 68,50 72,58 74,54" fill="none" stroke="#f87171" strokeWidth="1.5" className="v-pp4a-spag" />
        <g className="v-pp4a-head">
          <rect x="26" y="46" width="14" height="7" rx="1" fill="#334155" stroke="#94a3b8" />
          <polygon points="30,53 36,53 33,59" fill="#fbbf24" />
        </g>

        {/* Ступень 2: камера смотрит на стол — луч сканирует область печати */}
        <rect x="88" y="30" width="64" height="70" rx="5" fill="#0f172a" stroke="#334155" className="v-pp4a-hi" style={{ animationDelay: STAGES[1].delay }} />
        <polygon points="44,58 60,88 30,88" fill="#38bdf8" fillOpacity="0.25" className="v-pp4a-beam" transform="translate(88,0)" />
        <rect x="122" y="42" width="28" height="20" rx="3" fill="#334155" stroke="#94a3b8" />
        <circle cx="136" cy="52" r="5.5" fill="#0b1220" stroke="#64748b" />
        <line x1="136" y1="62" x2="136" y2="74" stroke="#94a3b8" />
        <rect x="128" y="74" width="16" height="4" rx="1" fill="#334155" />

        {/* Ступень 3: модуль AI — три узла, дефект найден */}
        <rect x="164" y="30" width="64" height="70" rx="5" fill="#0f172a" stroke="#334155" className="v-pp4a-hi" style={{ animationDelay: STAGES[2].delay }} />
        <rect x="174" y="44" width="44" height="34" rx="4" fill="#1e293b" stroke="#38bdf8" className="v-pp4a-ai" />
        <line x1="186" y1="54" x2="205" y2="61" stroke="#475569" />
        <line x1="186" y1="68" x2="205" y2="62" stroke="#475569" />
        <circle cx="184" cy="54" r="2.5" fill="#38bdf8" />
        <circle cx="184" cy="68" r="2.5" fill="#38bdf8" />
        <circle cx="208" cy="61" r="3" fill="#6ee7b7" />

        {/* Ступень 4: уведомление на телефон и остановка печати */}
        <rect x="240" y="30" width="64" height="70" rx="5" fill="#0f172a" stroke="#334155" className="v-pp4a-hi" style={{ animationDelay: STAGES[3].delay }} />
        <rect x="258" y="42" width="28" height="46" rx="4" fill="#334155" stroke="#94a3b8" />
        <rect x="261" y="46" width="22" height="38" fill="#0b1220" />
        <rect x="264" y="52" width="16" height="12" rx="2" fill="#14532d" stroke="#34d399" className="v-pp4a-bubble" />
        <path d="M 267,58 l 3,3 l 5,-6" fill="none" stroke="#6ee7b7" strokeWidth="1.2" className="v-pp4a-bubble" />
        <g className="v-pp4a-stop">
          <circle cx="286" cy="84" r="6" fill="#7f1d1d" stroke="#f87171" />
          <rect x="283" y="82" width="6" height="4" fill="#fca5a5" />
        </g>

        {STAGES.map((stage) => (
          <g key={stage.label}>
            <text x={stage.x + 32} y="111" fontSize="7.5" fill="#e2e8f0" textAnchor="middle">
              {stage.label}
            </text>
            <text x={stage.x + 32} y="124" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
              {stage.sub}
            </text>
          </g>
        ))}

        {/* Стрелки между ступенями загораются по ходу цепочки */}
        <line x1="78" y1="65" x2="84" y2="65" stroke="#e2e8f0" strokeWidth="1.6" className="v-pp4a-a1" />
        <polygon points="84,62 88,65 84,68" fill="#e2e8f0" className="v-pp4a-a1" />
        <line x1="154" y1="65" x2="160" y2="65" stroke="#e2e8f0" strokeWidth="1.6" className="v-pp4a-a2" />
        <polygon points="160,62 164,65 160,68" fill="#e2e8f0" className="v-pp4a-a2" />
        <line x1="230" y1="65" x2="236" y2="65" stroke="#e2e8f0" strokeWidth="1.6" className="v-pp4a-a3" />
        <polygon points="236,62 240,65 236,68" fill="#e2e8f0" className="v-pp4a-a3" />

        <text x="12" y="146" fontSize="7.5" fill="#94a3b8">
          ты спасаешь пластик и время
        </text>
        <text x="12" y="163" fontSize="7.5" fill="#94a3b8">
          но AI не идеален — проверяй уведомления
        </text>
      </svg>
    </VisualWrapper>
  );
}
