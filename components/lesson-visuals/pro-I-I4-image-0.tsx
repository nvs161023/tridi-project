import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре колонки-группы причин: каждая со своим цветом шапки. */
const GROUPS = [
  { x: 16, name: "адгезия", accent: "#38bdf8" },
  { x: 92, name: "экструзия", accent: "#34d399" },
  { x: 168, name: "механика", accent: "#a78bfa" },
  { x: 244, name: "температура", accent: "#fbbf24" },
];

/**
 * Двадцать дефектов по пять на группу: имена из блока «Топ дефектов и решения»
 * этого урока и из карты базового урока 10. Решений в кадре нет — они остаются в
 * списке урока, здесь атлас для поиска «что это у меня».
 */
const DEFECTS = [
  { column: 0, kind: "detach", name: "не прилипло" },
  { column: 0, kind: "corner", name: "угол отошёл" },
  { column: 0, kind: "foot", name: "elephant foot" },
  { column: 0, kind: "thin", name: "слой тонкий" },
  { column: 0, kind: "thick", name: "слой толстый" },
  { column: 1, kind: "underext", name: "недолив" },
  { column: 1, kind: "overext", name: "перелив" },
  { column: 1, kind: "gaps", name: "пропуски" },
  { column: 1, kind: "clog", name: "засор сопла" },
  { column: 1, kind: "blobs", name: "натёки" },
  { column: 2, kind: "ringing", name: "ringing" },
  { column: 2, kind: "shift", name: "сдвиг слоёв" },
  { column: 2, kind: "zwobble", name: "z-полосы" },
  { column: 2, kind: "echo", name: "неровные углы" },
  { column: 2, kind: "seam", name: "шов со сдвигом" },
  { column: 3, kind: "strings", name: "паутинки" },
  { column: 3, kind: "sag", name: "провисание" },
  { column: 3, kind: "pillow", name: "вспучен верх" },
  { column: 3, kind: "cracks", name: "трещины" },
  { column: 3, kind: "delam", name: "расслоение" },
];

const RED = "#f87171";
const DIM = "#64748b";

/** Мини-профиль дефекта внутри плитки 66×15 (x, y — её левый верх). */
function Glyph({ kind, x, y, accent }: { kind: string; x: number; y: number; accent: string }) {
  const left = x + 4;
  const right = x + 62;
  const mid = y + 7;

  switch (kind) {
    case "detach":
      return (
        <>
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
          <path d={`M${left + 6},${y + 10} q22,-6 44,-1`} fill="none" stroke={RED} strokeWidth="1.6" />
        </>
      );
    case "corner":
      return (
        <>
          <path d={`M${left + 4},${y + 13} v-9 h30`} fill="none" stroke={DIM} strokeWidth="1.6" />
          <path d={`M${left + 34},${y + 4} q10,4 12,10`} fill="none" stroke={RED} strokeWidth="1.6" />
        </>
      );
    case "foot":
      return (
        <>
          <path d={`M${left + 16},${y + 2} v9 l-6,3 h30 l-6,-3 v-9 z`} fill="none" stroke={DIM} />
          <line x1={left + 4} y1={y + 13} x2={left + 54} y2={y + 13} stroke={RED} strokeWidth="1.6" />
        </>
      );
    case "thin":
      return (
        <>
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
          <rect x={left + 2} y={y + 9} width="56" height="1.6" fill={RED} />
        </>
      );
    case "thick":
      return (
        <>
          <line x1={left} y1={y + 13} x2={right} y2={y + 13} stroke={DIM} />
          <rect x={left + 2} y={y + 4} width="56" height="6" rx="2" fill={RED} />
        </>
      );
    case "underext":
      return (
        <>
          {[3, 7, 11].map((offset) => (
            <line key={`sp-${offset}`} x1={left} y1={y + offset} x2={left + 20} y2={y + offset} stroke={accent} strokeWidth="1.4" />
          ))}
          {[3, 7, 11].map((offset) => (
            <line key={`sp2-${offset}`} x1={left + 36} y1={y + offset} x2={left + 58} y2={y + offset} stroke={accent} strokeWidth="1.4" />
          ))}
        </>
      );
    case "overext":
      return (
        <>
          {[3, 7, 11].map((offset) => (
            <line key={`ov-${offset}`} x1={left} y1={y + offset} x2={right} y2={y + offset} stroke={accent} strokeWidth="2.6" />
          ))}
        </>
      );
    case "gaps":
      return <line x1={left} y1={mid} x2={right} y2={mid} stroke={accent} strokeWidth="2" strokeDasharray="3 3" />;
    case "clog":
      return (
        <>
          <path d={`M${left + 8},${y + 1} h12 l4,7 h-20 z`} fill="none" stroke={DIM} />
          <circle cx={left + 14} cy={y + 10.5} r="2.5" fill={RED} />
        </>
      );
    case "blobs":
      return (
        <>
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
          {[10, 24, 38, 50].map((offset) => (
            <circle key={`bb-${offset}`} cx={left + offset} cy={y + 9} r="2.2" fill={RED} />
          ))}
        </>
      );
    case "ringing":
      return (
        <>
          <line x1={left + 8} y1={y + 1} x2={left + 8} y2={y + 13} stroke={DIM} />
          <path
            d={`M${left + 8},${y + 4} q6,3 12,0 q6,-3 12,0 q6,3 12,0 q6,-3 12,0`}
            fill="none"
            stroke={RED}
            strokeWidth="1.4"
          />
        </>
      );
    case "shift":
      return (
        <>
          <path d={`M${left},${y + 10} h22 v-6 h36`} fill="none" stroke={RED} strokeWidth="1.6" />
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
        </>
      );
    case "zwobble":
      return (
        <>
          {[2, 6, 10].map((offset) => (
            <line key={`zw-${offset}`} x1={left} y1={y + offset} x2={right} y2={y + offset} stroke={DIM} />
          ))}
          <line x1={left + 12} y1={y + 1} x2={left + 12} y2={y + 12} stroke={accent} strokeWidth="1.4" />
          <line x1={left + 52} y1={y + 2} x2={left + 52} y2={y + 13} stroke={accent} strokeWidth="1.4" />
        </>
      );
    case "echo":
      return (
        <>
          <path d={`M${left + 4},${y + 12} v-10 h10`} fill="none" stroke={DIM} strokeWidth="1.6" />
          {[1, 2, 3].map((step) => (
            <path
              key={`ec-${step}`}
              d={`M${left + 16 + step * 3},${y + 2 + step * 3} v-1 h8`}
              fill="none"
              stroke={RED}
              strokeWidth="1.2"
              strokeOpacity={1 - step * 0.25}
            />
          ))}
        </>
      );
    case "seam":
      return (
        <>
          <rect x={left} y={y + 1} width="56" height="12" fill="none" stroke={DIM} />
          <line x1={left + 34} y1={y + 1} x2={left + 34} y2={y + 13} stroke={RED} strokeWidth="1.6" />
          <line x1={left + 34} y1={y + 7} x2={left + 44} y2={y + 7} stroke={RED} strokeWidth="1.2" />
        </>
      );
    case "strings":
      return (
        <>
          <rect x={left + 4} y={y + 2} width="8" height="11" fill={DIM} />
          <rect x={left + 48} y={y + 2} width="8" height="11" fill={DIM} />
          {[4, 8, 11].map((offset) => (
            <line
              key={`st-${offset}`}
              x1={left + 12}
              y1={y + offset}
              x2={left + 48}
              y2={y + offset + 1}
              stroke={RED}
              strokeWidth="0.8"
            />
          ))}
        </>
      );
    case "sag":
      return (
        <>
          <line x1={left} y1={y + 2} x2={right} y2={y + 2} stroke={DIM} />
          <path d={`M${left + 6},${y + 3} q24,8 44,0`} fill="none" stroke={RED} strokeWidth="1.6" />
        </>
      );
    case "pillow":
      return (
        <>
          <path
            d={`M${left},${y + 11} q7,-5 14,0 q7,5 14,0 q7,-5 14,0 q7,5 14,0`}
            fill="none"
            stroke={RED}
            strokeWidth="1.6"
          />
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
        </>
      );
    case "cracks":
      return (
        <>
          <line x1={left} y1={y + 2} x2={right} y2={y + 2} stroke={DIM} />
          <line x1={left} y1={y + 12} x2={right} y2={y + 12} stroke={DIM} />
          <path d={`M${left + 20},${y + 3} l6,4 l-4,3 l7,3`} fill="none" stroke={RED} strokeWidth="1.6" />
        </>
      );
    case "delam":
      return (
        <>
          {[2, 6, 10].map((offset) => (
            <line
              key={`dl-${offset}`}
              x1={left}
              y1={y + offset}
              x2={right - offset}
              y2={y + offset}
              stroke={RED}
              strokeWidth="1.6"
              strokeOpacity={1 - offset * 0.06}
            />
          ))}
        </>
      );
    default:
      return null;
  }
}


/**
 * «20 дефектов» — атлас из четырёх колонок-групп по причинам: адгезия, экструзия,
 * механика, температура. У каждой группы своя шапка и свой цвет, внутри — пять
 * дефектов: плитка 66×15 с мини-профилем и имя. Строк-решений нет.
 *
 * Ровно по content урока: «Сетка 4×5: фото дефектов и подписи. От «не прилипло» до
 * «засор сопла»», имена — из блока «Топ дефектов и решения».
 *
 * От карты базового урока 10 отличается принципом: там сетка 2×5 «найди похожее на
 * свой брак» и под каждой плиткой подсказка-решение. Здесь группировка ПО ПРИЧИНЕ
 * (это первое, что ищет мастер), плитки вдвое мельче по высоте, нет ни одной
 * строки-решения, а решения живут в списке урока. Порядок чтения: колонка за
 * колонкой, в каждой — сверху вниз.
 */
export function ProII4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Атлас двадцати дефектов по четырём причинам: в группе адгезии не прилипло, отошедший угол, elephant foot и тонкий с толстым первый слой; в экструзии недолив, перелив, пропуски, засор сопла и натёки; в механике ringing, сдвиг слоёв, z-полосы, неровные углы и шов со сдвигом; в температуре паутинки, провисание, вспученный верх, трещины и расслоение"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        <text x="12" y="13" fontSize="9" fill="#94a3b8">
          атлас: ищи свою строчку по причине
        </text>

        {GROUPS.map((group) => (
          <g key={group.name}>
            <rect x={group.x} y="20" width="66" height="13" rx="4" fill="#0f172a" stroke={group.accent} />
            <text
              x={group.x + 33}
              y="29.5"
              fontSize="7.5"
              fontWeight="bold"
              fill={group.accent}
              textAnchor="middle"
            >
              {group.name}
            </text>
          </g>
        ))}

        {DEFECTS.map((defect, index) => {
          const group = GROUPS[defect.column];
          const y = 34 + (index % 5) * 29;

          return (
            <g key={defect.name}>
              <rect x={group.x} y={y} width="66" height="14" rx="3" fill="#0f172a" stroke="#334155" />
              <Glyph kind={defect.kind} x={group.x} y={y} accent={group.accent} />
              <text x={group.x + 33} y={y + 26} fontSize="7" fill="#e2e8f0" textAnchor="middle">
                {defect.name}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
