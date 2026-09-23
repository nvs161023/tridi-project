/**
 * ProgressiveDefects — сетка 3×3 с миниатюрами дефектов и подписями.
 * Названия дефектов взяты из урока «Карта дефектов» базового курса.
 */
const DEFECTS = [
  { label: "не прилипло", d: "M8 26 q12 -14 24 -4 t24 6" },
  { label: "паутинки", d: "M8 28 C 26 10 52 10 68 28" },
  { label: "слои не склеены", d: "M8 12 h60 M8 22 h60 M8 32 h60" },
  { label: "свисает", d: "M8 14 h56 q-4 18 -14 18 t-14 -18 t-14 14" },
  { label: "волны", d: "M8 22 q10 -12 20 0 t20 0 t20 0" },
  { label: "пропуски", d: "M8 22 h12 M28 22 h10 M46 22 h14 M66 22 h6" },
  { label: "трещины", d: "M12 10 h50 M12 32 h50 M28 10 l8 11 l-6 11" },
  { label: "неровные углы", d: "M12 30 q2 -18 20 -18 q18 0 20 18" },
  { label: "первый слой тонкий", d: "M8 28 h60 M8 32 h60" },
];

export function ProgressiveDefects({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes pd-in{0%{opacity:0;transform:scale(.92)}18%{opacity:1;transform:scale(1)}82%{opacity:1}100%{opacity:0}}.pd-in{animation:pd-in 3s ease-out infinite;transform-box:fill-box;transform-origin:center}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сетка из девяти дефектов печати"
      >
        <text x="10" y="20" fontSize="10" fill="#cbd5e1">
          Сетка дефектов: от «не прилипло» до «засор сопла»
        </text>
        {DEFECTS.map((defect, i) => {
          const x = 10 + (i % 3) * 102;
          const y = 28 + Math.floor(i / 3) * 48;
          return (
            <g
              key={defect.label}
              className={animated ? "pd-in" : undefined}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <rect x={x} y={y} width="98" height="44" rx="4" fill="#0f172a" stroke="#475569" />
              <g transform={`translate(${x + 12} ${y + 6})`}>
                <path d={defect.d} fill="none" stroke="#ef4444" strokeWidth="1.4" />
              </g>
              <text x={x + 6} y={y + 40} fontSize="7.5" fill="#cbd5e1">
                {defect.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
