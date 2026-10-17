import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const GROUPS = [
  {
    title: "движение",
    accent: "#38bdf8",
    lines: ["G0 · G1 · G2/G3", "G28 — парковка"],
  },
  {
    title: "координаты и режим",
    accent: "#a78bfa",
    lines: ["G90 · G91 · G54–G59", "G92 · G92 E0"],
  },
  {
    title: "нагрев",
    accent: "#fbbf24",
    lines: ["M104 · M109", "M140 · M190 · G4"],
  },
  {
    title: "диагностика",
    accent: "#34d399",
    lines: ["M114 · M119 · M122", "M400 · M84"],
  },
];

/**
 * Кадр блока 4 урока IN9 «G-код: чтение и написание».
 *
 * Макет из описания `IN9_code_map.png`: четыре группы команд из блока 4 —
 * движение, координаты и режим, нагрев, диагностика. Состав групп — блок 5,
 * правило «двадцати команд хватает» — блок 1.
 */
export function EngineerIN9Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта команд из четырёх групп: движение — G0, G1, G2 и G3, G28; координаты и режим — G90, G91, G54–G59, G92 и G92 E0; нагрев — M104, M109, M140, M190 и G4; диагностика — M114, M119, M122, M400 и M84. В работе хватает двадцати команд, остальные ищутся в справочнике по случаю"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          карта команд: четыре группы
        </text>

        {GROUPS.map((group, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 12 + col * 152;
          const y = 24 + row * 58;
          return (
            <g key={group.title}>
              <rect x={x} y={y} width="144" height="52" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
              <rect x={x} y={y} width="144" height="2.5" rx="1.2" fill={group.accent} fillOpacity="0.85" />
              <text x={x + 8} y={y + 15} fontSize="10" fontWeight="700" fill={group.accent}>
                {group.title}
              </text>
              <text x={x + 8} y={y + 31} fontSize="10" fill="#e2e8f0">
                {group.lines[0]}
              </text>
              <text x={x + 8} y={y + 45} fontSize="10" fill="#cbd5e1">
                {group.lines[1]}
              </text>
            </g>
          );
        })}

        <rect x="12" y="139" width="296" height="35" rx="6" fill="#38bdf8" fillOpacity="0.1" stroke="#38bdf8" strokeOpacity="0.35" />
        <text x="22" y="153" fontSize="10" fill="#e2e8f0">
          в работе хватает двадцати команд
        </text>
        <text x="22" y="169" fontSize="10" fill="#94a3b8">
          остальные — в справочнике по случаю
        </text>
      </svg>
    </VisualWrapper>
  );
}
