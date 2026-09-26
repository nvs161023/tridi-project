import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две дорожки: сопло едет от детали к детали — с ретрактом и без. */
const tracks = [
  {
    caption: "с ретрактом — чисто",
    captionY: 26,
    nozzlePoints: "45,44 57,44 51,56",
    partY: 58,
    pull: true,
  },
  {
    caption: "без ретракта — паутинки",
    captionY: 100,
    nozzlePoints: "45,116 57,116 51,128",
    partY: 130,
    pull: false,
  },
];

/** Капли, которые падают с сопла без ретракта. */
const drops = [
  { cx: 132, cy: 138 },
  { cx: 196, cy: 138 },
];

/**
 * Как работает ретракт — две одинаковые поездки сопла в одном кадре.
 *
 * Ровно по content урока: «Сопло втягивает пластик назад, чтобы не капал. Без
 * ретракта — паутинки». Верхняя дорожка — с ретрактом: сопло уезжает к правой
 * детали, а нить пластика втягивается вверх (стрелка и отрезок у сопла). Нижняя —
 * без ретракта: за соплом тянется паутинка, с сопла падают капли. Внизу значения
 * из списка урока: Direct 0,5–2 мм, Bowden 4–7 мм, скорость 25–40 мм/с.
 *
 * От анимации скорости (урок 7) отличается сюжетом: там стенка расслаивается,
 * здесь важно, что сопло делает на холостом переезде.
 */
export function Basic6Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло переезжает от детали к детали — с ретрактом пластик втягивается и переезд чистый, без ретракта за соплом тянутся паутинки и падают капли"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b6a-move { animation: v-b6a-travel 3.4s ease-in-out infinite; }
          .v-b6a-pull { animation: v-b6a-pull 3.4s ease-in-out infinite; }
          .v-b6a-web { stroke-dasharray: 4 4; opacity: 0.85; animation: v-b6a-draw 3.4s linear infinite; }
          .v-b6a-drop { opacity: 0.9; animation: v-b6a-drip 3.4s ease-in infinite; }
          @keyframes v-b6a-travel {
            0%, 14% { transform: translateX(0); }
            72%, 88% { transform: translateX(218px); }
            100% { transform: translateX(0); }
          }
          @keyframes v-b6a-pull {
            0%, 14% { transform: translateY(0); opacity: 1; }
            40% { transform: translateY(-5px); opacity: 0.45; }
            72%, 100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes v-b6a-draw {
            0%, 14% { stroke-dashoffset: 184; }
            62%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes v-b6a-drip {
            0%, 40% { transform: translateY(0); opacity: 0.9; }
            70%, 100% { transform: translateY(4px); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-b6a-move, .v-b6a-pull, .v-b6a-web, .v-b6a-drop {
              animation: none;
            }
          }
        `}</style>

        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        {tracks.map((track) => (
          <g key={track.caption}>
            <text
              x="18"
              y={track.captionY}
              fontSize="10"
              fill={track.pull ? "#6ee7b7" : "#fca5a5"}
            >
              {track.caption}
            </text>

            {/* Две детали, между которыми едет сопло */}
            <rect x="34" y={track.partY} width="34" height="12" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
            <rect x="252" y={track.partY} width="34" height="12" rx="2" fill="#1e3a5f" stroke="#3b82f6" />

            {/* Паутинка и капли — только без ретракта */}
            {track.pull ? null : (
              <>
                <line
                  className="v-b6a-web"
                  x1="68"
                  y1={track.partY + 4}
                  x2="252"
                  y2={track.partY + 4}
                  stroke="#fca5a5"
                  strokeWidth="1"
                />
                {drops.map((drop, dropIndex) => (
                  <circle
                    key={drop.cx}
                    className="v-b6a-drop"
                    cx={drop.cx}
                    cy={drop.cy}
                    r="2.5"
                    fill="#fca5a5"
                    style={{ animationDelay: `${dropIndex * 0.5}s` }}
                  />
                ))}
              </>
            )}

            {/* Сопло и втянутый пластик */}
            <g className="v-b6a-move">
              <polygon points={track.nozzlePoints} fill="#94a3b8" />
              {track.pull ? (
                <>
                  <rect className="v-b6a-pull" x="48" y="40" width="6" height="8" rx="2" fill="#f59e0b" />
                  <polygon points="70,48 62,52 70,56" fill="#fbbf24" />
                  <text x="76" y="52" fontSize="10" fill="#fbbf24">
                    втянул
                  </text>
                </>
              ) : null}
            </g>
          </g>
        ))}

        <text x="18" y="166" fontSize="10" fill="#94a3b8">
          Ретракт: Direct 0,5–2 мм, Bowden 4–7 мм, 25–40 мм/с
        </text>
      </svg>
    </VisualWrapper>
  );
}
