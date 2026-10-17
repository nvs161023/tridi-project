import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOOLS = ["развёртка", "+0,05 мм", "надфиль", "шкурка", "400 → 800"];

const GAUGE = ["штифт · винт", "скользящая", "+0,1…+0,2", "натяг −0,1", "болтается — брак"];

/**
 * Кадр блока 30 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_fit_finish.png`: размер до и после доводки и чем
 * проверять посадку. Числа — блок 29: отверстие меньше номинала на 0,2–0,3 мм,
 * развёртка на 0,05 мм больше номинала, скользящая посадка +0,1…+0,2, натяг −0,1,
 * шкурка 400, затем 800, проверка штифтом или винтом.
 */
export function EngineerIN10Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Допуск и калибр после доводки. До доводки отверстие меньше номинала на 0,2–0,3 миллиметра. Инструмент по порядку: развёртка на 0,05 миллиметра больше номинала, надфиль, шкурка 400, затем 800. Посадку проверяют штифтом или винтом: скользящая даёт плюс 0,1–0,2, натяг минус 0,1. Если деталь болтается, нужна новая печать с другим допуском"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          допуск и калибр после доводки
        </text>

        <rect x="12" y="24" width="104" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#38bdf8">
          до доводки
        </text>
        <rect x="22" y="46" width="84" height="54" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="50" y="46" width="28" height="54" fill="#0f172a" stroke="#38bdf8" />
        <text x="22" y="113" fontSize="10" fill="#fbbf24">
          −0,2…−0,3 мм
        </text>

        <rect x="120" y="24" width="88" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="128" y="38" fontSize="10" fontWeight="700" fill="#a78bfa">
          инструмент
        </text>
        {TOOLS.map((tool, i) => (
          <text key={tool} x="128" y={56 + i * 14} fontSize="10" fill={i === 1 ? "#34d399" : "#e2e8f0"}>
            {tool}
          </text>
        ))}

        <rect x="212" y="24" width="96" height="96" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="222" y="38" fontSize="10" fontWeight="700" fill="#34d399">
          калибр
        </text>
        {GAUGE.map((line, i) => (
          <text key={line} x="222" y={54 + i * 14} fontSize="10" fill={i === 2 ? "#34d399" : i === 4 ? "#fbbf24" : "#e2e8f0"}>
            {line}
          </text>
        ))}

        <rect x="12" y="124" width="296" height="48" rx="6" fill="#38bdf8" fillOpacity="0.08" stroke="#38bdf8" strokeOpacity="0.3" />
        <text x="22" y="141" fontSize="10" fill="#e2e8f0">
          сначала развёртка, потом надфиль, потом шкурка
        </text>
        <text x="22" y="160" fontSize="10" fill="#94a3b8">
          посадка по калибру: штифт или винт
        </text>
      </svg>
    </VisualWrapper>
  );
}
