import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 10 · image «Где брать модели: 6 сайтов» (Модуль 3: Проблемы и решения).
 *
 * Из описания блока: Thingiverse — много бесплатных, Printables — удобный поиск и
 * рейтинги, Cults3D — есть платные, MakerWorld — от Bambu Lab, MyMiniFactory — для
 * настольных игр, Thangs — поиск сразу по всем сайтам. Метка под каждым: бесплатно
 * или платно и разрешена ли продажа по лицензии. Скачиваем STL или 3MF.
 */
const SITES = [
  { name: "Thingiverse", mark: "circle", note: ["много бесплатных"] },
  { name: "Printables", mark: "hex", note: ["удобный поиск", "и рейтинги"] },
  { name: "Cults3D", mark: "triangle", note: ["есть платные"] },
  { name: "MakerWorld", mark: "square", note: ["от Bambu Lab"] },
  { name: "MyMiniFactory", mark: "die", note: ["для настольных", "игр"] },
  { name: "Thangs", mark: "rings", note: ["поиск сразу", "по всем сайтам"] },
];

function Mark({ kind }: { kind: string }) {
  return (
    <g>
      {kind === "circle" && (
        <>
          <circle cx="16" cy="14" r="11" fill="none" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="16" cy="14" r="3" fill="#93c5fd" />
        </>
      )}
      {kind === "hex" && <polygon points="16,2 28,8 28,20 16,26 4,20 4,8" fill="none" stroke="#3b82f6" strokeWidth="2" />}
      {kind === "triangle" && <polygon points="16,3 29,24 3,24" fill="none" stroke="#3b82f6" strokeWidth="2" />}
      {kind === "square" && (
        <>
          <rect x="5" y="3" width="22" height="22" rx="3" fill="none" stroke="#3b82f6" strokeWidth="2" />
          <line x1="5" y1="25" x2="27" y2="3" stroke="#93c5fd" strokeWidth="2" />
        </>
      )}
      {kind === "die" && (
        <>
          <rect x="5" y="3" width="22" height="22" rx="3" fill="none" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="11" cy="9" r="2" fill="#93c5fd" />
          <circle cx="21" cy="19" r="2" fill="#93c5fd" />
          <circle cx="16" cy="14" r="2" fill="#93c5fd" />
        </>
      )}
      {kind === "rings" && (
        <>
          <circle cx="12" cy="16" r="8" fill="none" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="21" cy="16" r="8" fill="none" stroke="#93c5fd" strokeWidth="2" />
        </>
      )}
    </g>
  );
}

export function Basic10Sites({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть сайтов с моделями: Thingiverse, Printables, Cults3D, MakerWorld, MyMiniFactory, Thangs; форматы STL и 3MF"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        {SITES.map((site, i) => {
          const x = 8 + (i % 3) * 104;
          const y = 10 + Math.floor(i / 3) * 72;
          return (
            <g key={site.name}>
              <rect x={x} y={y} width="96" height="66" rx="5" fill="#0f172a" stroke="#475569" />
              <text x={x + 48} y={y + 14} fontSize="8.5" fill="#e2e8f0" textAnchor="middle">
                {site.name}
              </text>
              <g transform={`translate(${x + 32} ${y + 18})`}>
                <Mark kind={site.mark} />
              </g>
              {site.note.map((line, k) => (
                <text
                  key={line}
                  x={x + 48}
                  y={y + 52 + k * 9}
                  fontSize="6.5"
                  fill="#93c5fd"
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
        <rect x="8" y="158" width="26" height="14" rx="2" fill="#1e293b" stroke="#3b82f6" />
        <text x="21" y="168" fontSize="7" fill="#93c5fd" textAnchor="middle">
          STL
        </text>
        <rect x="40" y="158" width="26" height="14" rx="2" fill="#1e293b" stroke="#3b82f6" />
        <text x="53" y="168" fontSize="7" fill="#93c5fd" textAnchor="middle">
          3MF
        </text>
        <text x="74" y="168" fontSize="7" fill="#94a3b8">
          скачиваем STL или 3MF · метка под каждым сайтом: бесплатно или платно,
        </text>
        <text x="8" y="176" fontSize="7" fill="#94a3b8">
          разрешена ли продажа по лицензии
        </text>
      </svg>
    </VisualWrapper>
  );
}
