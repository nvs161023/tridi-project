import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять строк соединений: значок 16…48, название 56, работа справа до 304. */
const ROW_TOP = 40;
const ROW_STEP = 22;
const NAME_X = 56;
const WORK_X = 304;

type JointKind = "peg" | "dovetail" | "pin" | "magnet" | "thread";
type Joint = { kind: JointKind; name: string; work: string };

/** Пять соединений и их работа — блок 13, цифры блоков 16–19. */
const JOINTS: Joint[] = [
  { kind: "peg", name: "Шип-паз", work: "сдвиг, растяжение" },
  { kind: "dovetail", name: "Ласточкин хвост", work: "натяжение, замок" },
  { kind: "pin", name: "Штифты", work: "ровность без веса" },
  { kind: "magnet", name: "Магниты", work: "съём и доступ" },
  { kind: "thread", name: "Резьба", work: "винт, точный зазор" },
];

const NOTES = [
  "Форму держит соединение, клей только фиксирует",
  "Штифты выравнивают части, магниты дают доступ",
];

/** Значок соединения: две части и деталь стыка между ними. */
function Glyph({ kind, y }: { kind: JointKind; y: number }) {
  return (
    <g>
      <rect x="16" y={y - 19} width="14" height="16" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
      <rect x="34" y={y - 19} width="14" height="16" fill="#334155" fillOpacity="0.7" stroke="#64748b" />
      {kind === "peg" ? (
        <rect x="22" y={y - 13} width="20" height="5" fill="#10b981" fillOpacity="0.35" stroke="#10b981" />
      ) : null}
      {kind === "dovetail" ? (
        <polygon
          points={`${32},${y - 18} ${44},${y - 13} ${44},${y - 7} ${32},${y - 2}`}
          fill="#f59e0b"
          fillOpacity="0.3"
          stroke="#f59e0b"
        />
      ) : null}
      {kind === "pin" ? (
        <circle cx="32" cy={y - 11} r="5" fill="#10b981" fillOpacity="0.3" stroke="#10b981" />
      ) : null}
      {kind === "magnet" ? (
        <>
          <rect x="24" y={y - 15} width="5" height="10" fill="#f59e0b" fillOpacity="0.5" />
          <rect x="35" y={y - 15} width="5" height="10" fill="#60a5fa" fillOpacity="0.5" />
        </>
      ) : null}
      {kind === "thread" ? (
        <>
          <rect x="24" y={y - 14} width="16" height="8" fill="#94a3b8" fillOpacity="0.3" stroke="#94a3b8" />
          {[27, 31, 35].map((x) => (
            <line key={x} x1={x} y1={y - 6} x2={x + 3} y2={y - 14} stroke="#cbd5e1" strokeOpacity="0.7" />
          ))}
        </>
      ) : null}
    </g>
  );
}

/**
 * Кадр блока 14 урока C7 «Пять соединений и их работа».
 *
 * Список из описания кадра `C7_joints.png` и блока 13: шип-паз работает на
 * сдвиг и растяжение, ласточкин хвост держит ещё и натяжение, штифты только
 * выравнивают части, магниты дают доступ и съём, резьба держит на винте и
 * требует самого точного зазора. Значки — две части и деталь стыка между ними.
 * Нижние строки — главное правило блока 13: форму держит соединение, а клей
 * лишь фиксирует части рядом.
 */
export function ConfidentC7Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять соединений и их работа. Шип-паз работает на сдвиг и растяжение. Ласточкин хвост держит натяжение и работает как замок. Штифты дают ровность без веса. Магниты дают съём и доступ. Резьба держит на винте и требует точного зазора. Форму держит соединение, клей только фиксирует. Штифты выравнивают части, магниты дают доступ"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          каждое под свою нагрузку
        </text>

        {JOINTS.map((joint, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={joint.name}>
              <Glyph kind={joint.kind} y={y} />
              <text x={NAME_X} y={y - 7} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {joint.name}
              </text>
              <text x={WORK_X} y={y - 7} fontSize="10" fill="#94a3b8" textAnchor="end">
                {joint.work}
              </text>
            </g>
          );
        })}

        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={152 + index * 16}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
