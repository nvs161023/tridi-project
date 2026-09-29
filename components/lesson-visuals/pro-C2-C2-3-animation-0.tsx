import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Рёбра радиатора хотэнда. */
const FINS = [38, 43, 48];

/** Риски резьбы в гнезде, куда вкручивается сопло. */
const THREAD = [142, 152, 162, 172];

/**
 * Замена сопла: одна сцена, где ключ выкручивает сопло по резьбе ступенями, на
 * горячую, потом вкручивает новое и в конце выдавливается 100 мм пластика.
 *
 * От кадров-раскадровок («3 операции», «1→10», ряды плиток) отличается тем, что
 * операция показана движением одного и того же узла: сопло съезжает по резьбе на
 * три шага вниз и возвращается, а не перескакивает с плитки на плитку.
 */
export function ProC2C23Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Замена сопла на горячую: хотэнд с меткой 240 °C, ключ 6–7 мм охватывает шестигранник сопла и за три оборота выкручивает его по резьбе вниз, тёмное сопло сменяется латунным, новое вкручивается на место, и в конце из сопла выдавливается 100 мм пластика."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
.v-c2c-drop { animation: v-c2c-drop 7.2s ease-in-out infinite; }
@keyframes v-c2c-drop {
  0%, 6% { transform: translateY(0) rotate(0deg); }
  18% { transform: translateY(8px) rotate(-12deg); }
  30% { transform: translateY(16px) rotate(-24deg); }
  42%, 52% { transform: translateY(24px) rotate(-36deg); }
  64% { transform: translateY(16px) rotate(-24deg); }
  76% { transform: translateY(8px) rotate(-12deg); }
  88%, 100% { transform: translateY(0) rotate(0deg); }
}
.v-c2c-color { animation: v-c2c-color 7.2s linear infinite; }
@keyframes v-c2c-color {
  0%, 44% { fill: #78716c; }
  50%, 96% { fill: #fbbf24; }
  100% { fill: #78716c; }
}
.v-c2c-heat { animation: v-c2c-heat 2.4s ease-in-out infinite; }
@keyframes v-c2c-heat {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
.v-c2c-strand { animation: v-c2c-strand 7.2s ease-out infinite; }
@keyframes v-c2c-strand {
  0%, 86% { transform: scaleY(0); opacity: 0; }
  96%, 100% { transform: scaleY(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .v-c2c-drop { animation: none; transform: translateY(0) rotate(0deg); }
  .v-c2c-color { animation: none; fill: #fbbf24; }
  .v-c2c-heat { animation: none; opacity: 1; }
  .v-c2c-strand { animation: none; transform: scaleY(1); opacity: 1; }
}
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Замена сопла: на горячую
        </text>
        <text x="14" y="46" fontSize="8" fill="#94a3b8">
          хотэнд
        </text>

        {/* Хотэнд: корпус с рёбрами и метка рабочей температуры */}
        <rect x="118" y="30" width="84" height="58" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="1.3" />
        {FINS.map((y) => (
          <line key={`fin-${y}`} x1="124" y1={y} x2="196" y2={y} stroke="#64748b" strokeWidth="1.1" />
        ))}
        <text x="160" y="68" fontSize="11" fill="#f87171" textAnchor="middle" className="v-c2c-heat">
          240 °C
        </text>

        {/* Гнездо с резьбой, в которое вкручено сопло */}
        <rect x="136" y="88" width="48" height="14" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
        {THREAD.map((x) => (
          <line key={`thread-${x}`} x1={x} y1="91" x2={x} y2="99" stroke="#64748b" strokeWidth="1" />
        ))}
        {/* Сопло с ключом: одна группа съезжает по резьбе и поворачивается */}
        <g className="v-c2c-drop" style={{ transformOrigin: "160px 112px" }}>
          <g className="v-c2c-color" fill="#78716c">
            <polygon
              points="171,112 165.5,102.5 154.5,102.5 149,112 154.5,121.5 165.5,121.5"
              stroke="#94a3b8"
              strokeWidth="1.2"
            />
            <polygon points="154.5,121.5 165.5,121.5 162,132 158,132" stroke="#94a3b8" strokeWidth="1.2" />
          </g>
          {/* Ключ 6–7 мм: губки охватывают шестигранник, рукоятка уходит вправо */}
          <rect x="168" y="99" width="16" height="7" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
          <rect x="168" y="118" width="16" height="7" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
          <rect x="184" y="107" width="58" height="9" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        </g>

        <text x="212" y="50" fontSize="8" fill="#94a3b8">
          ключом за 2–3 оборота
        </text>
        <text x="212" y="68" fontSize="8" fill="#94a3b8">
          сопло вышло по резьбе
        </text>
        <text x="212" y="86" fontSize="8" fill="#94a3b8">
          новое вкручено
        </text>

        {/* Проверка после замены: 100 мм пластика из нового сопла */}
        <line
          x1="160"
          y1="132"
          x2="160"
          y2="176"
          stroke="#f59e0b"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="v-c2c-strand"
          style={{ transformOrigin: "160px 132px" }}
        />
        <line x1="192" y1="132" x2="192" y2="176" stroke="#64748b" strokeWidth="1" />
        <line x1="188" y1="132" x2="196" y2="132" stroke="#64748b" strokeWidth="1" />
        <line x1="188" y1="176" x2="196" y2="176" stroke="#64748b" strokeWidth="1" />
        <text x="202" y="158" fontSize="8" fill="#e2e8f0">
          100 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
