import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const NOTES = [
  { cmd: "G54", note: "слот смещения", accent: "#a78bfa" },
  { cmd: "G92 X0 Y0", note: "нуль на месте", accent: "#f472b6" },
  { cmd: "M114", note: "проверить нуль", accent: "#34d399" },
  { cmd: "Z 5", note: "высота подъезда", accent: "#fbbf24" },
];

/**
 * Кадр блока 8 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_work_offsets.png`: вид стола сверху. Нуль станка стоит
 * у концевиков, нуль детали — в левом переднем углу подложки, между ними
 * смещение. Слот G54 хранит поправку, G92 ставит нуль на месте, M114 проверяет
 * позицию, подъезд — не ниже Z 5 (блоки 6, 7 и 9).
 */
export function EngineerIN9Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Нуль станка и нуль детали на виде стола сверху: машинный X0 Y0 у концевиков, рабочий нуль в левом переднем углу подложки, между ними смещение нуля. Слот G54 хранит поправку, G92 X0 Y0 ставит нуль на месте, M114 проверяет позицию, подъезд не ниже Z 5"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          нуль станка и нуль детали
        </text>

        <defs>
          <marker id="in9-1-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
          <marker id="in9-1-axis" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
          <marker id="in9-1-offset" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#fbbf24" />
          </marker>
        </defs>

        {/* Стол сверху */}
        <rect x="14" y="26" width="176" height="116" rx="8" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />

        {/* Оси машинных координат от концевиков */}
        <path d="M20 44 H74" stroke="#38bdf8" strokeWidth="1.1" markerEnd="url(#in9-1-axis)" />
        <path d="M20 44 V92" stroke="#38bdf8" strokeWidth="1.1" markerEnd="url(#in9-1-axis)" />
        <text x="78" y="41" fontSize="10" fill="#38bdf8">
          X
        </text>
        <text x="16" y="101" fontSize="10" fill="#38bdf8">
          Y
        </text>

        {/* Нуль станка */}
        <circle cx="20" cy="44" r="2.6" fill="#38bdf8" />
        <text x="30" y="58" fontSize="10" fontWeight="700" fill="#38bdf8">
          нуль станка
        </text>
        <text x="30" y="74" fontSize="10" fill="#cbd5e1">
          от концевиков
        </text>

        {/* Подложка и нуль детали */}
        <rect x="34" y="78" width="140" height="44" rx="5" fill="#1e293b" fillOpacity="0.8" stroke="#475569" strokeDasharray="3 2" />
        <circle cx="34" cy="122" r="2.6" fill="#f472b6" />
        <text x="44" y="104" fontSize="10" fontWeight="700" fill="#f472b6">
          нуль детали
        </text>
        <text x="44" y="118" fontSize="10" fill="#cbd5e1">
          угол подложки
        </text>

        {/* Смещение нуля */}
        <path d="M20 44 V122 H30" fill="none" stroke="#fbbf24" strokeWidth="1.1" strokeDasharray="4 3" markerEnd="url(#in9-1-offset)" />
        <text x="110" y="90" fontSize="10" fill="#fbbf24">
          смещение нуля
        </text>

        {/* Шпаргалка справа */}
        {NOTES.map((note, i) => {
          const y = 26 + i * 31;
          return (
            <g key={note.cmd}>
              <rect x="198" y={y} width="110" height="28" rx="6" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
              <text x="206" y={y + 12} fontSize="10" fontWeight="700" fill={note.accent}>
                {note.cmd}
              </text>
              <text x="206" y={y + 26} fontSize="10" fill="#cbd5e1">
                {note.note}
              </text>
            </g>
          );
        })}

        <rect x="12" y="148" width="296" height="24" rx="6" fill="#38bdf8" fillOpacity="0.1" stroke="#38bdf8" strokeOpacity="0.35" />
        <text x="22" y="163" fontSize="10" fill="#e2e8f0">
          машинные — от концевиков, рабочие — от детали
        </text>
      </svg>
    </VisualWrapper>
  );
}
