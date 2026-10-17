import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_shaft.png`: вал длиной 200 мм на трёх опорах,
 * сила 200 Н и момент 40 Н·м, лыска под крепёж. Справа — запас не меньше 2,5,
 * 6 периметров, 80 % кубического заполнения и посадка +0,1 мм.
 */
export function EngineerIN5Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Вал длиной 200 миллиметров на трёх опорах. Сверху сила 200 ньютонов, справа момент 40 ньютон-метров, на валу лыска. Третья опора зелёная. Справа запас не меньше 2,5, 6 периметров, 80 процентов кубического заполнения и посадка плюс 0,1 миллиметра"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in5-2-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <marker
            id="in5-2-moment"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          вал: длина, сила и крутящий момент
        </text>

        <rect x="12" y="23" width="188" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />

        {/* Длина */}
        <line x1="28" y1="45" x2="190" y2="45" stroke="#64748b" strokeWidth="0.8" />
        <line x1="28" y1="41" x2="28" y2="49" stroke="#64748b" strokeWidth="0.8" />
        <line x1="190" y1="41" x2="190" y2="49" stroke="#64748b" strokeWidth="0.8" />
        <text x="109" y="40" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          200 мм
        </text>

        {/* Вал и слои */}
        <rect x="28" y="86" width="162" height="12" rx="3" fill="#475569" stroke="#94a3b8" />
        <line x1="31" y1="90" x2="187" y2="90" stroke="#fbbf24" strokeWidth="0.7" strokeOpacity="0.5" />
        <line x1="31" y1="94" x2="187" y2="94" stroke="#fbbf24" strokeWidth="0.7" strokeOpacity="0.5" />

        {/* Шкив и сила */}
        <circle cx="90" cy="92" r="16" fill="#334155" stroke="#94a3b8" />
        <circle cx="90" cy="92" r="5" fill="#0f172a" stroke="#64748b" />
        <line x1="90" y1="64" x2="90" y2="74" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#in5-2-arrow)" />
        <text x="96" y="61" fontSize="10" fontWeight="700" fill="#fbbf24">
          200 Н
        </text>

        {/* Лыска */}
        <rect x="132" y="85" width="24" height="4" fill="#0f172a" />
        <line x1="132" y1="89" x2="156" y2="89" stroke="#e2e8f0" strokeWidth="1.2" />
        <text x="126" y="76" fontSize="10" fill="#cbd5e1">
          лыска
        </text>
        <line x1="134" y1="79" x2="142" y2="86" stroke="#94a3b8" strokeWidth="0.7" />

        {/* Момент */}
        <path d="M163 82 A14 12 0 1 1 191 82" fill="none" stroke="#38bdf8" strokeWidth="1.2" markerEnd="url(#in5-2-moment)" />
        <text x="162" y="61" fontSize="10" fontWeight="700" fill="#7dd3fc">
          40 Н·м
        </text>
        <line x1="177" y1="65" x2="177" y2="70" stroke="#38bdf8" strokeWidth="0.7" strokeOpacity="0.7" />

        {/* Опорами */}
        {[50, 120].map((x) => (
          <g key={`in5-2-support-${x}`}>
            <polygon points={`${x - 8},100 ${x + 8},100 ${x},112`} fill="#334155" stroke="#94a3b8" />
            <line x1={x - 11} y1="112" x2={x + 11} y2="112" stroke="#94a3b8" />
          </g>
        ))}
        <polygon points="162,100 178,100 170,112" fill="#065f46" stroke="#34d399" />
        <line x1="159" y1="112" x2="181" y2="112" stroke="#34d399" />
        <text x="145" y="132" fontSize="10" fontWeight="700" fill="#6ee7b7">
          3-я опора
        </text>
        <line x1="169" y1="120" x2="170" y2="112" stroke="#34d399" strokeWidth="0.8" />

        {/* Расчёт и печать */}
        <rect x="208" y="23" width="100" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          прочность и печать
        </text>
        <text x="218" y="57" fontSize="10" fontWeight="700" fill="#6ee7b7">
          запас ≥ 2,5
        </text>
        <text x="218" y="76" fontSize="10" fill="#cbd5e1">
          6 периметров
        </text>
        <text x="218" y="95" fontSize="10" fill="#cbd5e1">
          80 % куб
        </text>
        <text x="218" y="114" fontSize="10" fill="#7dd3fc">
          посадка +0,1
        </text>
        <text x="218" y="133" fontSize="10" fill="#cbd5e1">
          3 опоры
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          третья опора убирает изгиб · посадка +0,1
        </text>
      </svg>
    </VisualWrapper>
  );
}
