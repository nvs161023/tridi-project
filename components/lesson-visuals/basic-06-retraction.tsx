import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 6 · animation «Как работает ретракт» (Модуль 2: Настройка печати).
 *
 * Из описания блока: сопло перестаёт печатать и втягивает пластик назад, чтобы не
 * капал; перемещается на новое место и снова выдавливает; без ретракта — паутинки.
 * Слева — цикл из четырёх фаз, справа — та же сцена без ретракта.
 */
export function Basic06Retraction({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цикл ретракта: печать, втягивание пластика, переезд и снова печать; справа без ретракта паутинки"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b6r-noz{0%{transform:translateX(0)}25%{transform:translateX(64px)}50%{transform:translateX(64px)}75%{transform:translateX(114px)}100%{transform:translateX(158px)}}@keyframes b6r-a{0%{transform:scaleX(0)}25%{transform:scaleX(1)}94%{opacity:1}100%{opacity:0}}@keyframes b6r-b{0%,72%{transform:scaleX(0)}100%{transform:scaleX(1)}}@keyframes b6r-t{0%,50%{opacity:0}58%,72%{opacity:1}82%,100%{opacity:0}}@keyframes b6r-in{0%,24%{opacity:0}32%,48%{opacity:1}58%,100%{opacity:0}}@keyframes b6r-web{0%,100%{opacity:.35}50%{opacity:1}}.b6r-noz{animation:b6r-noz 4s ease-in-out infinite}.b6r-a{animation:b6r-a 4s linear infinite;transform-box:fill-box;transform-origin:left center}.b6r-b{animation:b6r-b 4s linear infinite;transform-box:fill-box;transform-origin:left center}.b6r-t{animation:b6r-t 4s linear infinite}.b6r-in{animation:b6r-in 4s ease-in-out infinite}.b6r-web{animation:b6r-web 2s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="8" y="20" fontSize="8" fill="#93c5fd">
          с ретрактом: пластик втягивается
        </text>
        <text x="200" y="20" fontSize="8" fill="#fcd34d">
          без ретракта — паутинки
        </text>
        <line x1="192" y1="14" x2="192" y2="150" stroke="#334155" />

        <rect
          x="26"
          y="112"
          width="64"
          height="7"
          rx="3.5"
          fill="#3b82f6"
          className={animated ? "b6r-a" : undefined}
        />
        <rect
          x="140"
          y="112"
          width="44"
          height="7"
          rx="3.5"
          fill="#3b82f6"
          className={animated ? "b6r-b" : undefined}
        />
        <line
          x1="94"
          y1="115"
          x2="136"
          y2="115"
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="3 3"
          className={animated ? "b6r-t" : undefined}
        />
        <text x="86" y="106" fontSize="6.5" fill="#94a3b8">
          переезд
        </text>

        <g transform="translate(26 0)">
          <g
            className={animated ? "b6r-noz" : undefined}
            transform={animated ? undefined : "translate(158 0)"}
          >
            <polygon points="-7,112 7,112 4,94 -4,94" fill="#64748b" />
            <rect x="-8" y="78" width="16" height="16" rx="2" fill="#334155" stroke="#475569" />
            <text x="12" y="90" fontSize="6.5" fill="#cbd5e1">
              сопло
            </text>
            <g className={animated ? "b6r-in" : undefined}>
              <path d="M0 74 L0 62 M-4 66 L0 60 L4 66" stroke="#f59e0b" strokeWidth="1.4" fill="none" />
              <text x="8" y="70" fontSize="6.5" fill="#fcd34d">
                пластик назад
              </text>
            </g>
          </g>
        </g>

        <rect x="204" y="98" width="16" height="21" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        <rect x="288" y="98" width="16" height="21" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        {[
          "M220 104 C 246 96 262 112 288 104",
          "M220 110 C 246 118 262 102 288 112",
          "M220 116 C 246 108 262 120 288 118",
        ].map((d, i) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.9"
            className={animated ? "b6r-web" : undefined}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
        <text x="198" y="136" fontSize="6.5" fill="#fca5a5">
          нити остаются между точками печати
        </text>

        <line x1="8" y1="126" x2="314" y2="126" stroke="#475569" strokeWidth="2" />
        <text x="8" y="150" fontSize="6.5" fill="#94a3b8">
          1 печатает
        </text>
        <text x="58" y="150" fontSize="6.5" fill="#94a3b8">
          2 втягивает
        </text>
        <text x="108" y="150" fontSize="6.5" fill="#94a3b8">
          3 переезжает
        </text>
        <text x="156" y="150" fontSize="6.5" fill="#94a3b8">
          4 снова печатает
        </text>
      </svg>
    </VisualWrapper>
  );
}
