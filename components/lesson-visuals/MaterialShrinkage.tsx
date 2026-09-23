/**
 * MaterialShrinkage — горячая деталь сжимается при охлаждении: аморфный
 * пластик на 0,5 %, кристаллический на 1,5–2 %. Пунктир — размер горячей детали.
 */
export function MaterialShrinkage({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes ms-a{0%,100%{transform:scale(1)}55%,80%{transform:scale(.98)}}@keyframes ms-c{0%,100%{transform:scale(1)}55%,80%{transform:scale(.94)}}.ms-a{animation:ms-a 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.ms-c{animation:ms-c 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Усадка аморфного и кристаллического пластика при охлаждении"
      >
        <rect x="30" y="52" width="80" height="52" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
        <rect
          x="30"
          y="52"
          width="80"
          height="52"
          rx="2"
          fill="#1d4ed8"
          stroke="#3b82f6"
          className={animated ? "ms-a" : undefined}
        />
        <text x="30" y="122" fontSize="10" fill="#93c5fd">
          0,5% — аморфный
        </text>
        <text x="30" y="136" fontSize="8" fill="#94a3b8">
          цепочки как спагетти
        </text>

        <rect x="186" y="52" width="80" height="52" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
        <rect
          x="186"
          y="52"
          width="80"
          height="52"
          rx="2"
          fill="#7f1d1d"
          stroke="#ef4444"
          className={animated ? "ms-c" : undefined}
        />
        <text x="186" y="122" fontSize="10" fill="#fca5a5">
          1,5–2% — кристаллический
        </text>
        <text x="186" y="136" fontSize="8" fill="#94a3b8">
          упакованные прутья
        </text>

        <text x="30" y="30" fontSize="10" fill="#cbd5e1">
          Горячий пластик расширен → при охлаждении сжимается
        </text>
        <text x="30" y="162" fontSize="8" fill="#94a3b8">
          Пунктир — размер горячей детали; масштаб усадки увеличен для наглядности
        </text>
      </svg>
    </div>
  );
}
