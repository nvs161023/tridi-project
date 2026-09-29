import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * «Срабатывание датчика» — цепочка предметов «причина → следствие» без единой
 * рамки и плашки: дым над принтером, датчик, обесточенная умная розетка и
 * уведомление на телефоне. Стрелки прорисовываются по одной (stroke-dashoffset),
 * состояния меняются строго по фазам, цикл — 7 секунд.
 *
 * От A-без2-image (две статичные дорожки из рамок со стрелками) отличается
 * отсутствием рамок: здесь предметы и время. От C2-1 и C2-2 (бегущий импульс по
 * кольцу и по проводу, крестик на обрыве) — тем, что импульса нет вовсе: узлы
 * включаются по очереди. Часов, шкалы времени и дуги (A-A1, H-H2, L-L1) в кадре
 * тоже нет. Огонь не рисуем: урок про раннее предупреждение, а не про пожар.
 */
export function ProCPozhCPozh1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цепочка срабатывания без участия человека: над принтером поднимается дым, датчик дыма срабатывает, умная розетка обесточивает принтер — линия питания тускнеет и становится пунктирной, дисплей принтера гаснет, а на телефон приходит уведомление. Стрелки между предметами появляются по одной, фазы идут друг за другом."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-cpzh1a-smoke { animation: v-cpzh1a-smoke 7s ease-in-out infinite; }
          .v-cpzh1a-a1 { animation: v-cpzh1a-a1 7s linear infinite; }
          .v-cpzh1a-a2 { animation: v-cpzh1a-a2 7s linear infinite; }
          .v-cpzh1a-a3 { animation: v-cpzh1a-a3 7s linear infinite; }
          .v-cpzh1a-detect { animation: v-cpzh1a-detect 7s ease-in-out infinite; }
          .v-cpzh1a-core { animation: v-cpzh1a-core 7s ease-in-out infinite; }
          .v-cpzh1a-relay { animation: v-cpzh1a-relay 7s linear infinite; }
          .v-cpzh1a-power { animation: v-cpzh1a-power 7s linear infinite; }
          .v-cpzh1a-display { animation: v-cpzh1a-display 7s linear infinite; }
          .v-cpzh1a-off { opacity: 0; animation: v-cpzh1a-off 7s linear infinite; }
          .v-cpzh1a-notify { opacity: 0; animation: v-cpzh1a-notify 7s ease-out infinite; }
          @keyframes v-cpzh1a-smoke {
            0%, 10% { opacity: 0; }
            18%, 92% { opacity: 1; }
            96%, 100% { opacity: 0; }
          }
          @keyframes v-cpzh1a-a1 {
            0%, 20% { stroke-dashoffset: 30; }
            32%, 92% { stroke-dashoffset: 0; }
            96%, 100% { stroke-dashoffset: 30; }
          }
          @keyframes v-cpzh1a-a2 {
            0%, 40% { stroke-dashoffset: 24; }
            50%, 92% { stroke-dashoffset: 0; }
            96%, 100% { stroke-dashoffset: 24; }
          }
          @keyframes v-cpzh1a-a3 {
            0%, 60% { stroke-dashoffset: 22; }
            70%, 92% { stroke-dashoffset: 0; }
            96%, 100% { stroke-dashoffset: 22; }
          }
          @keyframes v-cpzh1a-detect {
            0%, 30% { stroke: #fbbf24; }
            34%, 46% { stroke: #fecaca; }
            52%, 100% { stroke: #fbbf24; }
          }
          @keyframes v-cpzh1a-core {
            0%, 30% { fill: #fbbf24; opacity: 0.6; }
            34%, 50% { fill: #f87171; opacity: 1; }
            56%, 100% { fill: #fbbf24; opacity: 0.6; }
          }
          @keyframes v-cpzh1a-relay {
            0%, 50% { stroke: #34d399; }
            56%, 92% { stroke: #f87171; }
            97%, 100% { stroke: #34d399; }
          }
          @keyframes v-cpzh1a-power {
            0%, 50% { stroke: #94a3b8; stroke-dasharray: 12 0; opacity: 1; }
            56%, 92% { stroke: #475569; stroke-dasharray: 3 5; opacity: 0.45; }
            97%, 100% { stroke: #94a3b8; stroke-dasharray: 12 0; opacity: 1; }
          }
          @keyframes v-cpzh1a-display {
            0%, 50% { stroke: #38bdf8; }
            56%, 92% { stroke: #334155; }
            97%, 100% { stroke: #38bdf8; }
          }
          @keyframes v-cpzh1a-off {
            0%, 50% { opacity: 0; }
            58%, 92% { opacity: 1; }
            96%, 100% { opacity: 0; }
          }
          @keyframes v-cpzh1a-notify {
            0%, 70% { opacity: 0; transform: translateY(-5px); }
            78%, 92% { opacity: 1; transform: translateY(0); }
            96%, 100% { opacity: 0; transform: translateY(-5px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-cpzh1a-smoke, .v-cpzh1a-a1, .v-cpzh1a-a2, .v-cpzh1a-a3, .v-cpzh1a-detect,
            .v-cpzh1a-core, .v-cpzh1a-relay, .v-cpzh1a-power, .v-cpzh1a-display,
            .v-cpzh1a-off, .v-cpzh1a-notify { animation: none; }
            .v-cpzh1a-smoke, .v-cpzh1a-off, .v-cpzh1a-notify { opacity: 1; }
            .v-cpzh1a-a1, .v-cpzh1a-a2, .v-cpzh1a-a3 { stroke-dashoffset: 0; }
            .v-cpzh1a-core { fill: #f87171; opacity: 1; }
            .v-cpzh1a-relay { stroke: #f87171; }
            .v-cpzh1a-power { stroke: #475569; stroke-dasharray: 3 5; opacity: 0.45; }
            .v-cpzh1a-display { stroke: #334155; }
          }
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Срабатывание датчика: дым, сигнал, отключение
        </text>

        {/* Принтер: источник дыма и единственная нагрузка в цепочке */}
        <rect x="18" y="78" width="52" height="12" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.1" />
        <rect x="14" y="90" width="60" height="28" rx="3" fill="#334155" stroke="#60a5fa" strokeWidth="1.2" />
        <rect x="20" y="94" width="48" height="6" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
        <rect x="20" y="104" width="20" height="10" rx="1.5" fill="#0f172a" stroke="#38bdf8" className="v-cpzh1a-display" />
        <text x="30" y="111.5" fontSize="7" fill="#f87171" textAnchor="middle" className="v-cpzh1a-off">
          выкл
        </text>
        <text x="44" y="132" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          принтер
        </text>
        <text x="44" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          200–300 °C
        </text>

        {/* Дым поднимается от принтера к датчику */}
        <g className="v-cpzh1a-smoke" fill="#cbd5e1" fillOpacity="0.75">
          <circle cx="46" cy="71" r="3.4" />
          <circle cx="62" cy="65" r="4" />
          <circle cx="78" cy="60" r="3.6" />
          <circle cx="94" cy="56" r="3" />
          <circle cx="110" cy="53" r="2.5" />
        </g>

        {/* Датчик дыма с пунктирной зоной обнаружения */}
        <circle
          cx="139"
          cy="58"
          r="21"
          fill="#fbbf24"
          fillOpacity="0.06"
          stroke="#fbbf24"
          strokeOpacity="0.35"
          strokeWidth="0.9"
          strokeDasharray="3 4"
        />
        <rect x="122" y="40" width="34" height="9" rx="2" fill="#334155" stroke="#fbbf24" strokeWidth="1.1" />
        <circle cx="139" cy="58" r="10" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.4" className="v-cpzh1a-detect" />
        <circle cx="139" cy="58" r="3" fill="#fbbf24" fillOpacity="0.6" className="v-cpzh1a-core" />
        <text x="139" y="132" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          датчик дыма
        </text>
        <text x="139" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          срабатывает
        </text>
        {/* Умная розетка: реле-переключатель и радиоволна связи */}
        <path d="M201,38 A11,11 0 0 1 217,38" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
        <path d="M197,31 A16,16 0 0 1 221,31" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
        <rect x="192" y="46" width="34" height="30" rx="3" fill="#334155" stroke="#fbbf24" strokeWidth="1.2" />
        <circle cx="201" cy="54" r="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="217" cy="54" r="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="200" y1="66" x2="218" y2="66" stroke="#34d399" strokeWidth="1.6" className="v-cpzh1a-relay" />
        <rect x="205" y="72" width="8" height="7" rx="1" fill="#475569" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="209" y="132" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          умная розетка
        </text>
        <text x="209" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          обесточивает
        </text>

        {/* Линия питания принтера: к концу цепочки тускнеет и рвётся пунктиром */}
        <polyline
          points="209,76 209,112 74,112"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2.4"
          className="v-cpzh1a-power"
        />

        {/* Телефон: уведомление приходит на него, а не наоборот */}
        <rect x="254" y="54" width="36" height="58" rx="5" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="258" y="60" width="28" height="46" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
        <g className="v-cpzh1a-notify">
          <rect x="260" y="64" width="24" height="18" rx="2" fill="#1e293b" stroke="#fbbf24" strokeWidth="1" />
          <text x="272" y="76" fontSize="7" fill="#fbbf24" textAnchor="middle">
            тревога
          </text>
          <circle cx="293" cy="52" r="6.5" fill="#ef4444" />
          <text x="293" y="55" fontSize="7" fill="#ffffff" textAnchor="middle">
            1
          </text>
        </g>
        <text x="272" y="132" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          телефон
        </text>
        <text x="272" y="143" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
          уведомление
        </text>

        {/* Стрелки появляются по одной: путь цепочки читается слева направо */}
        <path
          d="M78,78 H109 M112,78 L105,74.5 M112,78 L105,81.5"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="30 30"
          className="v-cpzh1a-a1"
        />
        <path
          d="M166,62 H188 M191,62 L184,58.5 M191,62 L184,65.5"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="24 24"
          className="v-cpzh1a-a2"
        />
        <path
          d="M230,66 H250 M253,66 L246,62.5 M253,66 L246,69.5"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="22 22"
          className="v-cpzh1a-a3"
        />

        <text x="12" y="168" fontSize="8" fill="#94a3b8">
          причину убирает не датчик: питание отключает розетка
        </text>
      </svg>
    </VisualWrapper>
  );
}
